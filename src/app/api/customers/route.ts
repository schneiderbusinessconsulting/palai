import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Customer profiles aggregated from incoming_emails.
 * No separate customer table needed — aggregates by from_email.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get all customer emails (excluding system/notification and own emails)
    let query = supabase
      .from('incoming_emails')
      .select('id, from_email, from_name, subject, received_at, status, tone_sentiment, buying_intent_score, priority')
      .in('email_type', ['customer_inquiry', 'form_submission'])
      .not('from_email', 'in', '("info@palacios-relations.ch","rafael@palacios-relations.ch","philipp@palacios-relations.ch","noreply@palacios-relations.ch")')
      .order('received_at', { ascending: false })
      .limit(500)

    if (search) {
      const sanitized = search.replace(/[%_]/g, '\\$&').substring(0, 100)
      query = query.or(`from_email.ilike.%${sanitized}%,from_name.ilike.%${sanitized}%`)
    }

    const { data: emails, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 })
    }

    if (!emails?.length) {
      return NextResponse.json({ customers: [] })
    }

    // Aggregate by from_email
    const customerMap = new Map<string, {
      email: string
      name: string
      totalEmails: number
      sentiments: Record<string, number>
      avgBuyingIntent: number
      intentSum: number
      lastContact: string
      resolvedCount: number
    }>()

    for (const e of emails) {
      const key = e.from_email.toLowerCase()
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          email: e.from_email,
          name: e.from_name || e.from_email,
          totalEmails: 0,
          sentiments: {},
          avgBuyingIntent: 0,
          intentSum: 0,
          lastContact: e.received_at,
          resolvedCount: 0,
        })
      }
      const c = customerMap.get(key)!
      c.totalEmails++
      if (e.from_name && c.name === c.email) c.name = e.from_name
      if (e.tone_sentiment) {
        c.sentiments[e.tone_sentiment] = (c.sentiments[e.tone_sentiment] || 0) + 1
      }
      c.intentSum += e.buying_intent_score || 0
      if (e.status === 'sent') c.resolvedCount++
      if (new Date(e.received_at) > new Date(c.lastContact)) {
        c.lastContact = e.received_at
      }
    }

    const customers = Array.from(customerMap.values())
      .map(c => ({
        ...c,
        avgBuyingIntent: c.totalEmails > 0 ? Math.round(c.intentSum / c.totalEmails) : 0,
        dominantSentiment: Object.entries(c.sentiments).sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral',
      }))
      .sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime())
      .slice(0, limit)

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('Customers API error:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}
