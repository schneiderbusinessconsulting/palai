import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'

// Save an AI draft response directly to the knowledge base
export async function POST(request: NextRequest) {
  try {
    const { subject, content, emailId } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const title = `Antwort: ${(subject || 'Unbekannt').substring(0, 80)}`
    const supabase = await createClient()

    // Check for duplicate
    const { data: existing } = await supabase
      .from('knowledge_chunks')
      .select('id')
      .eq('source_title', title)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'duplicate', message: 'Bereits in der Knowledge Base vorhanden.' }, { status: 409 })
    }

    const embedding = await createEmbedding(content)

    const { data, error } = await supabase
      .from('knowledge_chunks')
      .insert({
        content,
        embedding,
        source_type: 'email_training',
        source_title: title,
        metadata: {
          saved_from_inbox: true,
          email_id: emailId || null,
          saved_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single()

    if (error) {
      console.error('Save to KB error:', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id, title })
  } catch (error) {
    console.error('Save to KB error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
