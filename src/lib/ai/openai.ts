import OpenAI from 'openai'

// Lazy initialization to avoid build errors
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

export async function createEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

// Default to gpt-4o, can be overridden with OPENAI_CHAT_MODEL env var
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o'

export async function generateChatResponse(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.7,
    max_completion_tokens: 1000,
  })
  return response.choices[0].message.content || ''
}

// Detect formality (Sie/Du) from email content
export function detectFormality(text: string): 'sie' | 'du' {
  const lowerText = text.toLowerCase()

  // Patterns for formal "Sie"
  const siePatterns = [
    /\bsie\b/gi,
    /\bihnen\b/gi,
    /\bihrer?\b/gi,
    /\bihre[nms]?\b/gi,
  ]

  // Patterns for informal "Du"
  const duPatterns = [
    /\bdu\b/gi,
    /\bdir\b/gi,
    /\bdein(?:e[nrms]?)?\b/gi,
    /\bdich\b/gi,
  ]

  let sieCount = 0
  let duCount = 0

  for (const pattern of siePatterns) {
    const matches = lowerText.match(pattern)
    if (matches) sieCount += matches.length
  }

  for (const pattern of duPatterns) {
    const matches = lowerText.match(pattern)
    if (matches) duCount += matches.length
  }

  // Default to "Sie" if unclear (more professional)
  return duCount > sieCount ? 'du' : 'sie'
}

export type Formality = 'sie' | 'du'

export async function generateEmailDraft(
  emailContent: string,
  relevantContext: string[],
  senderName?: string,
  formality?: Formality,
  regenerationFeedback?: string,
  aiInstructions?: string[],
  threadHistory?: { direction: string; text: string; timestamp: string }[],
  maxSimilarity?: number
): Promise<{ response: string; confidence: number; detectedFormality: Formality }> {
  // Auto-detect formality if not provided
  const detectedFormality = formality || detectFormality(emailContent)

  const formalityInstruction = detectedFormality === 'du'
    ? `- Verwende die informelle "Du"-Form (du, dir, dein)`
    : `- Verwende die formelle "Sie"-Form (Sie, Ihnen, Ihr)`

  // Build dynamic rules section from AI instructions
  const dynamicRules = aiInstructions && aiInstructions.length > 0
    ? `\n\nBENUTZERDEFINIERTE REGELN (IMMER BEFOLGEN):\n${aiInstructions.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`
    : ''

  // Get today's date for context
  const today = new Date()
  const dateStr = today.toLocaleDateString('de-CH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const systemPrompt = `Du bist ein freundlicher Support-Mitarbeiter des Palacios Instituts.

AKTUELLES DATUM: ${dateStr}

Das Palacios Institut bietet Ausbildungen in den Bereichen Hypnose, Meditation und Life Coaching an. Gründer ist Gabriel Palacios.

Deine Aufgabe:
- Beantworte Kundenanfragen freundlich und professionell
- Nutze die bereitgestellten Informationen aus der Knowledge Base
- Wenn du etwas nicht weisst, sage es ehrlich
- Schreibe im Schweizer Deutsch Stil (z.B. "Grüezi", "Herzliche Grüsse")
- Halte Antworten präzise aber herzlich
- WICHTIG: Nenne KEINE vergangenen Termine als zukünftige Events! Prüfe das Datum.
${formalityInstruction}

Formatierung:
- Beginne mit einer persönlichen Anrede
- Strukturiere längere Antworten mit Absätzen
- Schliesse mit "Herzliche Grüsse" und Platzhalter [Name]

Wichtig:
- Erfinde KEINE Preise, Daten oder Fakten
- Wenn die Knowledge Base keine Antwort liefert, bitte den Kunden höflich um Geduld und sage, dass sich jemand persönlich melden wird
- Wenn du Beispiele von früheren GESENDETEN ANTWORTEN siehst, orientiere dich an Tonfall und Stil${dynamicRules}`

  const feedbackSection = regenerationFeedback
    ? `\n\nFEEDBACK ZUR VERBESSERUNG:\n${regenerationFeedback}\n\nBitte berücksichtige dieses Feedback bei der Erstellung der Antwort.`
    : ''

  // Build thread context section — previous messages give the AI conversation history
  const threadSection =
    threadHistory && threadHistory.length > 0
      ? `\n\nGESPRÄCHSVERLAUF (${threadHistory.length} vorherige Nachrichten, älteste zuerst):\n${threadHistory
          .map((msg, i) => {
            const role =
              msg.direction === 'INCOMING_EMAIL' || msg.direction === 'INCOMING'
                ? '📥 KUNDE'
                : '📤 PALACIOS ANTWORT'
            return `[${i + 1}] ${role}: ${msg.text.substring(0, 600)}${msg.text.length > 600 ? '…' : ''}`
          })
          .join('\n\n')}\n\nDie KUNDENANFRAGE oben ist die NEUESTE Nachricht. Antworte darauf und berücksichtige den Gesprächsverlauf — wiederhole keine Informationen die bereits gegeben wurden.`
      : ''

  const userPrompt = `KUNDENANFRAGE:
${emailContent}

RELEVANTE INFORMATIONEN AUS UNSERER KNOWLEDGE BASE:
${relevantContext.length > 0 ? relevantContext.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n') : 'Keine spezifischen Informationen gefunden.'}${threadSection}${feedbackSection}

Bitte erstelle eine passende Antwort auf diese Anfrage.`

  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 1000,
  })

  const generatedResponse = response.choices[0].message.content || ''

  // Calculate confidence based on KB similarity, context count, and response quality
  let confidence = 0.35 // Honest base — no KB = low confidence

  // Primary driver: similarity score from pgvector search
  if (maxSimilarity !== undefined && maxSimilarity > 0) {
    if (maxSimilarity > 0.82) confidence += 0.35
    else if (maxSimilarity > 0.70) confidence += 0.25
    else if (maxSimilarity > 0.58) confidence += 0.16
    else if (maxSimilarity > 0.50) confidence += 0.10
    else confidence += 0.05 // below threshold but still found something
  } else if (relevantContext.length > 0) {
    confidence += 0.08 // chunks found but no similarity score available
  }

  // Boost for multiple high-quality chunks
  if (relevantContext.length >= 3 && (maxSimilarity ?? 0) > 0.60) confidence += 0.10
  else if (relevantContext.length >= 2) confidence += 0.04

  // AI instructions provide extra grounding
  if (aiInstructions && aiInstructions.length > 0) confidence += 0.05

  // Penalize hedging language — AI is uncertain too
  const hedgingPhrases = [
    'persönlich melden', 'nicht sicher', 'kann ich nicht', 'weiss ich nicht',
    'keine information', 'leider nicht', 'bitte wenden sie sich', 'bitte kontaktieren sie'
  ]
  const hedgingCount = hedgingPhrases.filter(p => generatedResponse.toLowerCase().includes(p)).length
  confidence -= hedgingCount * 0.10

  // Cap: if response is essentially just "someone will get back to you" with no KB, limit to 0.45
  const isEssentiallyDeflection = hedgingCount >= 2 && relevantContext.length === 0
  if (isEssentiallyDeflection) confidence = Math.min(confidence, 0.45)

  confidence = Math.max(0.10, Math.min(0.97, confidence))

  return {
    response: generatedResponse,
    confidence,
    detectedFormality,
  }
}

export async function categorizeKnowledgeContent(
  title: string,
  content: string
): Promise<{ category: string; confidence: number; reason: string }> {
  const systemPrompt = `Du bist ein Kategorisierungs-Experte für das Palacios Institut.

Das Institut bietet Ausbildungen in Hypnose, Meditation und Life Coaching an.

Deine Aufgabe ist es, Inhalte in eine der folgenden Kategorien einzuordnen:
- "help_article": Allgemeine Hilfe-Artikel, Anleitungen, How-To Guides
- "faq": Häufig gestellte Fragen und deren Antworten
- "course_info": Informationen über Kurse, Preise, Termine, Ausbildungen
- "email": E-Mail-Vorlagen oder typische Korrespondenz

Analysiere den Titel und Inhalt sorgfältig und wähle die passendste Kategorie.`

  const userPrompt = `TITEL: ${title}

INHALT:
${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

Antworte NUR im folgenden JSON-Format:
{
  "category": "help_article|faq|course_info|email",
  "confidence": 0.0-1.0,
  "reason": "Kurze Begründung auf Deutsch"
}`

  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_completion_tokens: 200,
  })

  const responseText = response.choices[0].message.content || ''

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const validCategories = ['help_article', 'faq', 'course_info', 'email']

      return {
        category: validCategories.includes(parsed.category) ? parsed.category : 'help_article',
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        reason: parsed.reason || 'Automatisch kategorisiert',
      }
    }
  } catch (e) {
    console.error('Failed to parse categorization response:', e)
  }

  // Fallback
  return {
    category: 'help_article',
    confidence: 0.5,
    reason: 'Konnte nicht automatisch kategorisiert werden',
  }
}

export type EmailType = 'customer_inquiry' | 'form_submission' | 'system_alert' | 'notification'

// Classify incoming emails to filter transactional/system mails
export async function classifyEmail(
  fromEmail: string,
  subject: string,
  bodyText: string
): Promise<{ emailType: EmailType; needsResponse: boolean; reason: string }> {
  // Quick pattern-based classification for obvious cases (saves API calls)
  const lowerFrom = fromEmail.toLowerCase()
  const lowerSubject = subject.toLowerCase()
  const lowerBody = bodyText.toLowerCase()

  // Always system alerts - just check from address (no keyword needed)
  const alwaysSystemFrom = [
    // DevOps & Hosting
    'railway.app', 'notify.railway', 'vercel.com', 'netlify.com', 'github.com', 'gitlab.com',
    'heroku.com', 'digitalocean.com', 'aws.amazon.com', 'azure.com',
    'sentry.io', 'bugsnag.com', 'datadog.com', 'newrelic.com',
    // Payments & E-Commerce
    'stripe.com', 'paypal.com', 'mollie.com', 'klarna.com',
    'twint.ch', 'twintpay.ch', // TWINT
    'myablefy.com', 'ablefy.com', 'elopage.com', // ablefy (ehemals elopage)
    'digistore24.com', 'copecart.com', 'thrivecart.com',
    'shopify.com', 'woocommerce.com',
    // Course & Marketing Platforms
    'kajabi.com', 'kajabimail.net', 'm.kajabimail.net', // Kajabi
    'teachable.com', 'thinkific.com', 'podia.com',
    'mailchimp.com', 'sendgrid.com', 'postmark', 'sendinblue.com', 'brevo.com',
    'activecampaign.com', 'mailerlite.com', 'convertkit.com',
    // Productivity & Communication
    'slack.com', 'notion.so', 'linear.app', 'asana.com', 'trello.com', 'monday.com',
    'zoom.us', 'zoom.com', 'calendly.com', 'cal.com',
    // CRM & Support
    'hubspot.com', 'salesforce.com', 'zendesk.com', 'intercom.com', 'freshdesk.com',
    // Big Tech
    'google.com', 'microsoft.com', 'apple.com', 'facebook.com', 'meta.com', 'instagram.com',
    'linkedin.com', 'twitter.com', 'x.com',
    // Generic system prefixes (these catch no-reply@*, noreply@*, etc.)
    'no-reply@', 'noreply@', 'donotreply@', 'notifications@', 'alerts@', 'system@', 'mailer@',
    'bounce@', 'postmaster@', 'daemon@', 'autoresponder@',
  ]

  if (alwaysSystemFrom.some(p => lowerFrom.includes(p))) {
    // Check if it might actually be a customer email forwarded or something
    const mightBeCustomer = lowerSubject.includes('anfrage') || lowerSubject.includes('frage') ||
      lowerSubject.includes('kontakt') || lowerSubject.includes('interesse')

    if (!mightBeCustomer) {
      return {
        emailType: 'system_alert',
        needsResponse: false,
        reason: 'Automatische System-Benachrichtigung',
      }
    }
  }

  // System alerts with keyword matching
  const systemPatterns = [
    { from: ['zapier', 'make.com', 'integromat'], keywords: ['alert', 'error', 'warning', 'failed', 'success'] },
    { from: ['zoom.us', 'zoom.com'], keywords: ['meeting', 'joined', 'recording', 'ready', 'scheduled'] },
    { from: ['kajabi', 'activecampaign', 'mailerlite'], keywords: ['alert', 'integration', 'error', 'report'] },
    { from: ['justcall', 'aircall', 'twilio'], keywords: ['summary', 'daily', 'report', 'call'] },
  ]

  for (const pattern of systemPatterns) {
    const fromMatch = pattern.from.some(p => lowerFrom.includes(p))
    const keywordMatch = pattern.keywords.some(k => lowerSubject.includes(k))
    if (fromMatch && keywordMatch) {
      return {
        emailType: 'system_alert',
        needsResponse: false,
        reason: 'Automatische System-Benachrichtigung erkannt',
      }
    }
  }

  // Build/deployment notifications
  if (lowerSubject.includes('build') || lowerSubject.includes('deploy') || lowerSubject.includes('failed') ||
      lowerSubject.includes('succeeded') || lowerSubject.includes('pipeline')) {
    return {
      emailType: 'notification',
      needsResponse: false,
      reason: 'Build/Deployment Benachrichtigung',
    }
  }

  // Transaction/Payment notifications (content-based)
  const transactionKeywords = ['transaktion', 'transaction', 'purchase', 'zahlung', 'payment',
    'rechnung', 'invoice', 'quittung', 'receipt', 'storno', 'refund', 'rückbuchung',
    'congratulations! new purchase', 'new sale', 'neue bestellung', 'order confirmation']
  const hasTransactionKeyword = transactionKeywords.some(k =>
    lowerSubject.includes(k) || lowerBody.substring(0, 500).includes(k)
  )

  if (hasTransactionKeyword) {
    // Double-check: Is there an actual customer question hidden?
    const hasQuestion = lowerBody.includes('?') && (
      lowerBody.includes('frage') || lowerBody.includes('wie kann') ||
      lowerBody.includes('können sie') || lowerBody.includes('bitte um')
    )

    if (!hasQuestion) {
      return {
        emailType: 'notification',
        needsResponse: false,
        reason: 'Transaktions-/Zahlungsbenachrichtigung',
      }
    }
  }

  // Zoom notifications
  if (lowerFrom.includes('zoom') && (lowerSubject.includes('joined') || lowerSubject.includes('recording') || lowerSubject.includes('ready'))) {
    return {
      emailType: 'notification',
      needsResponse: false,
      reason: 'Zoom Benachrichtigung',
    }
  }

  // Form submissions - check if they need response
  const formPatterns = ['tally.so', 'typeform', 'jotform', 'formular', 'anmeldung', 'registration']
  const isFormSubmission = formPatterns.some(p => lowerFrom.includes(p) || lowerSubject.includes(p))

  if (isFormSubmission) {
    // Check if there's a comment/question in the form that needs response
    const commentPatterns = ['kommentar', 'comment', 'frage', 'question', 'anmerkung', 'nachricht', 'message']
    const hasComment = commentPatterns.some(p => bodyText.toLowerCase().includes(p))

    // Look for actual content after comment field
    const commentMatch = bodyText.match(/(?:kommentar|comment|nachricht|message)[:\s]*\n([^\n]+)/i)
    const hasActualComment = commentMatch && commentMatch[1] && commentMatch[1].trim().length > 5 && commentMatch[1].trim() !== '-'

    return {
      emailType: 'form_submission',
      needsResponse: hasActualComment || false,
      reason: hasActualComment ? 'Formular mit Kundenkommentar' : 'Formular-Eingang ohne Rückfrage',
    }
  }

  // No pattern matched - use AI to classify
  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Du bist ein E-Mail-Klassifikator. Analysiere die E-Mail und klassifiziere sie.

Kategorien:
- system_alert: Automatische Benachrichtigungen von Services (Build-Fehler, Server-Alerts, API-Notifications, Newsletter-Bestätigungen, Passwort-Resets, etc.)
- notification: Benachrichtigungen die keine Antwort brauchen (Meeting-Erinnerungen, Kalender-Updates, Social Media Notifications, etc.)
- form_submission: Formular-Einreichungen (Anmeldungen, Kontaktformulare)
- customer_inquiry: Echte Kundenanfragen die eine persönliche Antwort brauchen

Antworte NUR mit einem JSON-Objekt:
{"emailType": "...", "needsResponse": true/false, "reason": "kurze Begründung auf Deutsch"}`
        },
        {
          role: 'user',
          content: `Von: ${fromEmail}
Betreff: ${subject}

${bodyText.substring(0, 1500)}`
        }
      ],
      temperature: 0.1,
      max_completion_tokens: 150,
    })

    const content = response.choices[0].message.content || ''

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        emailType: parsed.emailType as EmailType,
        needsResponse: parsed.needsResponse ?? true,
        reason: parsed.reason || 'AI-Klassifizierung',
      }
    }
  } catch (error) {
    console.error('AI classification failed:', error)
  }

  // Fallback: assume it's a customer inquiry that needs response
  return {
    emailType: 'customer_inquiry',
    needsResponse: true,
    reason: 'Kundenanfrage (Fallback)',
  }
}

export { getOpenAI }
