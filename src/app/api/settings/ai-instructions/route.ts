import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id, source_title, content, created_at')
      .eq('source_type', 'ai_instructions')
      .order('created_at', { ascending: true })

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ instructions: [] })
      throw error
    }

    // Group by source_title (one entry per instruction)
    const grouped = (data || []).reduce<Record<string, { title: string; content: string; ids: string[]; created_at: string }>>((acc, item) => {
      if (!acc[item.source_title]) {
        acc[item.source_title] = {
          title: item.source_title,
          content: item.content,
          ids: [],
          created_at: item.created_at,
        }
      }
      acc[item.source_title].ids.push(item.id)
      return acc
    }, {})

    return NextResponse.json({ instructions: Object.values(grouped) })
  } catch (error) {
    console.error('AI Instructions GET error:', error)
    return NextResponse.json({ instructions: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content } = await request.json()
    if (!title || !content) {
      return NextResponse.json({ error: 'title and content required' }, { status: 400 })
    }

    const supabase = await createClient()
    const embedding = await createEmbedding(content)

    const { data, error } = await supabase
      .from('knowledge_chunks')
      .insert({
        content,
        embedding,
        source_type: 'ai_instructions',
        source_title: title,
        metadata: {},
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ instruction: data })
  } catch (error) {
    console.error('AI Instructions POST error:', error)
    return NextResponse.json({ error: 'Failed to create instruction' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { title } = await request.json()
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('source_type', 'ai_instructions')
      .eq('source_title', title)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('AI Instructions DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete instruction' }, { status: 500 })
  }
}
