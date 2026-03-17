import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getDateRange(period: string): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  switch (period) {
    case '7d': start.setDate(start.getDate() - 7); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '30d':
    default: start.setDate(start.getDate() - 30); break
  }
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '--'
  if (minutes < 60) return `${Math.round(minutes)}min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`
}

function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `KW${weekNum}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const { startDate, endDate } = getDateRange(period)

    const supabase = await createClient()

    // Q1 – Agent base data
    const { data: agent, error: agentError } = await supabase
      .from('support_agents')
      .select('id, name, email, role, specializations, is_active, max_open_tickets')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Q2 – All emails in period (for stats)
    let periodEmails: Array<{
      id: string
      status: string
      received_at: string
      first_response_at: string | null
      topic_cluster: string | null
      sla_status: string | null
      from_email: string
      from_name: string | null
      subject: string
    }> = []
    try {
      const { data, error } = await supabase
        .from('incoming_emails')
        .select('id, status, received_at, first_response_at, topic_cluster, sla_status, from_email, from_name, subject')
        .eq('assigned_agent_id', agentId)
        .gte('received_at', startDate)
        .lte('received_at', endDate)
      if (!error || error.code !== '42P01') periodEmails = data || []
    } catch { /* table may not exist */ }

    // Q3 – Open queue (no date filter)
    let openQueue: Array<{
      id: string
      from_email: string
      from_name: string | null
      subject: string
      received_at: string
      sla_status: string | null
      topic_cluster: string | null
    }> = []
    try {
      const { data, error } = await supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, sla_status, topic_cluster')
        .eq('assigned_agent_id', agentId)
        .not('status', 'in', '("sent","resolved","archived")')
        .order('received_at', { ascending: true })
        .limit(50)
      if (!error || error.code !== '42P01') openQueue = data || []
    } catch { /* table may not exist */ }

    // Q4 – Escalations from this agent in period
    let escalations: Array<{
      reason: string | null
      email_id: string | null
    }> = []
    try {
      const { data, error } = await supabase
        .from('ticket_escalations')
        .select('reason, email_id')
        .eq('from_agent_id', agentId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
      if (!error || error.code !== '42P01') escalations = data || []
    } catch { /* table may not exist */ }

    // Q5 – CSAT verbatim (via periodEmail IDs)
    let csatRawList: Array<{
      rating: number
      comment: string | null
      created_at: string
      email_id: string
    }> = []
    const periodEmailIds = periodEmails.map(e => e.id)
    if (periodEmailIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('csat_ratings')
          .select('rating, comment, created_at, email_id')
          .in('email_id', periodEmailIds)
          .order('created_at', { ascending: false })
          .limit(10)
        if (!error || error.code !== '42P01') csatRawList = data || []
      } catch { /* table may not exist */ }
    }

    // --- Compute stats ---
    const emailsAssigned = periodEmails.length
    const emailsResolved = periodEmails.filter(e => e.status === 'sent' || e.status === 'resolved').length
    const resolutionRate = emailsAssigned > 0 ? Math.round((emailsResolved / emailsAssigned) * 100) : 0

    const responseTimes: number[] = []
    for (const email of periodEmails) {
      if (email.first_response_at && email.received_at) {
        const diff = (new Date(email.first_response_at).getTime() - new Date(email.received_at).getTime()) / 60000
        if (diff > 0) responseTimes.push(diff)
      }
    }
    const avgResponseMinutes = responseTimes.length > 0
      ? Math.round((responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length) * 10) / 10
      : null

    const csatValues = csatRawList.map(r => r.rating)
    const csatAvg = csatValues.length > 0
      ? Math.round((csatValues.reduce((s, r) => s + r, 0) / csatValues.length) * 10) / 10
      : null

    // Escalation topics
    const topicCountMap = new Map<string, number>()
    for (const esc of escalations) {
      // Try to get topic from the period email
      const email = periodEmails.find(e => e.id === esc.email_id)
      const topic = email?.topic_cluster || esc.reason || 'Sonstiges'
      topicCountMap.set(topic, (topicCountMap.get(topic) || 0) + 1)
    }
    const escalationTopics = Array.from(topicCountMap.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)

    // Build email lookup for CSAT verbatim
    const emailMap = new Map(periodEmails.map(e => [e.id, e]))
    const csatVerbatim = csatRawList.slice(0, 5).map(r => ({
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      subject: emailMap.get(r.email_id)?.subject || '',
      from_name: emailMap.get(r.email_id)?.from_name || emailMap.get(r.email_id)?.from_email || '',
    }))

    // Weekly trend (last 4 ISO weeks)
    const weekMap = new Map<string, { emails: number; resolved: number }>()
    for (const email of periodEmails) {
      const week = getISOWeek(new Date(email.received_at))
      const existing = weekMap.get(week) || { emails: 0, resolved: 0 }
      existing.emails++
      if (email.status === 'sent' || email.status === 'resolved') existing.resolved++
      weekMap.set(week, existing)
    }
    const weeklyTrend = Array.from(weekMap.entries())
      .map(([week, data]) => ({
        week,
        emails: data.emails,
        resolution_rate: data.emails > 0 ? Math.round((data.resolved / data.emails) * 100) : 0,
      }))
      .slice(-4)

    const periodLabel = period === '7d' ? '7 Tage' : period === '90d' ? '90 Tage' : '30 Tage'

    return NextResponse.json({
      agent,
      period: { start: startDate, end: endDate, label: periodLabel },
      stats: {
        emails_assigned: emailsAssigned,
        emails_resolved: emailsResolved,
        resolution_rate: resolutionRate,
        avg_response_minutes: avgResponseMinutes,
        avg_response_formatted: formatMinutes(avgResponseMinutes),
        csat_avg: csatAvg,
        escalations_given: escalations.length,
        open_queue_count: openQueue.length,
      },
      openQueue,
      escalationTopics,
      csatVerbatim,
      weeklyTrend,
    })
  } catch (error) {
    console.error('Agent detail API error:', error)
    return NextResponse.json({ error: 'Failed to fetch agent detail' }, { status: 500 })
  }
}
