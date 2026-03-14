import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface DailyStats {
  day: string
  total: number
  sent: number
  pending: number
  customer_inquiries: number
  system_mails: number
}

interface TopSender {
  sender: string
  email: string
  count: number
  answered: number
  open: number
}

interface TopicItem {
  topic: string
  count: number
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

    // Try using the DB function first (requires migration 006)
    const { data: summaryData, error: summaryError } = await supabase.rpc(
      'get_analytics_summary',
      { start_date: startDate, end_date: endDate }
    )

    let summary: ReturnType<typeof buildSummaryFallback> | typeof summaryData

    if (!summaryError && summaryData) {
      summary = summaryData
    } else {
      console.log('Analytics: Falling back to direct queries')
      summary = await buildSummaryFallback(supabase, startDate, endDate)
    }

    // Run remaining queries in parallel
    const [topSendersResult, topicsResult, biResult, learningResult] = await Promise.all([
      summaryError
        ? getTopSendersFallback(supabase, startDate, endDate)
        : supabase.rpc('get_top_senders', { start_date: startDate, end_date: endDate, sender_limit: 10 }).then(r => r.data),
      summaryError
        ? getTopicsFallback(supabase, startDate, endDate)
        : supabase.rpc('get_topic_distribution', { start_date: startDate, end_date: endDate, topic_limit: 10 }).then(r => r.data),
      getBiInsights(supabase, startDate, endDate),
      getLearningStats(supabase, startDate, endDate),
    ])

    return NextResponse.json({
      summary,
      topSenders: topSendersResult || [],
      topics: topicsResult || [],
      biInsights: biResult,
      learning: learningResult,
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

// --- Fallback helpers ---

async function buildSummaryFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  startDate: string,
  endDate: string
) {
  const { data: emails } = await supabase
    .from('incoming_emails')
    .select('id, from_email, from_name, subject, status, email_type, needs_response, received_at, priority, sla_status, tone_sentiment')
    .gte('received_at', `${startDate}T00:00:00`)
    .lte('received_at', `${endDate}T23:59:59`)
    .order('received_at', { ascending: false })

  const allEmails = emails || []
  const emailIds = allEmails.map((e: { id: string }) => e.id)

  let drafts: Array<{ email_id: string; status: string; confidence_score: number }> = []
  if (emailIds.length > 0) {
    const { data: draftData } = await supabase
      .from('email_drafts')
      .select('email_id, status, confidence_score')
      .in('email_id', emailIds)
    drafts = draftData || []
  }

  const dailyMap = new Map<string, DailyStats>()
  for (const email of allEmails) {
    const day = email.received_at.split('T')[0]
    const existing = dailyMap.get(day) || { day, total: 0, sent: 0, pending: 0, customer_inquiries: 0, system_mails: 0 }
    existing.total++
    if (email.status === 'sent') existing.sent++
    if (email.status === 'pending') existing.pending++
    if (email.email_type === 'customer_inquiry') existing.customer_inquiries++
    if (email.email_type === 'system_alert' || email.email_type === 'notification') existing.system_mails++
    dailyMap.set(day, existing)
  }

  return {
    period: {
      start: startDate,
      end: endDate,
      days: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
    },
    emails: {
      total: allEmails.length,
      sent: allEmails.filter((e: { status: string }) => e.status === 'sent').length,
      pending: allEmails.filter((e: { status: string }) => e.status === 'pending').length,
      draft_ready: allEmails.filter((e: { status: string }) => e.status === 'draft_ready').length,
      rejected: allEmails.filter((e: { status: string }) => e.status === 'rejected').length,
      customer_inquiries: allEmails.filter((e: { email_type: string }) => e.email_type === 'customer_inquiry').length,
      form_submissions: allEmails.filter((e: { email_type: string }) => e.email_type === 'form_submission').length,
      system_mails: allEmails.filter((e: { email_type: string }) => e.email_type === 'system_alert' || e.email_type === 'notification').length,
      needs_response: allEmails.filter((e: { needs_response: boolean }) => e.needs_response).length,
    },
    drafts: {
      total: drafts.length,
      approved: drafts.filter(d => d.status === 'approved').length,
      edited: drafts.filter(d => d.status === 'edited').length,
      rejected: drafts.filter(d => d.status === 'rejected').length,
      avg_confidence: drafts.length > 0 ? Math.round((drafts.reduce((s, d) => s + (d.confidence_score || 0), 0) / drafts.length) * 100) / 100 : 0,
      high_confidence: drafts.filter(d => d.confidence_score >= 0.85).length,
      medium_confidence: drafts.filter(d => d.confidence_score >= 0.7 && d.confidence_score < 0.85).length,
      low_confidence: drafts.filter(d => d.confidence_score < 0.7).length,
    },
    response_times: { avg_first_response_minutes: 0, avg_resolution_minutes: 0 },
    sla: {
      ok: allEmails.filter((e: { sla_status: string }) => e.sla_status === 'ok').length,
      at_risk: allEmails.filter((e: { sla_status: string }) => e.sla_status === 'at_risk').length,
      breached: allEmails.filter((e: { sla_status: string }) => e.sla_status === 'breached').length,
    },
    tone: {
      positive: allEmails.filter((e: { tone_sentiment: string }) => e.tone_sentiment === 'positive').length,
      neutral: allEmails.filter((e: { tone_sentiment: string }) => e.tone_sentiment === 'neutral').length,
      negative: allEmails.filter((e: { tone_sentiment: string }) => e.tone_sentiment === 'negative').length,
      frustrated: allEmails.filter((e: { tone_sentiment: string }) => e.tone_sentiment === 'frustrated').length,
    },
    daily: Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTopSendersFallback(supabase: any, startDate: string, endDate: string): Promise<TopSender[]> {
  const { data: emails } = await supabase
    .from('incoming_emails')
    .select('from_email, from_name, status, email_type')
    .gte('received_at', `${startDate}T00:00:00`)
    .lte('received_at', `${endDate}T23:59:59`)

  const senderMap = new Map<string, TopSender>()
  for (const email of (emails || [])) {
    if (email.email_type === 'system_alert' || email.email_type === 'notification') continue
    const existing = senderMap.get(email.from_email) || { sender: email.from_name || email.from_email, email: email.from_email, count: 0, answered: 0, open: 0 }
    existing.count++
    if (email.status === 'sent') existing.answered++
    if (email.status === 'pending' || email.status === 'draft_ready') existing.open++
    senderMap.set(email.from_email, existing)
  }
  return Array.from(senderMap.values()).sort((a, b) => b.count - a.count).slice(0, 10)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTopicsFallback(supabase: any, startDate: string, endDate: string): Promise<TopicItem[]> {
  const { data: emails } = await supabase
    .from('incoming_emails')
    .select('subject, email_type, topic_cluster')
    .gte('received_at', `${startDate}T00:00:00`)
    .lte('received_at', `${endDate}T23:59:59`)

  const topicMap = new Map<string, number>()
  for (const email of (emails || [])) {
    if (email.email_type === 'system_alert' || email.email_type === 'notification') continue
    if (email.topic_cluster) {
      topicMap.set(email.topic_cluster, (topicMap.get(email.topic_cluster) || 0) + 1)
      continue
    }
    const s = (email.subject || '').toLowerCase()
    let topic = 'Sonstiges'
    if (s.includes('hypnose')) topic = 'Hypnose-Ausbildung'
    else if (s.includes('meditation')) topic = 'Meditation'
    else if (s.includes('coach') || s.includes('life')) topic = 'Life Coaching'
    else if (s.includes('preis') || s.includes('kosten') || s.includes('rate') || s.includes('zahlung')) topic = 'Preise & Zahlung'
    else if (s.includes('termin') || s.includes('datum') || s.includes('wann') || s.includes('start')) topic = 'Termine & Daten'
    else if (s.includes('zertifik') || s.includes('diplom') || s.includes('abschluss')) topic = 'Zertifizierung'
    else if (s.includes('anmeld') || s.includes('registr') || s.includes('buchung')) topic = 'Anmeldung'
    else if (s.includes('formular') || s.includes('kontakt')) topic = 'Kontaktformular'
    topicMap.set(topic, (topicMap.get(topic) || 0) + 1)
  }
  return Array.from(topicMap.entries()).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count).slice(0, 10)
}

// Phase 3: BI Insights summary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBiInsights(supabase: any, startDate: string, endDate: string) {
  try {
    const { data } = await supabase
      .from('bi_insights')
      .select('insight_type, confidence')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    if (!data) return { buying_signals: 0, objections: 0, churn_risk: 0, total: 0, recent: [] }

    return {
      buying_signals: data.filter((i: { insight_type: string }) => i.insight_type === 'buying_signal').length,
      objections: data.filter((i: { insight_type: string }) => i.insight_type === 'objection').length,
      churn_risk: data.filter((i: { insight_type: string }) => i.insight_type === 'churn_risk').length,
      total: data.length,
    }
  } catch {
    return { buying_signals: 0, objections: 0, churn_risk: 0, total: 0 }
  }
}

// Phase 2: Learning cases summary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLearningStats(supabase: any, startDate: string, endDate: string) {
  try {
    const { data } = await supabase
      .from('learning_cases')
      .select('edit_distance, status, knowledge_extracted')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)

    if (!data) return { total: 0, pending: 0, extracted: 0, avg_edit_distance: 0 }

    const pending = data.filter((c: { status: string }) => c.status === 'pending').length
    const extracted = data.filter((c: { knowledge_extracted: boolean }) => c.knowledge_extracted).length
    const avgDist = data.length > 0
      ? Math.round((data.reduce((s: number, c: { edit_distance: number }) => s + (c.edit_distance || 0), 0) / data.length) * 100)
      : 0

    return { total: data.length, pending, extracted, avg_edit_distance: avgDist }
  } catch {
    return { total: 0, pending: 0, extracted: 0, avg_edit_distance: 0 }
  }
}
