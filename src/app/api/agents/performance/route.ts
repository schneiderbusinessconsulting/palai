import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface AgentPerformance {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  emails_assigned: number
  emails_resolved: number
  resolution_rate: number
  avg_response_minutes: number | null
  escalations_from: number
  escalations_to: number
  csat_avg: number | null
}

interface TeamTotals {
  total_agents: number
  total_emails_assigned: number
  total_emails_resolved: number
  team_resolution_rate: number
  team_avg_response_minutes: number | null
  team_csat_avg: number | null
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  switch (period) {
    case '24h': start.setHours(start.getHours() - 24); break
    case '7d': start.setDate(start.getDate() - 7); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '30d':
    default: start.setDate(start.getDate() - 30); break
  }
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const { startDate, endDate } = getDateRange(period)

    const supabase = await createClient()

    // Fetch active agents
    const { data: agents, error: agentsError } = await supabase
      .from('support_agents')
      .select('id, name, email, role, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (agentsError) {
      console.error('Error fetching agents:', agentsError)
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    const activeAgents = agents || []
    const agentIds = activeAgents.map((a: { id: string }) => a.id)

    // Fetch emails assigned to these agents in period
    let assignedEmails: Array<{
      id: string
      assigned_agent_id: string
      status: string
      received_at: string
      first_response_at: string | null
    }> = []

    if (agentIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('incoming_emails')
          .select('id, assigned_agent_id, status, received_at, first_response_at')
          .in('assigned_agent_id', agentIds)
          .gte('received_at', `${startDate}T00:00:00`)
          .lte('received_at', `${endDate}T23:59:59`)

        if (error && error.code === '42P01') {
          console.log('incoming_emails table not found, using empty data')
        } else {
          assignedEmails = data || []
        }
      } catch {
        console.log('Error querying incoming_emails for agents, using empty data')
      }
    }

    // Fetch escalations in period
    let escalations: Array<{ from_agent_id: string; to_agent_id: string }> = []
    try {
      const { data, error } = await supabase
        .from('ticket_escalations')
        .select('from_agent_id, to_agent_id')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)

      if (error && error.code === '42P01') {
        console.log('ticket_escalations table not found, using empty data')
      } else {
        escalations = data || []
      }
    } catch {
      console.log('Error querying ticket_escalations, using empty data')
    }

    // Fetch CSAT ratings in period
    let csatRatings: Array<{ rating: number; email_id: string }> = []
    try {
      const { data, error } = await supabase
        .from('csat_ratings')
        .select('rating, email_id')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)

      if (error && error.code === '42P01') {
        console.log('csat_ratings table not found, using empty data')
      } else {
        csatRatings = data || []
      }
    } catch {
      console.log('Error querying csat_ratings, using empty data')
    }

    // Build a map of email_id -> assigned_agent_id for CSAT join
    const emailAgentMap = new Map<string, string>()
    for (const email of assignedEmails) {
      emailAgentMap.set(email.id, email.assigned_agent_id)
    }

    // Calculate per-agent metrics
    const agentPerformances: AgentPerformance[] = activeAgents.map((agent: {
      id: string
      name: string
      email: string
      role: string
      is_active: boolean
    }) => {
      const agentEmails = assignedEmails.filter(e => e.assigned_agent_id === agent.id)
      const emailsAssigned = agentEmails.length
      const emailsResolved = agentEmails.filter(e => e.status === 'sent').length

      // Avg response time in minutes
      const responseTimes: number[] = []
      for (const email of agentEmails) {
        if (email.first_response_at && email.received_at) {
          const receivedMs = new Date(email.received_at).getTime()
          const respondedMs = new Date(email.first_response_at).getTime()
          if (respondedMs > receivedMs) {
            responseTimes.push((respondedMs - receivedMs) / 60000)
          }
        }
      }
      const avgResponseMinutes = responseTimes.length > 0
        ? Math.round((responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length) * 10) / 10
        : null

      // Escalations
      const escalationsFrom = escalations.filter(e => e.from_agent_id === agent.id).length
      const escalationsTo = escalations.filter(e => e.to_agent_id === agent.id).length

      // CSAT average for this agent
      const agentCsatRatings = csatRatings
        .filter(r => emailAgentMap.get(r.email_id) === agent.id)
        .map(r => r.rating)
      const csatAvg = agentCsatRatings.length > 0
        ? Math.round((agentCsatRatings.reduce((s, r) => s + r, 0) / agentCsatRatings.length) * 10) / 10
        : null

      const resolutionRate = emailsAssigned > 0
        ? Math.round((emailsResolved / emailsAssigned) * 100)
        : 0

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        is_active: agent.is_active,
        emails_assigned: emailsAssigned,
        emails_resolved: emailsResolved,
        resolution_rate: resolutionRate,
        avg_response_minutes: avgResponseMinutes,
        escalations_from: escalationsFrom,
        escalations_to: escalationsTo,
        csat_avg: csatAvg,
      }
    })

    // Team-wide totals
    const totalAssigned = agentPerformances.reduce((s, a) => s + a.emails_assigned, 0)
    const totalResolved = agentPerformances.reduce((s, a) => s + a.emails_resolved, 0)

    const allResponseMinutes = agentPerformances
      .filter(a => a.avg_response_minutes !== null)
      .map(a => a.avg_response_minutes as number)
    const teamAvgResponseMinutes = allResponseMinutes.length > 0
      ? Math.round((allResponseMinutes.reduce((s, t) => s + t, 0) / allResponseMinutes.length) * 10) / 10
      : null

    const allCsat = agentPerformances
      .filter(a => a.csat_avg !== null)
      .map(a => a.csat_avg as number)
    const teamCsatAvg = allCsat.length > 0
      ? Math.round((allCsat.reduce((s, c) => s + c, 0) / allCsat.length) * 10) / 10
      : null

    const teamTotals: TeamTotals = {
      total_agents: activeAgents.length,
      total_emails_assigned: totalAssigned,
      total_emails_resolved: totalResolved,
      team_resolution_rate: totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 0,
      team_avg_response_minutes: teamAvgResponseMinutes,
      team_csat_avg: teamCsatAvg,
    }

    return NextResponse.json({
      period: { start: startDate, end: endDate, period },
      team: teamTotals,
      agents: agentPerformances,
    })
  } catch (error) {
    console.error('Agent performance API error:', error)
    return NextResponse.json({ error: 'Failed to fetch agent performance' }, { status: 500 })
  }
}
