import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { createEmbedding } from '@/lib/ai/openai'

// Admin client for knowledge (bypasses RLS)
function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Dynamic import for pdfjs-dist to avoid bundler issues
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  // Import pdfjs-dist legacy build which works without a worker
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Configure worker - use path to worker file
  const path = await import('path')
  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath

  const data = new Uint8Array(buffer)

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  })

  const pdf = await loadingTask.promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => {
        // Extract str property if it exists (TextItem has str, TextMarkedContent does not)
        const textItem = item as { str?: string }
        return textItem.str || ''
      })
      .filter(Boolean)
      .join(' ')
    fullText += pageText + '\n\n'
  }

  return fullText.trim()
}

// Split text into chunks - max 6000 chars (~1500 tokens) to stay safely under 8192 token limit
function chunkText(text: string, maxChunkSize = 6000): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)

  let currentChunk = ''

  for (const paragraph of paragraphs) {
    // If single paragraph is too long, split it by sentences or force-split
    if (paragraph.length > maxChunkSize) {
      // Save current chunk first
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      // Split long paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      let sentenceChunk = ''
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length > maxChunkSize && sentenceChunk.length > 0) {
          chunks.push(sentenceChunk.trim())
          sentenceChunk = ''
        }
        // If single sentence is still too long, force-split by character
        if (sentence.length > maxChunkSize) {
          for (let i = 0; i < sentence.length; i += maxChunkSize) {
            chunks.push(sentence.slice(i, i + maxChunkSize))
          }
        } else {
          sentenceChunk += sentence + ' '
        }
      }
      if (sentenceChunk.trim().length > 0) {
        currentChunk = sentenceChunk
      }
    } else if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph + '\n\n'
    } else {
      currentChunk += paragraph + '\n\n'
    }
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
      try {
        console.log('Starting PDF extraction for:', file.name, 'size:', file.size)
        const arrayBuffer = await file.arrayBuffer()
        console.log('ArrayBuffer created, size:', arrayBuffer.byteLength)
        textContent = await extractPdfText(arrayBuffer)
        console.log('PDF text extracted, length:', textContent.length)
      } catch (pdfError) {
        console.error('PDF parsing error details:', {
          name: (pdfError as Error).name,
          message: (pdfError as Error).message,
          stack: (pdfError as Error).stack,
        })
        return NextResponse.json({
          error: 'PDF konnte nicht gelesen werden: ' + (pdfError as Error).message
        }, { status: 500 })
      }
    } else if (file && (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'text/x-markdown' || file.name.endsWith('.md'))) {
      textContent = await file.text()
    }

    if (!textContent.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

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
          console.error('Error storing chunk:', error.message, error.code, error.details)
        } else {
          storedChunks.push(data)
        }
      } catch (embeddingError) {
        console.error('Error creating embedding:', (embeddingError as Error).message)
      }
    }

    // Return error if no chunks were stored
    if (storedChunks.length === 0) {
      // Try one more time with detailed error to return to user
      const testChunk = chunks[0] || 'test'
      let detailedError = 'Unknown error'
      try {
        const testEmbedding = await createEmbedding(testChunk)
        const { error: testError } = await supabase
          .from('knowledge_chunks')
          .insert({
            content: testChunk,
            embedding: testEmbedding,
            source_type: sourceType,
            source_title: title,
          })
        if (testError) {
          detailedError = `DB Error: ${testError.message} (Code: ${testError.code})`
        }
      } catch (e) {
        detailedError = `Embedding Error: ${(e as Error).message}`
      }

      console.error('No chunks stored. Chunks attempted:', chunks.length, 'Error:', detailedError)
      return NextResponse.json(
        { error: `Speichern fehlgeschlagen: ${detailedError}` },
        { status: 500 }
      )
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

    // Use server client for reads (works without service role key)
    let supabase
    try {
      supabase = getSupabaseAdmin()
    } catch {
      supabase = await createServerClient()
    }

    let query = supabase
      .from('knowledge_chunks')
      .select('id, source_title, source_type, created_at, updated_at, published, approved, learning_context, source_learning_id')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grouped = data?.reduce((acc: Record<string, any>, item) => {
      const key = item.source_title || 'Untitled'
      if (!acc[key]) {
        acc[key] = {
          title: key,
          source_type: item.source_type,
          chunks: 0,
          updated_at: item.updated_at,
          ids: [],
          published: item.published ?? true, // Default to true for backwards compat
          approved: true, // All chunks are approved by default
          learning_context: item.learning_context ?? null,
          source_learning_id: item.source_learning_id ?? null,
        }
      }
      acc[key].chunks++
      acc[key].ids.push(item.id)
      // All chunks are treated as approved
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

    const supabase = getSupabaseAdmin()

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

// Update knowledge item (title, content, category, published)
export async function PATCH(request: NextRequest) {
  try {
    const { oldTitle, newTitle, content, sourceType, published, approved } = await request.json()

    if (!oldTitle) {
      return NextResponse.json({ error: 'Old title required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // If only updating title/sourceType/published/approved without new content
    if (!content) {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (newTitle) updateData.source_title = newTitle
      if (sourceType) updateData.source_type = sourceType
      if (typeof published === 'boolean') updateData.published = published
      if (typeof approved === 'boolean') updateData.approved = approved

      const { error } = await supabase
        .from('knowledge_chunks')
        .update(updateData)
        .eq('source_title', oldTitle)

      if (error) {
        console.error('Update error:', error)
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
      }

      return NextResponse.json({ success: true, updated: true })
    }

    // If updating content, delete old chunks and create new ones
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('source_title', oldTitle)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete old content' }, { status: 500 })
    }

    // Split into chunks
    const chunks = chunkText(content)
    const title = newTitle || oldTitle
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
            source_type: sourceType || 'help_article',
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
    })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
