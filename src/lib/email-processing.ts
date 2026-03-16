/**
 * Shared email processing pipeline.
 * Used by both webhook handler and polling import to ensure consistent classification.
 * All functions are rule-based (no API cost) except classifyEmail which has AI fallback.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { classifyEmail } from '@/lib/ai/openai'
import {
  analyzeTone,
  determinePriority,
  calculateHappinessScore,
  detectSpam,
  detectTopicTags,
} from '@/lib/text-utils'

function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface ProcessResult {
  emailType: string
  needsResponse: boolean
  priority: string
  toneSentiment: string
  toneFormality: string
  toneUrgency: string
  happinessScore: number
  isSpam: boolean
  spamScore: number
  topicTags: string[]
  buyingIntentScore: number
}

/**
 * Process a single email: classify, analyze tone, detect spam, topics, buying intent.
 * Updates the email record in DB with all computed fields.
 * Called from webhook handler and polling import.
 */
export async function processNewEmail(
  emailId: string,
  fromEmail: string,
  subject: string,
  bodyText: string
): Promise<ProcessResult> {
  const supabase = getSupabaseAdmin()

  // 1. Classification (pattern-based, AI fallback)
  const classification = await classifyEmail(fromEmail, subject, bodyText)

  // 2. Tone analysis (rule-based, free)
  const tone = analyzeTone(subject, bodyText)
  const happinessScore = calculateHappinessScore(subject, bodyText)

  // 3. Spam detection + topic tags (rule-based, free)
  const spamResult = detectSpam(fromEmail, subject, bodyText)
  const topicTags = detectTopicTags(subject, bodyText)

  // 4. Priority + SLA
  const priority = determinePriority(classification.emailType, tone.urgency, classification.needsResponse)

  // 5. Fetch SLA target ID
  let slaTargetId: string | null = null
  try {
    const { data: targets } = await supabase.from('sla_targets').select('id, priority')
    if (targets) {
      const slaMap: Record<string, string> = {}
      for (const t of targets) slaMap[t.priority] = t.id
      slaTargetId = slaMap[priority] || null
    }
  } catch { /* SLA table may not exist */ }

  // 6. Update email with all computed fields
  await supabase
    .from('incoming_emails')
    .update({
      email_type: classification.emailType,
      needs_response: classification.needsResponse,
      classification_reason: classification.reason,
      priority,
      sla_target_id: slaTargetId,
      sla_status: classification.needsResponse ? 'ok' : null,
      tone_formality: tone.formality,
      tone_sentiment: tone.sentiment,
      tone_urgency: tone.urgency,
      happiness_score: happinessScore,
      is_spam: spamResult.isSpam,
      spam_score: spamResult.spamScore,
      topic_tags: topicTags,
    })
    .eq('id', emailId)

  // 7. BI scanning (background, fire-and-forget)
  let buyingIntentScore = 0
  if (classification.emailType === 'customer_inquiry' || classification.emailType === 'form_submission') {
    buyingIntentScore = await scanForBiInsights(emailId, subject, bodyText, {
      urgency: tone.urgency,
      sentiment: tone.sentiment,
    })
    if (buyingIntentScore > 0) {
      await supabase
        .from('incoming_emails')
        .update({ buying_intent_score: buyingIntentScore })
        .eq('id', emailId)
    }
  }

  return {
    emailType: classification.emailType,
    needsResponse: classification.needsResponse,
    priority,
    toneSentiment: tone.sentiment,
    toneFormality: tone.formality,
    toneUrgency: tone.urgency,
    happinessScore,
    isSpam: spamResult.isSpam,
    spamScore: spamResult.spamScore,
    topicTags,
    buyingIntentScore,
  }
}

/** BI trigger word scanning */
async function scanForBiInsights(
  emailId: string,
  subject: string,
  bodyText: string,
  tone: { urgency?: string; sentiment?: string }
): Promise<number> {
  try {
    const supabase = getSupabaseAdmin()
    const { data: triggerWords } = await supabase
      .from('bi_trigger_words')
      .select('word, category, weight')
      .eq('is_active', true)

    if (!triggerWords?.length) return 0

    const text = `${subject} ${bodyText}`.toLowerCase()
    const insightsToInsert: Array<{
      email_id: string
      insight_type: string
      content: string
      confidence: number
      metadata: Record<string, unknown>
    }> = []

    let buyingCount = 0
    let objectionCount = 0
    let churnCount = 0

    for (const tw of triggerWords) {
      if (text.includes(tw.word.toLowerCase())) {
        insightsToInsert.push({
          email_id: emailId,
          insight_type: tw.category,
          content: `Erkanntes Muster: "${tw.word}"`,
          confidence: Math.min(tw.weight / 2, 1.0),
          metadata: { trigger_word: tw.word, weight: tw.weight },
        })
        if (tw.category === 'buying_signal') buyingCount++
        else if (tw.category === 'objection') objectionCount++
        else if (tw.category === 'churn_risk') churnCount++
      }
    }

    if (insightsToInsert.length > 0) {
      await supabase.from('bi_insights').insert(insightsToInsert)
    }

    const urgencyScore =
      tone.urgency === 'critical' ? 25 :
      tone.urgency === 'high' ? 18 :
      tone.urgency === 'medium' ? 10 : 0
    const sentimentScore =
      tone.sentiment === 'positive' ? 20 :
      tone.sentiment === 'neutral' ? 10 : 0

    return Math.max(0, Math.min(100,
      Math.min(buyingCount * 20, 60) + urgencyScore + sentimentScore - objectionCount * 8 - churnCount * 20
    ))
  } catch {
    return 0
  }
}
