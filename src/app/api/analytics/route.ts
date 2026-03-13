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
    case '24h':
      start.setHours(start.getHours() - 24)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '90d':
      start.setDate(start.getDate() - 90)
      break
    case '30d':
    default:
      start.setDate(start.getDate() - 30)
      break
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

    if (!summaryError && summaryData) {
      // DB functions available — use them
      const [topSendersResult, topicsResult] = await Promise.all([
        supabase.rpc('get_top_senders', {
          start_date: startDate,
          end_date: endDate,
          sender_limit: 10,
        }),
        supabase.rpc('get_topic_distribution', {
          start_date: startDate,
          end_date: endDate,
          topic_limit: 10,
        }),
      ])

      return NextResponse.json({
        summary: summaryData,
        topSenders: topSendersResult.data || [],
        topics: topicsResult.data || [],
      })
    }

    // Fallback: Direct queries (works without migration 006)
    console.log('Analytics: Falling back to direct queries (migration 006 not yet applied)')

    // Fetch all emails in range
    const { data: emails, error: emailError } = await supabase
      .from('incoming_emails')
      .select('id, from_email, from_name, subject, status, email_type, needs_response, received_at')
      .gte('received_at', `${startDate}T00:00:00`)
      .lte('received_at', `${endDate}T23:59:59`)
      .order('received_at', { ascending: false })

    if (emailError) {
      console.error('Analytics email fetch error:', emailError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const allEmails = emails || []

    // Fetch drafts for these emails
    const emailIds = allEmails.map(e => e.id)
    let drafts: Array<{ email_id: string; status: string; confidence_score: number }> = []

    if (emailIds.length > 0) {
      const { data: draftData } = await supabase
        .from('email_drafts')
        .select('email_id, status, confidence_score')
        .in('email_id', emailIds)

      drafts = draftData || []
    }

    // Calculate summary
    const totalEmails = allEmails.length
    const sentCount = allEmails.filter(e => e.status === 'sent').length
    const pendingCount = allEmails.filter(e => e.status === 'pending').length
    const draftReadyCount = allEmails.filter(e => e.status === 'draft_ready').length
    const rejectedCount = allEmails.filter(e => e.status === 'rejected').length
    const customerInquiries = allEmails.filter(e => e.email_type === 'customer_inquiry').length
    const formSubmissions = allEmails.filter(e => e.email_type === 'form_submission').length
    const systemMails = allEmails.filter(e => e.email_type === 'system_alert' || e.email_type === 'notification').length
    const needsResponseCount = allEmails.filter(e => e.needs_response).length

    // Draft stats
    const approvedDrafts = drafts.filter(d => d.status === 'approved').length
    const editedDrafts = drafts.filter(d => d.status === 'edited').length
    const rejectedDrafts = drafts.filter(d => d.status === 'rejected').length
    const avgConfidence = drafts.length > 0
      ? Math.round((drafts.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / drafts.length) * 100) / 100
      : 0
    const highConfidence = drafts.filter(d => d.confidence_score >= 0.85).length
    const medConfidence = drafts.filter(d => d.confidence_score >= 0.7 && d.confidence_score < 0.85).length
    const lowConfidence = drafts.filter(d => d.confidence_score < 0.7).length

    // Daily breakdown
    const dailyMap = new Map<string, DailyStats>()
    for (const email of allEmails) {
      const day = email.received_at.split('T')[0]
      const existing = dailyMap.get(day) || {
        day,
        total: 0,
        sent: 0,
        pending: 0,
        customer_inquiries: 0,
        system_mails: 0,
      }
      existing.total++
      if (email.status === 'sent') existing.sent++
      if (email.status === 'pending') existing.pending++
      if (email.email_type === 'customer_inquiry') existing.customer_inquiries++
      if (email.email_type === 'system_alert' || email.email_type === 'notification') existing.system_mails++
      dailyMap.set(day, existing)
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day))

    // Top senders (exclude system mails)
    const senderMap = new Map<string, TopSender>()
    for (const email of allEmails) {
      if (email.email_type === 'system_alert' || email.email_type === 'notification') continue
      const key = email.from_email
      const existing = senderMap.get(key) || {
        sender: email.from_name || email.from_email,
        email: email.from_email,
        count: 0,
        answered: 0,
        open: 0,
      }
      existing.count++
      if (email.status === 'sent') existing.answered++
      if (email.status === 'pending' || email.status === 'draft_ready') existing.open++
      senderMap.set(key, existing)
    }
    const topSenders = Array.from(senderMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Topic distribution (subject-based)
    const topicMap = new Map<string, number>()
    for (const email of allEmails) {
      if (email.email_type === 'system_alert' || email.email_type === 'notification') continue
      const subject = (email.subject || '').toLowerCase()
      let topic = 'Sonstiges'
      if (subject.includes('hypnose')) topic = 'Hypnose-Ausbildung'
      else if (subject.includes('meditation')) topic = 'Meditation'
      else if (subject.includes('coach') || subject.includes('life')) topic = 'Life Coaching'
      else if (subject.includes('preis') || subject.includes('kosten') || subject.includes('rate') || subject.includes('zahlung')) topic = 'Preise & Zahlung'
      else if (subject.includes('termin') || subject.includes('datum') || subject.includes('wann') || subject.includes('start')) topic = 'Termine & Daten'
      else if (subject.includes('zertifik') || subject.includes('diplom') || subject.includes('abschluss')) topic = 'Zertifizierung'
      else if (subject.includes('anmeld') || subject.includes('registr') || subject.includes('buchung')) topic = 'Anmeldung'
      else if (subject.includes('formular') || subject.includes('kontakt')) topic = 'Kontaktformular'
      topicMap.set(topic, (topicMap.get(topic) || 0) + 1)
    }
    const topics: TopicItem[] = Array.from(topicMap.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const summary = {
      period: { start: startDate, end: endDate, days: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 },
      emails: {
        total: totalEmails,
        sent: sentCount,
        pending: pendingCount,
        draft_ready: draftReadyCount,
        rejected: rejectedCount,
        customer_inquiries: customerInquiries,
        form_submissions: formSubmissions,
        system_mails: systemMails,
        needs_response: needsResponseCount,
      },
      drafts: {
        total: drafts.length,
        approved: approvedDrafts,
        edited: editedDrafts,
        rejected: rejectedDrafts,
        avg_confidence: avgConfidence,
        high_confidence: highConfidence,
        medium_confidence: medConfidence,
        low_confidence: lowConfidence,
      },
      response_times: {
        avg_first_response_minutes: 0,
        avg_resolution_minutes: 0,
      },
      sla: { ok: 0, at_risk: 0, breached: 0 },
      daily,
    }

    return NextResponse.json({
      summary,
      topSenders,
      topics,
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
