import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateEmailDraft } from '@/lib/ai/openai'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    // 1. Get the email
    const { data: email, error: emailError } = await supabase
      .from('incoming_emails')
      .select('*')
      .eq('id', emailId)
      .single()

    if (emailError || !email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    // 2. Create embedding for the email content
    const emailContent = `${email.subject}\n\n${email.body_text}`
    const embedding = await createEmbedding(emailContent)

    // 3. Search for relevant knowledge chunks
    const { data: chunks, error: searchError } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: embedding,
        match_threshold: 0.65,
        match_count: 5,
      }
    )

    if (searchError) {
      console.error('Knowledge search error:', searchError)
    }

    const relevantChunks = chunks?.map((c: { content: string }) => c.content) || []
    const chunkIds = chunks?.map((c: { id: string }) => c.id) || []

    // 4. Generate draft using AI
    const { response, confidence } = await generateEmailDraft(
      emailContent,
      relevantChunks,
      email.from_name
    )

    // 5. Store the draft
    const { data: draft, error: draftError } = await supabase
      .from('email_drafts')
      .insert({
        email_id: emailId,
        ai_generated_response: response,
        confidence_score: confidence,
        relevant_chunks: chunkIds,
        status: 'pending',
      })
      .select()
      .single()

    if (draftError) {
      console.error('Failed to store draft:', draftError)
      return NextResponse.json(
        { error: 'Failed to store draft' },
        { status: 500 }
      )
    }

    // 6. Update email status
    await supabase
      .from('incoming_emails')
      .update({ status: 'draft_ready' })
      .eq('id', emailId)

    // 7. Log to audit
    await supabase.from('audit_log').insert({
      email_id: emailId,
      draft_id: draft.id,
      action: 'draft_generated',
      details: {
        confidence_score: confidence,
        chunks_used: chunkIds.length,
      },
    })

    return NextResponse.json({
      draft,
      relevantSources: chunks?.map((c: { source_title: string; source_type: string; id: string }) => ({
        id: c.id,
        title: c.source_title,
        type: c.source_type,
      })) || [],
    })
  } catch (error) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    )
  }
}
