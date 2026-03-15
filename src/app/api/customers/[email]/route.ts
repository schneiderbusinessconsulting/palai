import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Customer detail — all emails, sentiment timeline, buying intent trend.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params
    const decodedEmail = decodeURIComponent(email)

    // Block access to own company emails
    const ownEmails = ['info@palacios-relations.ch', 'rafael@palacios-relations.ch', 'philipp@palacios-relations.ch', 'noreply@palacios-relations.ch']
    if (ownEmails.includes(decodedEmail.toLowerCase())) {
      return NextResponse.json({ customer: null, emails: [], timeline: [] })
    }

    const supabase = await createClient()

    const { data: emails, error } = await supabase
      .from('incoming_emails')
      .select('id, from_email, from_name, subject, received_at, status, tone_sentiment, buying_intent_score, priority, email_type, sla_status, support_level')
      .eq('from_email', decodedEmail)
      .order('received_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!emails?.length) {
      return NextResponse.json({ customer: null, emails: [], timeline: [] })
    }

    // Build customer summary
    const sentiments: Record<string, number> = {}
    let intentSum = 0
    let resolvedCount = 0

    for (const e of emails) {
      if (e.tone_sentiment) {
        sentiments[e.tone_sentiment] = (sentiments[e.tone_sentiment] || 0) + 1
      }
      intentSum += e.buying_intent_score || 0
      if (e.status === 'sent') resolvedCount++
    }

    const customer = {
      email: decodedEmail,
      name: emails.find(e => e.from_name)?.from_name || decodedEmail,
      totalEmails: emails.length,
      avgBuyingIntent: Math.round(intentSum / emails.length),
      dominantSentiment: Object.entries(sentiments).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral',
      sentiments,
      resolvedCount,
      firstContact: emails[emails.length - 1].received_at,
      lastContact: emails[0].received_at,
    }

    // Build timeline (sentiment + BI over time)
    const timeline = emails.map(e => ({
      date: e.received_at,
      sentiment: e.tone_sentiment || 'neutral',
      buyingIntent: e.buying_intent_score || 0,
      subject: e.subject,
      status: e.status,
    })).reverse()

    return NextResponse.json({ customer, emails, timeline })
  } catch (error) {
    console.error('Customer detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}
