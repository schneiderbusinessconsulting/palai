/**
 * Text utilities for self-learning and tone analysis
 */

/**
 * Word-level edit distance (normalized 0.0 = identical, 1.0 = completely different)
 * Uses LCS on word tokens — fast for typical email lengths (50–300 words)
 */
export function wordEditDistance(s1: string, s2: string): number {
  const words1 = s1.trim().split(/\s+/).filter(Boolean)
  const words2 = s2.trim().split(/\s+/).filter(Boolean)

  const n = words1.length
  const m = words2.length

  if (n === 0 && m === 0) return 0
  if (n === 0 || m === 0) return 1

  // LCS dynamic programming
  const dp: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (words1[i - 1].toLowerCase() === words2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const lcs = dp[n][m]
  const similarity = (2 * lcs) / (n + m)
  return Math.round((1 - similarity) * 100) / 100 // round to 2 decimal places
}

export type ToneSentiment = 'positive' | 'neutral' | 'negative' | 'frustrated'
export type ToneUrgency = 'low' | 'medium' | 'high' | 'critical'
export type ToneFormality = 'formal' | 'informal'

export interface ToneAnalysis {
  formality: ToneFormality
  sentiment: ToneSentiment
  urgency: ToneUrgency
}

/**
 * Rule-based tone analysis — no API calls, instant
 */
export function analyzeTone(subject: string, bodyText: string): ToneAnalysis {
  const text = `${subject} ${bodyText}`.toLowerCase()

  // --- Urgency ---
  let urgency: ToneUrgency = 'medium'
  if (/\bdringend\b|\bnotfall\b|\bsofort\b|\basap\b|\bdringlichst\b|\bkritisch\b/.test(text)) {
    urgency = 'critical'
  } else if (/\brasch\b|\bschnell\b|\bbaldmöglich|\bzeitnah\b|\bbald\b|\bbitte bald\b/.test(text)) {
    urgency = 'high'
  } else if (/\bkeine eile\b|\bwann immer\b|\bwenn möglich\b|\bkein stress\b/.test(text)) {
    urgency = 'low'
  }

  // --- Sentiment ---
  let sentiment: ToneSentiment = 'neutral'
  if (
    /\bfrustriert\b|\bunzumutbar\b|\binakzeptabel\b|\bärgerlich\b|\benttäuscht\b|\bskandal\b|\bkatastrophe\b/.test(text)
  ) {
    sentiment = 'frustrated'
  } else if (
    /\bleider\b|\bunzufrieden\b|\bbeschwerde\b|\bproblem\b|\bfehler\b|\bschade\b|\bnicht gut\b/.test(text)
  ) {
    sentiment = 'negative'
  } else if (
    /\btoll\b|\bsuper\b|\bwunderbar\b|\bfantastisch\b|\bbegeistert\b|\bfreue mich\b|\bvielen dank\b|\bhervorragend\b|\bperfekt\b/.test(text)
  ) {
    sentiment = 'positive'
  }

  // --- Formality (Sie vs. Du) ---
  const sieMatches = (text.match(/\bsie\b|\bihnen\b|\bihr[e]?\b|\bihres\b/g) || []).length
  const duMatches = (text.match(/\bdu\b|\bdir\b|\bdein[e]?\b|\bdich\b/g) || []).length
  const formality: ToneFormality = duMatches > sieMatches ? 'informal' : 'formal'

  return { formality, sentiment, urgency }
}

/**
 * Determine email priority based on type + urgency
 */
export function determinePriority(
  emailType: string,
  urgency: ToneUrgency,
  needsResponse: boolean
): 'critical' | 'high' | 'normal' | 'low' {
  if (!needsResponse) return 'low'
  if (urgency === 'critical') return 'critical'
  if (emailType === 'customer_inquiry' && urgency === 'high') return 'high'
  if (emailType === 'customer_inquiry') return 'normal'
  if (emailType === 'form_submission') return 'normal'
  return 'low'
}

/**
 * Customer Happiness Score (1-5) based on words and tonality
 * 5 = very happy, 1 = very unhappy
 */
export function calculateHappinessScore(subject: string, bodyText: string): number {
  const text = `${subject} ${bodyText}`.toLowerCase()

  // Strong positive indicators → 5
  const strongPositive = /\bbegeistert\b|\bfantastisch\b|\bhervorragend\b|\bperfekt\b|\bausgezeichnet\b|\bbrillant\b|\bgroßartig\b|\bgrossartig\b|\bwundervoll\b|\büberwältigt\b/.test(text)
  // Positive indicators
  const positiveWords = (text.match(/\btoll\b|\bsuper\b|\bwunderbar\b|\bgut\b|\bfreue\b|\bdanke\b|\bvielen dank\b|\bprofessionell\b|\bklar\b|\bhilfreich\b|\bzufrieden\b|\bempfehlen\b|\bweiter\s*so\b/g) || []).length
  // Negative indicators
  const negativeWords = (text.match(/\bleider\b|\bnicht\b|\bproblem\b|\bfehler\b|\bschade\b|\bunzufrieden\b|\bnicht\s+gut\b|\bnicht\s+hilfreich\b|\bnicht\s+überzeugt\b|\bnicht\s+überzeugend\b|\bverbesser\b|\bbedauer\b|\bnicht\s+wirklich\b|\bkritik\b|\bmangel\b|\bschwach\b/g) || []).length
  // Strong negative indicators → 1
  const strongNegative = /\bfrustriert\b|\bunzumutbar\b|\binakzeptabel\b|\bskandal\b|\bkatastrophe\b|\bentsetzlich\b|\bfrechheit\b|\bunverschämt\b|\babzocke\b/.test(text)
  // Churn signals
  const churnSignals = /\bkündigen\b|\babsagen\b|\bstornieren\b|\bnicht\s+fortsetzen\b|\bnicht\s+zu\s+beginnen\b|\baufhören\b|\bbeenden\b|\bnicht\s+weiter\b|\bentschieden.*nicht\b/.test(text)

  if (strongNegative) return 1
  if (strongPositive && negativeWords === 0) return 5

  // Score calculation
  let score = 3 // neutral base
  score += Math.min(positiveWords * 0.4, 1.5)
  score -= Math.min(negativeWords * 0.35, 2)
  if (churnSignals) score -= 1
  if (positiveWords > 0 && negativeWords === 0) score += 0.5

  return Math.max(1, Math.min(5, Math.round(score)))
}
