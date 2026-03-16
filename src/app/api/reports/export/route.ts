import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Export reports as CSV or JSON.
 * Supports: emails, email-overview, insights, sla, csat, buying-intent, team-performance.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const type = searchParams.get('type') || 'emails'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const period = searchParams.get('period') || '30d'

    const supabase = await createClient()

    // Calculate period-based start date if no explicit start_date
    let effectiveStartDate = startDate
    if (!effectiveStartDate && period) {
      const daysNum = period === '7d' ? 7 : period === '90d' ? 90 : 30
      const d = new Date()
      d.setDate(d.getDate() - daysNum)
      effectiveStartDate = d.toISOString()
    }

    let data: Record<string, unknown>[] = []
    let filename = 'export'

    if (type === 'emails' || type === 'email-overview') {
      let query = supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, status, email_type, priority, tone_sentiment, buying_intent_score, sla_status, assigned_agent_id')
        .order('received_at', { ascending: false })
        .limit(1000)

      if (effectiveStartDate) query = query.gte('received_at', effectiveStartDate)
      if (endDate) query = query.lte('received_at', endDate)

      const { data: emails, error } = await query
      if (error) return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
      data = emails || []
      filename = `emails-export-${new Date().toISOString().substring(0, 10)}`

    } else if (type === 'sla') {
      let query = supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, status, priority, sla_status, first_response_at, resolved_at')
        .not('sla_status', 'is', null)
        .order('received_at', { ascending: false })
        .limit(1000)

      if (effectiveStartDate) query = query.gte('received_at', effectiveStartDate)

      const { data: emails } = await query
      data = (emails || []).map(e => ({
        ...e,
        response_time_min: e.first_response_at && e.received_at
          ? Math.round((new Date(e.first_response_at).getTime() - new Date(e.received_at).getTime()) / 60000)
          : null,
      }))
      filename = `sla-report-${new Date().toISOString().substring(0, 10)}`

    } else if (type === 'csat') {
      let query = supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, tone_sentiment, happiness_score, sla_status')
        .not('tone_sentiment', 'is', null)
        .order('received_at', { ascending: false })
        .limit(1000)

      if (effectiveStartDate) query = query.gte('received_at', effectiveStartDate)

      const { data: emails } = await query

      // Also fetch CSAT ratings
      const { data: csatRatings } = await supabase
        .from('csat_ratings')
        .select('email_id, rating, comment')

      const csatMap = new Map((csatRatings || []).map(r => [r.email_id, r]))

      data = (emails || []).map(e => {
        const csat = csatMap.get(e.id)
        return {
          ...e,
          csat_rating: csat?.rating ?? null,
          csat_comment: csat?.comment ?? null,
        }
      })
      filename = `csat-report-${new Date().toISOString().substring(0, 10)}`

    } else if (type === 'buying-intent') {
      let query = supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, status, buying_intent_score, email_type, topic_tags')
        .gt('buying_intent_score', 0)
        .order('buying_intent_score', { ascending: false })
        .limit(500)

      if (effectiveStartDate) query = query.gte('received_at', effectiveStartDate)

      const { data: emails } = await query
      data = (emails || []).map(e => ({
        ...e,
        topic_tags: Array.isArray(e.topic_tags) ? (e.topic_tags as string[]).join(', ') : '',
        intent_level: (e.buying_intent_score || 0) >= 60 ? 'Hot' : (e.buying_intent_score || 0) >= 30 ? 'Warm' : 'Cold',
      }))
      filename = `buying-intent-${new Date().toISOString().substring(0, 10)}`

    } else if (type === 'team-performance') {
      let query = supabase
        .from('incoming_emails')
        .select('id, from_email, subject, received_at, status, assigned_agent_id, first_response_at, resolved_at, priority')
        .not('assigned_agent_id', 'is', null)
        .order('received_at', { ascending: false })
        .limit(1000)

      if (effectiveStartDate) query = query.gte('received_at', effectiveStartDate)

      const { data: emails } = await query
      data = (emails || []).map(e => ({
        ...e,
        response_time_min: e.first_response_at && e.received_at
          ? Math.round((new Date(e.first_response_at).getTime() - new Date(e.received_at).getTime()) / 60000)
          : null,
      }))
      filename = `team-performance-${new Date().toISOString().substring(0, 10)}`

    } else if (type === 'insights') {
      let query = supabase
        .from('incoming_emails')
        .select('from_email, from_name, tone_sentiment, buying_intent_score, priority, sla_status, status, received_at')
        .in('email_type', ['customer_inquiry', 'form_submission'])
        .order('received_at', { ascending: false })
        .limit(500)

      if (effectiveStartDate) query = query.gte('received_at', effectiveStartDate)

      const { data: emails } = await query
      data = emails || []
      filename = `insights-export-${new Date().toISOString().substring(0, 10)}`
    }

    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      })
    }

    // CSV format
    if (data.length === 0) {
      return new NextResponse('Keine Daten vorhanden', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(';'),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          const str = String(val)
          return str.includes(';') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(';')
      ),
    ]

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
