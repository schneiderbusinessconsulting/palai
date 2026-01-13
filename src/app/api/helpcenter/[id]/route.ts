import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get a single help center article by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch the chunk by exact ID first
    const { data: chunk, error } = await supabase
      .from('knowledge_chunks')
      .select('id, source_title, source_type, content, updated_at, published')
      .eq('id', id)
      .eq('published', true)
      .single()

    if (error || !chunk) {
      // Try to find by partial ID match (for shorter slugs)
      // Fetch all published help center articles and filter by partial ID
      const { data: allChunks } = await supabase
        .from('knowledge_chunks')
        .select('id, source_title, source_type, content, updated_at, published')
        .in('source_type', ['help_article', 'faq', 'course_info'])
        .eq('published', true)

      // Find the chunk that starts with the partial ID
      const foundChunk = allChunks?.find(c => c.id.startsWith(id))

      if (foundChunk) {
        // Get all chunks with the same title to combine content
        const { data: relatedChunks } = await supabase
          .from('knowledge_chunks')
          .select('content')
          .eq('source_title', foundChunk.source_title)
          .eq('published', true)
          .order('created_at', { ascending: true })

        const fullContent = relatedChunks?.map(c => c.content).join('\n\n') || foundChunk.content

        return NextResponse.json({
          article: {
            id: foundChunk.id,
            title: foundChunk.source_title,
            source_type: foundChunk.source_type,
            content: fullContent,
            updated_at: foundChunk.updated_at,
          },
        })
      }

      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Get all chunks with the same title to combine content
    const { data: allChunks } = await supabase
      .from('knowledge_chunks')
      .select('content')
      .eq('source_title', chunk.source_title)
      .eq('published', true)
      .order('created_at', { ascending: true })

    const fullContent = allChunks?.map(c => c.content).join('\n\n') || chunk.content

    return NextResponse.json({
      article: {
        id: chunk.id,
        title: chunk.source_title,
        source_type: chunk.source_type,
        content: fullContent,
        updated_at: chunk.updated_at,
      },
    })
  } catch (error) {
    console.error('Help center article API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
