import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Export reports as CSV or JSON.
 * Supports: emails, insights summary, customers.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const type = searchParams.get('type') || 'emails'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = await createClient()

    let data: Record<string, unknown>[] = []
    let filename = 'export'

    if (type === 'emails') {
      let query = supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, status, email_type, priority, tone_sentiment, buying_intent_score, sla_status, assigned_agent_id')
        .order('received_at', { ascending: false })
        .limit(1000)

      if (startDate) query = query.gte('received_at', startDate)
      if (endDate) query = query.lte('received_at', endDate)

      const { data: emails, error } = await query
      if (error) return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
      data = emails || []
      filename = `emails-export-${new Date().toISOString().substring(0, 10)}`

    } else if (type === 'insights') {
      // Aggregated insights
      const { data: emails } = await supabase
        .from('incoming_emails')
        .select('from_email, from_name, tone_sentiment, buying_intent_score, priority, sla_status, status, received_at')
        .in('email_type', ['customer_inquiry', 'form_submission'])
        .order('received_at', { ascending: false })
        .limit(500)

      if (startDate) {
        data = (emails || []).filter(e => new Date(e.received_at) >= new Date(startDate))
      } else {
        data = emails || []
      }
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
