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

export async function generateChatResponse(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 1000,
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
  regenerationFeedback?: string
): Promise<{ response: string; confidence: number; detectedFormality: Formality }> {
  // Auto-detect formality if not provided
  const detectedFormality = formality || detectFormality(emailContent)

  const formalityInstruction = detectedFormality === 'du'
    ? `- Verwende die informelle "Du"-Form (du, dir, dein)`
    : `- Verwende die formelle "Sie"-Form (Sie, Ihnen, Ihr)`

  const systemPrompt = `Du bist ein freundlicher Support-Mitarbeiter des Palacios Instituts.

Das Palacios Institut bietet Ausbildungen in den Bereichen Hypnose, Meditation und Life Coaching an. Gründer ist Gabriel Palacios.

Deine Aufgabe:
- Beantworte Kundenanfragen freundlich und professionell
- Nutze die bereitgestellten Informationen aus der Knowledge Base
- Wenn du etwas nicht weisst, sage es ehrlich
- Schreibe im Schweizer Deutsch Stil (z.B. "Grüezi", "Herzliche Grüsse")
- Halte Antworten präzise aber herzlich
${formalityInstruction}

Formatierung:
- Beginne mit einer persönlichen Anrede
- Strukturiere längere Antworten mit Absätzen
- Schliesse mit "Herzliche Grüsse" und Platzhalter [Name]

Wichtig:
- Erfinde KEINE Preise, Daten oder Fakten
- Wenn die Knowledge Base keine Antwort liefert, bitte den Kunden höflich um Geduld und sage, dass sich jemand persönlich melden wird`

  const feedbackSection = regenerationFeedback
    ? `\n\nFEEDBACK ZUR VERBESSERUNG:\n${regenerationFeedback}\n\nBitte berücksichtige dieses Feedback bei der Erstellung der Antwort.`
    : ''

  const userPrompt = `KUNDENANFRAGE:
${emailContent}

RELEVANTE INFORMATIONEN AUS UNSERER KNOWLEDGE BASE:
${relevantContext.length > 0 ? relevantContext.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n') : 'Keine spezifischen Informationen gefunden.'}${feedbackSection}

Bitte erstelle eine passende Antwort auf diese Anfrage.`

  const openai = getOpenAI()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  })

  const generatedResponse = response.choices[0].message.content || ''

  // Calculate confidence based on context availability and response
  let confidence = 0.5 // Base confidence
  if (relevantContext.length > 0) confidence += 0.2
  if (relevantContext.length > 2) confidence += 0.1
  if (!generatedResponse.includes('persönlich melden') && !generatedResponse.includes('nicht sicher')) {
    confidence += 0.15
  }
  confidence = Math.min(confidence, 0.98)

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
    max_tokens: 200,
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

export { getOpenAI }
