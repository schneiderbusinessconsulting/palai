import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateChatResponse } from '@/lib/ai/openai'

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json()

    if (!question || question.trim().length < 3) {
      return NextResponse.json({ error: 'Bitte geben Sie eine Frage ein' }, { status: 400 })
    }

    const supabase = await createClient()

    // Generate embedding for the question
    const questionEmbedding = await createEmbedding(question)

    // Search for relevant knowledge chunks
    const { data: chunks, error: searchError } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: questionEmbedding,
        match_threshold: 0.5, // Lower threshold for better matches
        match_count: 10,
      }
    )

    if (searchError) {
      console.error('Knowledge search error:', searchError)
      return NextResponse.json({ error: 'Suche fehlgeschlagen' }, { status: 500 })
    }

    console.log('[Help Center Ask] Found chunks:', chunks?.length || 0)
    if (chunks?.length > 0) {
      console.log('[Help Center Ask] First chunk type:', chunks[0].source_type, 'title:', chunks[0].source_title)
    }

    // Filter to only help center content types (published check done separately if needed)
    const relevantChunks = (chunks || []).filter((chunk: { source_type: string }) =>
      ['help_article', 'faq', 'course_info'].includes(chunk.source_type)
    )

    console.log('[Help Center Ask] Relevant chunks after filter:', relevantChunks.length)

    // Get unique source articles
    const sourceArticles = new Map<string, { id: string; title: string; source_type: string }>()
    for (const chunk of relevantChunks) {
      if (!sourceArticles.has(chunk.source_title)) {
        sourceArticles.set(chunk.source_title, {
          id: chunk.id,
          title: chunk.source_title,
          source_type: chunk.source_type,
        })
      }
    }

    // If no relevant content found
    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer: 'Leider habe ich zu dieser Frage keine passenden Informationen gefunden. Bitte kontaktieren Sie uns direkt unter kontakt@palacios-relations.ch',
        sources: [],
        hasAnswer: false,
      })
    }

    // Build context from chunks
    const context = relevantChunks
      .slice(0, 3)
      .map((chunk: { content: string }) => chunk.content)
      .join('\n\n---\n\n')

    // Generate AI answer
    const systemPrompt = `Du bist ein freundlicher Hilfe-Assistent für das Palacios Institut (Ausbildungen in Hypnose, Meditation, Coaching).

WICHTIGE REGELN:
- Antworte auf Deutsch in einfacher, verständlicher Sprache
- Halte die Antwort kurz und präzise (2-4 Sätze)
- Verwende die formelle "Sie"-Form
- Basiere deine Antwort NUR auf den bereitgestellten Informationen
- Wenn die Informationen nicht ausreichen, sage das ehrlich
- Erfinde KEINE Preise, Daten oder Details
- Sei freundlich und hilfsbereit

KONTEXT AUS UNSERER WISSENSDATENBANK:
${context}`

    const userPrompt = `Frage: ${question}

Bitte geben Sie eine kurze, hilfreiche Antwort basierend auf den verfügbaren Informationen.`

    const aiAnswer = await generateChatResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    return NextResponse.json({
      answer: aiAnswer,
      sources: Array.from(sourceArticles.values()).slice(0, 3),
      hasAnswer: true,
    })
  } catch (error) {
    console.error('Help Center Ask API error:', error)
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 })
  }
}
