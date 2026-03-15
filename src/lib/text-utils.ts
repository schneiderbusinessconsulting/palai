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

/**
 * Rule-based spam detection — no API calls.
 * Returns a spam score and boolean flag.
 */
export function detectSpam(
  fromEmail: string,
  subject: string,
  bodyText: string
): { isSpam: boolean; spamScore: number } {
  let spamScore = 0
  const emailLower = fromEmail.toLowerCase()
  const subjectLower = subject.toLowerCase()
  const bodyLower = bodyText.toLowerCase()
  const fullText = `${subjectLower} ${bodyLower}`

  // 1. Known marketing/bulk email domains (40 points)
  const bulkDomains = [
    'mailchimp', 'sendgrid', 'hubspotmail', 'constantcontact', 'mailerlite',
    'brevo', 'sendinblue', 'campaignmonitor', 'mailjet', 'getresponse',
    'activecampaign', 'aweber', 'convertkit', 'drip', 'beehiiv', 'substack',
  ]
  if (bulkDomains.some((d) => emailLower.includes(d))) {
    spamScore += 40
  }

  // 2. fromEmail patterns (only as a signal, not standalone)
  const suspiciousPrefix = /^(noreply@|no-reply@|newsletter@|marketing@|info@)/
  const hasSuspiciousPrefix = suspiciousPrefix.test(emailLower)

  // 3. Unsubscribe keywords in body (30 points)
  const unsubscribePatterns = [
    'unsubscribe', 'abmelden', 'abbestellen', 'austragen', 'newsletter abbestellen',
  ]
  if (unsubscribePatterns.some((p) => bodyLower.includes(p))) {
    spamScore += 30
  }

  // 4. Promotional keywords — German (15 each, cap 45)
  const promoDE = [
    'kostenlos', 'gratis', 'gewinnen', 'gewinnspiel', 'sonderangebot',
    'rabatt', 'prozent reduziert', 'jetzt zugreifen', 'limitiertes angebot',
    'nur heute', 'klicken sie hier',
  ]
  // Promotional keywords — English
  const promoEN = [
    'free', 'winner', 'congratulations', 'click here', 'limited offer',
    'act now', 'urgent', 'unsubscribe',
  ]
  const allPromo = [...promoDE, ...promoEN]
  let promoHits = 0
  for (const kw of allPromo) {
    if (fullText.includes(kw)) {
      promoHits++
    }
  }
  spamScore += Math.min(promoHits * 15, 45)

  // 5. ALL-CAPS subject (>50% uppercase and length > 10) — 20 points
  if (subject.length > 10) {
    const upperCount = (subject.match(/[A-ZÄÖÜ]/g) || []).length
    const letterCount = (subject.match(/[A-Za-zÄÖÜäöü]/g) || []).length
    if (letterCount > 0 && upperCount / letterCount > 0.5) {
      spamScore += 20
    }
  }

  // 6. Excessive URLs in body (>5 links) — 15 points
  const urlCount = (bodyText.match(/https?:\/\//gi) || []).length
  if (urlCount > 5) {
    spamScore += 15
  }

  // 7. Generic greetings combined with marketing keywords
  const genericGreeting = /dear sir\/madam|sehr geehrte damen und herren/.test(fullText)
  if (genericGreeting && promoHits > 0) {
    spamScore += 10
  }

  // 8. HTML-heavy emails with lots of images (>3 <img tags) combined with promo keywords
  const imgCount = (bodyText.match(/<img/gi) || []).length
  if (imgCount > 3 && promoHits > 0) {
    spamScore += 10
  }

  // Boost score if suspicious prefix is combined with other signals
  if (hasSuspiciousPrefix && spamScore > 0) {
    spamScore += 10
  }

  return { isSpam: spamScore >= 60, spamScore }
}

/**
 * Detect up to 3 topic tags from German text.
 * Returns tags sorted by relevance (number of keyword matches).
 */
export function detectTopicTags(subject: string, bodyText: string): string[] {
  const text = `${subject} ${bodyText}`.toLowerCase()

  const tagKeywords: Record<string, string[]> = {
    'Anfrage': ['anfrage', 'frage', 'wissen', 'erkundigen', 'informieren', 'information'],
    'Beschwerde': ['beschwerde', 'reklamation', 'unzufrieden', 'problem', 'fehler', 'mangel', 'enttäuscht', 'ärgerlich'],
    'Bestellung': ['bestellung', 'bestellen', 'kaufen', 'order', 'lieferung', 'versand'],
    'Stornierung': ['stornieren', 'stornierung', 'kündigen', 'kündigung', 'absagen', 'rücktritt'],
    'Zertifikat': ['zertifikat', 'zertifizierung', 'diplom', 'abschluss', 'prüfung', 'nachweis'],
    'Kurs': ['kurs', 'ausbildung', 'seminar', 'schulung', 'workshop', 'weiterbildung', 'lehrgang'],
    'Feedback': ['feedback', 'rückmeldung', 'bewertung', 'meinung', 'erfahrung', 'empfehlung', 'weiterempf'],
    'Rechnung': ['rechnung', 'zahlung', 'bezahlung', 'überweisung', 'faktura', 'quittung', 'mahnung'],
    'Terminanfrage': ['termin', 'terminvereinbarung', 'besprechung', 'meeting', 'gespräch vereinbaren'],
    'Anmeldung': ['anmeldung', 'anmelden', 'registrierung', 'registrieren', 'einschreibung'],
    'Produkt': ['produkt', 'artikel', 'ware', 'sortiment', 'angebot', 'preis', 'preisanfrage', 'preisliste'],
    'Kooperation': ['kooperation', 'zusammenarbeit', 'partnerschaft', 'partner', 'kooperieren'],
  }

  const tagScores: { tag: string; count: number }[] = []

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    let count = 0
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}`, 'g')
      const matches = text.match(regex)
      if (matches) {
        count += matches.length
      }
    }
    if (count > 0) {
      tagScores.push({ tag, count })
    }
  }

  tagScores.sort((a, b) => b.count - a.count)

  return tagScores.slice(0, 3).map((t) => t.tag)
}
