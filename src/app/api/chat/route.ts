import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateChatResponse } from '@/lib/ai/openai'
import { CHAT_SYSTEM_PROMPT, buildChatPrompt } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1. Create embedding for the user message
    const embedding = await createEmbedding(message)

    // 2. Search for relevant knowledge chunks
    const { data: chunks, error: searchError } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
      }
    )

    if (searchError) {
      console.error('Knowledge search error:', searchError)
    }

    const relevantChunks = chunks?.map((c: { content: string }) => c.content) || []
    const sources = chunks?.map((c: { source_title: string; source_type: string }) => ({
      title: c.source_title,
      type: c.source_type,
    })) || []

    // 3. Generate response using GPT
    const userPrompt = buildChatPrompt(message, relevantChunks)
    const response = await generateChatResponse([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ])

    // 4. Store in database if conversationId provided
    if (conversationId) {
      // Store user message
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
      })

      // Store assistant message
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: response,
        relevant_chunks: chunks?.map((c: { id: string }) => c.id) || [],
      })
    }

    return NextResponse.json({
      response,
      sources,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
