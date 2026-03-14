import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action, title } = await request.json()
    const supabase = await createClient()

    if (action === 'dismiss') {
      await supabase
        .from('learning_cases')
        .update({ status: 'dismissed' })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    if (action === 'extract') {
      // 1. Get the learning case
      const { data: lc, error } = await supabase
        .from('learning_cases')
        .select('*, incoming_emails(subject, from_email)')
        .eq('id', id)
        .single()

      if (error || !lc) {
        return NextResponse.json({ error: 'Learning case not found' }, { status: 404 })
      }

      const chunkTitle = title || `Gelernt: ${(lc.incoming_emails as { subject?: string })?.subject || 'Antwortkorrektur'}`
      const content = lc.corrected_response

      // 2. Generate embedding
      const embedding = await createEmbedding(content)

      // 3. Create knowledge chunk
      const { data: chunk, error: chunkError } = await supabase
        .from('knowledge_chunks')
        .insert({
          source_title: chunkTitle,
          content,
          source_type: 'email',
          embedding,
          published: false, // don't auto-publish to Help Center
        })
        .select('id')
        .single()

      if (chunkError || !chunk) {
        console.error('Failed to create knowledge chunk:', chunkError)
        return NextResponse.json({ error: 'Failed to extract knowledge' }, { status: 500 })
      }

      // 4. Update learning case
      await supabase
        .from('learning_cases')
        .update({
          status: 'extracted',
          knowledge_extracted: true,
          extracted_chunk_id: chunk.id,
        })
        .eq('id', id)

      return NextResponse.json({ success: true, chunkId: chunk.id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Learning case PATCH error:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
