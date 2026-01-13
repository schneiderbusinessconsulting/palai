import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get all published help center articles
export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all knowledge chunks that should appear in help center
    // Exclude ai_instructions as those are internal only
    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('id, source_title, source_type, content, updated_at')
      .in('source_type', ['help_article', 'faq', 'course_info'])
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching help center articles:', error)
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
    }

    // Group by source_title to avoid duplicate articles (multiple chunks per article)
    const articlesMap = new Map<string, {
      id: string
      title: string
      source_type: string
      content: string
      updated_at: string
    }>()

    for (const chunk of chunks || []) {
      const title = chunk.source_title || 'Untitled'

      // Only keep the first chunk per article (or combine them)
      if (!articlesMap.has(title)) {
        articlesMap.set(title, {
          id: chunk.id,
          title,
          source_type: chunk.source_type,
          content: chunk.content,
          updated_at: chunk.updated_at,
        })
      } else {
        // Append content from additional chunks
        const existing = articlesMap.get(title)!
        existing.content += '\n\n' + chunk.content
      }
    }

    const articles = Array.from(articlesMap.values())

    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Help center API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
