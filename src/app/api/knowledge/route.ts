import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'

// Split text into chunks of roughly 500 tokens (approx 2000 chars)
function chunkText(text: string, maxChunkSize = 2000): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)

  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
    }
    currentChunk += paragraph + '\n\n'
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const content = formData.get('content') as string | null
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const sourceType = formData.get('source_type') as string || 'help_article'

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    let textContent = content || ''

    // Handle PDF upload
    if (file && file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Dynamic import for pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import('pdf-parse') as any
      const pdfParse = pdfParseModule.default || pdfParseModule
      const pdfData = await pdfParse(buffer)
      textContent = pdfData.text
    } else if (file && file.type === 'text/plain') {
      textContent = await file.text()
    }

    if (!textContent.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const supabase = await createClient()

    // Split into chunks
    const chunks = chunkText(textContent)

    // Generate embeddings and store chunks
    const storedChunks = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        const embedding = await createEmbedding(chunk)

        const { data, error } = await supabase
          .from('knowledge_chunks')
          .insert({
            content: chunk,
            embedding,
            source_type: sourceType,
            source_title: title,
            metadata: {
              chunk_index: i,
              total_chunks: chunks.length,
            },
          })
          .select()
          .single()

        if (error) {
          console.error('Error storing chunk:', error)
        } else {
          storedChunks.push(data)
        }
      } catch (embeddingError) {
        console.error('Error creating embedding:', embeddingError)
      }
    }

    return NextResponse.json({
      success: true,
      title,
      chunksCreated: storedChunks.length,
      totalChunks: chunks.length,
    })
  } catch (error) {
    console.error('Knowledge upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload knowledge' },
      { status: 500 }
    )
  }
}

// Get all knowledge items grouped by source
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceType = searchParams.get('source_type')

    const supabase = await createClient()

    let query = supabase
      .from('knowledge_chunks')
      .select('id, source_title, source_type, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching knowledge:', error)
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }

    // Group by source_title
    const grouped = data?.reduce((acc: Record<string, any>, item) => {
      const key = item.source_title || 'Untitled'
      if (!acc[key]) {
        acc[key] = {
          title: key,
          source_type: item.source_type,
          chunks: 0,
          updated_at: item.updated_at,
          ids: [],
        }
      }
      acc[key].chunks++
      acc[key].ids.push(item.id)
      return acc
    }, {})

    return NextResponse.json({
      items: Object.values(grouped || {}),
    })
  } catch (error) {
    console.error('Knowledge fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

// Delete knowledge by title
export async function DELETE(request: NextRequest) {
  try {
    const { title } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('source_title', title)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
