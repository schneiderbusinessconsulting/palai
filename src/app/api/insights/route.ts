import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Own company emails to exclude from insights
const OWN_EMAILS = ['info@palacios-relations.ch', 'rafael@palacios-relations.ch', 'philipp@palacios-relations.ch', 'noreply@palacios-relations.ch']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Parse period parameter
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const daysNum = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysNum)
    const startDateStr = startDate.toISOString()

    // Fetch all needed data in parallel
    const [
      emailsRes,
      biInsightsRes,
      csatRes,
      learningRes,
      chunksRes,
    ] = await Promise.all([
      // Emails with buying intent, tone, priority, status — filtered by period
      supabase
        .from('incoming_emails')
        .select('id, from_email, from_name, subject, received_at, status, email_type, needs_response, buying_intent_score, tone_sentiment, tone_urgency, priority, sla_status')
        .gte('received_at', startDateStr)
        .not('from_email', 'in', `("${OWN_EMAILS.join('","')}")`)
        .order('received_at', { ascending: false })
        .limit(500),

      // BI insights — filtered by period
      supabase
        .from('bi_insights')
        .select('email_id, insight_type, content, confidence, metadata')
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: false })
        .limit(1000),

      // CSAT ratings — filtered by period
      supabase
        .from('csat_ratings')
        .select('email_id, rating, created_at')
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: false })
        .limit(200),

      // Learning cases — filtered by period
      supabase
        .from('learning_cases')
        .select('email_id, edit_distance, status, created_at')
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: false })
        .limit(100),

      // Knowledge base chunk count (all types)
      supabase
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true }),
    ])

    const allEmails = emailsRes.data || []
    // Filter out system mails in JS (Supabase neq/not excludes NULLs)
    const emails = allEmails.filter(e =>
      e.email_type !== 'system_alert' && e.email_type !== 'notification'
    )
    const biInsights = biInsightsRes.data || []
    const csatRatings = csatRes.data || []
    const learningCases = learningRes.data || []
    const kbChunkCount = chunksRes.count || 0

    // ── MARKETING: BI signals ──────────────────────────────────────────────────
    const biByCategory: Record<string, number> = {}
    for (const insight of biInsights) {
      biByCategory[insight.insight_type] = (biByCategory[insight.insight_type] || 0) + 1
    }

    // Buying intent distribution (0-30 / 31-60 / 61-100)
    const buyingIntentDistribution = {
      low: 0,   // 0-30
      medium: 0, // 31-60
      high: 0,   // 61-100
    }
    for (const email of emails) {
      const score = email.buying_intent_score || 0
      if (score > 60) buyingIntentDistribution.high++
      else if (score > 30) buyingIntentDistribution.medium++
      else buyingIntentDistribution.low++
    }

    // Topic distribution from subjects (simple keyword clustering)
    const topicKeywords: Record<string, string[]> = {
      'Hypnose-Ausbildung': ['hypnose', 'hypnotis'],
      'Meditation': ['meditation', 'meditier'],
      'Life Coaching': ['coaching', 'coach'],
      'Preise & Kosten': ['preis', 'kosten', 'zahlung', 'bezahl', 'rate'],
      'Anmeldung': ['anmeld', 'registrier', 'einschreib'],
      'Termine': ['termin', 'datum', 'wann', 'kurs'],
      'Zertifikat': ['zertifikat', 'diplom', 'abschluss'],
    }
    const topicCounts: Record<string, number> = {}
    for (const email of emails) {
      const text = `${email.subject || ''} `.toLowerCase()
      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(k => text.includes(k))) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1
        }
      }
    }

    // ── SALES: Hot leads, churn risks, upsell ────────────────────────────────
    const hotLeads = emails
      .filter(e => (e.buying_intent_score || 0) >= 60 && e.status !== 'sent')
      .map(e => ({
        id: e.id,
        from_name: e.from_name,
        from_email: e.from_email,
        subject: e.subject,
        buying_intent_score: e.buying_intent_score,
        received_at: e.received_at,
        status: e.status,
      }))
      .slice(0, 20)

    // Churn risks: emails with churn_risk BI insights
    const churnEmailIds = new Set(
      biInsights
        .filter(b => b.insight_type === 'churn_risk')
        .map(b => b.email_id)
    )
    const churnRisks = emails
      .filter(e => churnEmailIds.has(e.id) && e.status !== 'sent')
      .map(e => ({
        id: e.id,
        from_name: e.from_name,
        from_email: e.from_email,
        subject: e.subject,
        received_at: e.received_at,
        status: e.status,
      }))
      .slice(0, 10)

    // Upsell opportunities: buying_signal with already-sent emails
    const upsellEmailIds = new Set(
      biInsights
        .filter(b => b.insight_type === 'buying_signal')
        .map(b => b.email_id)
    )
    const upsellOpportunities = emails
      .filter(e => upsellEmailIds.has(e.id) && e.status === 'sent')
      .map(e => ({
        id: e.id,
        from_name: e.from_name,
        from_email: e.from_email,
        subject: e.subject,
        received_at: e.received_at,
        buying_intent_score: e.buying_intent_score,
      }))
      .slice(0, 10)

    // ── PRODUCT: Knowledge gaps ───────────────────────────────────────────────
    // Emails with learning cases (high edit distance = AI didn't know the answer)
    const knowledgeGapEmailIds = new Set(
      learningCases
        .filter(lc => lc.edit_distance > 0.3)
        .map(lc => lc.email_id)
    )
    const knowledgeGaps = emails
      .filter(e => knowledgeGapEmailIds.has(e.id))
      .map(e => ({
        id: e.id,
        subject: e.subject,
        from_email: e.from_email,
        received_at: e.received_at,
      }))
      .slice(0, 15)

    // ── SENTIMENT: Distribution + CSAT trend ─────────────────────────────────
    const sentimentDist = { positive: 0, neutral: 0, negative: 0 }
    const sentimentEmails: Record<string, Array<{ id: string; from_name?: string; from_email: string; subject: string; received_at: string }>> = {
      positive: [], neutral: [], negative: [],
    }
    for (const email of emails) {
      const s = email.tone_sentiment as keyof typeof sentimentDist
      if (s in sentimentDist) {
        sentimentDist[s]++
        sentimentEmails[s].push({
          id: email.id,
          from_name: email.from_name,
          from_email: email.from_email,
          subject: email.subject,
          received_at: email.received_at,
        })
      }
    }

    // CSAT average and last 7 days trend
    const csatAvg = csatRatings.length > 0
      ? csatRatings.reduce((sum, r) => sum + r.rating, 0) / csatRatings.length
      : null

    // Weekly CSAT trend (last 4 weeks)
    const csatByWeek: Record<string, { total: number; count: number }> = {}
    for (const r of csatRatings) {
      const d = new Date(r.created_at)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().substring(0, 10)
      if (!csatByWeek[key]) csatByWeek[key] = { total: 0, count: 0 }
      csatByWeek[key].total += r.rating
      csatByWeek[key].count++
    }
    const csatTrend = Object.entries(csatByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([week, data]) => ({
        week,
        avg: Math.round((data.total / data.count) * 10) / 10,
        count: data.count,
      }))

    // SLA compliance
    const slaEmails = emails.filter(e => e.sla_status)
    const slaOk = slaEmails.filter(e => e.sla_status === 'ok').length
    const slaBreached = slaEmails.filter(e => e.sla_status === 'breached').length

    // Drill-down email lists
    const mapEmail = (e: typeof emails[0]) => ({
      id: e.id, from_name: e.from_name, from_email: e.from_email, subject: e.subject, received_at: e.received_at,
    })
    const slaOkEmails = slaEmails.filter(e => e.sla_status === 'ok').map(mapEmail)
    const slaBreachedEmails = slaEmails.filter(e => e.sla_status === 'breached').map(mapEmail)
    const pendingEmailsList = emails.filter(e => e.status === 'pending' || e.status === 'draft_ready').map(mapEmail)
    const sentEmailsList = emails.filter(e => e.status === 'sent').map(mapEmail)

    // Summary stats
    const totalEmails = emails.length
    const pendingEmails = emails.filter(e => e.status === 'pending' || e.status === 'draft_ready').length
    const sentEmails = emails.filter(e => e.status === 'sent').length

    return NextResponse.json({
      summary: {
        totalEmails,
        pendingEmails,
        sentEmails,
        kbChunkCount,
        csatAvg: csatAvg ? Math.round(csatAvg * 10) / 10 : null,
        slaOk,
        slaBreached,
      },
      marketing: {
        biByCategory,
        buyingIntentDistribution,
        topicCounts,
      },
      sales: {
        hotLeads,
        churnRisks,
        upsellOpportunities,
      },
      product: {
        knowledgeGaps,
        topicCounts,
      },
      sentiment: {
        distribution: sentimentDist,
        emails: sentimentEmails,
        csatAvg,
        csatTrend,
      },
      drilldown: {
        slaOk: slaOkEmails,
        slaBreached: slaBreachedEmails,
        pending: pendingEmailsList,
        sent: sentEmailsList,
      },
    })
  } catch (error) {
    console.error('Insights API error:', error)
    return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 })
  }
}
