import { NextRequest, NextResponse } from 'next/server'
import { categorizeKnowledgeContent, getOpenAI } from '@/lib/ai/openai'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Check if this is a long text (likely content to analyze)
    const isContentAnalysis = message.length > 200

    if (isContentAnalysis) {
      // Analyze the content
      const categorization = await categorizeKnowledgeContent('', message)

      const systemPrompt = `Du bist ein Knowledge Base Assistent für das Palacios Institut.
Analysiere den eingefügten Text und erstelle:
1. Einen kurzen, prägnanten Titel (3-7 Wörter)
2. Eine kurze Zusammenfassung (1-2 Sätze)

Antworte auf Deutsch und freundlich.`

      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysiere diesen Text und schlage einen Titel vor:\n\n${message.substring(0, 3000)}` },
        ],
        temperature: 0.5,
        max_tokens: 300,
      })

      const aiResponse = response.choices[0].message.content || ''

      // Extract title from response
      const titleMatch = aiResponse.match(/[Tt]itel[:\s]+[""]?([^"""\n]+)[""]?/)
      const suggestedTitle = titleMatch?.[1]?.trim() || message.split(/[.!?\n]/)[0].substring(0, 50)

      return NextResponse.json({
        response: `Ich habe deinen Text analysiert:

**Titelvorschlag:** "${suggestedTitle}"

**Kategorie:** ${
          categorization.category === 'help_article' ? 'Help Center' :
          categorization.category === 'faq' ? 'FAQ' :
          categorization.category === 'course_info' ? 'Kurs-Info' :
          'E-Mail Vorlage'
        } (${Math.round(categorization.confidence * 100)}% sicher)

**Begründung:** ${categorization.reason}

Klicke auf "Vorschlag übernehmen" um diese Werte ins Formular zu übernehmen.`,
        suggestion: {
          title: suggestedTitle,
          category: categorization.category,
        },
      })
    }

    // Regular chat response
    const systemPrompt = `Du bist ein hilfreicher Knowledge Base Assistent für das Palacios Institut.
Du hilfst Benutzern beim Hochladen von Wissen in die Knowledge Base.

Du kannst helfen mit:
- Titelvorschlägen für Inhalte
- Kategorieempfehlungen (Help Center, FAQ, Kurs-Info, E-Mail Vorlage)
- Zusammenfassungen von langen Texten
- Formatierung und Strukturierung

Antworte kurz, freundlich und auf Deutsch.
Wenn der Benutzer keinen Text eingefügt hat, bitte ihn darum.`

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return NextResponse.json({
      response: response.choices[0].message.content || 'Entschuldigung, ich konnte keine Antwort generieren.',
    })
  } catch (error) {
    console.error('Knowledge assistant error:', error)
    return NextResponse.json(
      { error: 'Assistant error' },
      { status: 500 }
    )
  }
}
