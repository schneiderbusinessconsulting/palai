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

export async function generateEmailDraft(
  emailContent: string,
  relevantContext: string[],
  senderName?: string
): Promise<{ response: string; confidence: number }> {
  const systemPrompt = `Du bist ein freundlicher Support-Mitarbeiter des Palacios Instituts.

Das Palacios Institut bietet Ausbildungen in den Bereichen Hypnose, Meditation und Life Coaching an. Gründer ist Gabriel Palacios.

Deine Aufgabe:
- Beantworte Kundenanfragen freundlich und professionell
- Nutze die bereitgestellten Informationen aus der Knowledge Base
- Wenn du etwas nicht weisst, sage es ehrlich
- Schreibe im Schweizer Deutsch Stil (z.B. "Grüezi", "Herzliche Grüsse")
- Halte Antworten präzise aber herzlich

Formatierung:
- Beginne mit einer persönlichen Anrede
- Strukturiere längere Antworten mit Absätzen
- Schliesse mit "Herzliche Grüsse" und Platzhalter [Name]

Wichtig:
- Erfinde KEINE Preise, Daten oder Fakten
- Wenn die Knowledge Base keine Antwort liefert, bitte den Kunden höflich um Geduld und sage, dass sich jemand persönlich melden wird`

  const userPrompt = `KUNDENANFRAGE:
${emailContent}

RELEVANTE INFORMATIONEN AUS UNSERER KNOWLEDGE BASE:
${relevantContext.length > 0 ? relevantContext.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n') : 'Keine spezifischen Informationen gefunden.'}

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
  }
}

export { getOpenAI }
