import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get full content of a knowledge item by title
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ title: string }> }
) {
  try {
    const { title } = await params
    const decodedTitle = decodeURIComponent(title)

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('content, source_type, metadata')
      .eq('source_title', decodedTitle)
      .order('metadata->chunk_index', { ascending: true })

    if (error) {
      console.error('Error fetching knowledge item:', error)
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Combine all chunks into full content
    const fullContent = data.map(chunk => chunk.content).join('\n\n')
    const sourceType = data[0].source_type

    return NextResponse.json({
      title: decodedTitle,
      content: fullContent,
      sourceType,
      chunks: data.length,
    })
  } catch (error) {
    console.error('Knowledge item fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
