import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateEmailDraft, Formality } from '@/lib/ai/openai'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const body = await request.json().catch(() => ({}))
    const { formality, feedback, regenerate, senderName } = body as {
      formality?: Formality
      feedback?: string
      regenerate?: boolean
      senderName?: string
    }

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

    // 3. Read dynamic RAG threshold from app_config (fallback to 0.5)
    let ragThreshold = 0.5
    try {
      const { data: configRow } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'rag_match_threshold')
        .single()
      if (configRow) ragThreshold = parseFloat(configRow.value) || 0.5
    } catch { /* use default */ }

    // Search for relevant knowledge chunks
    const { data: chunks, error: searchError } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: embedding,
        match_threshold: ragThreshold,
        match_count: 5,
      }
    )

    if (searchError) {
      console.error('Knowledge search error:', searchError)
    }

    const relevantChunks = chunks?.map((c: { content: string }) => c.content) || []
    const chunkIds = chunks?.map((c: { id: string }) => c.id) || []
    const maxSimilarity: number = chunks?.length > 0
      ? Math.max(...chunks.map((c: { similarity: number }) => c.similarity || 0))
      : 0

    // 3b. Fetch AI instructions (rules) - these always apply
    const { data: aiRules } = await supabase
      .from('knowledge_chunks')
      .select('content')
      .eq('source_type', 'ai_instructions')

    const aiInstructions = aiRules?.map((r: { content: string }) => r.content) || []

    // 3c. Fetch thread history from our own DB for conversation context
    // Includes both incoming messages AND sent replies (via email_drafts)
    let threadHistory: { direction: string; text: string; timestamp: string }[] = []
    const emailRecord = email as { hubspot_thread_id?: string }
    if (emailRecord.hubspot_thread_id) {
      try {
        const { data: threadEmails } = await supabase
          .from('incoming_emails')
          .select('id, body_text, received_at, status')
          .eq('hubspot_thread_id', emailRecord.hubspot_thread_id)
          .neq('id', emailId)
          .order('received_at', { ascending: true })
          .limit(5)

        if (threadEmails && threadEmails.length > 0) {
          // Step 2: fetch sent drafts for outgoing replies on those emails
          const threadEmailIds = threadEmails.map((e: { id: string }) => e.id)
          const { data: sentDrafts } = await supabase
            .from('email_drafts')
            .select('email_id, edited_response, ai_generated_response, sent_at')
            .in('email_id', threadEmailIds)
            .eq('status', 'edited')
            .not('sent_at', 'is', null)

          const draftMap = new Map(
            (sentDrafts || []).map((d: { email_id: string; edited_response: string; ai_generated_response: string; sent_at: string }) => [
              d.email_id,
              { text: d.edited_response || d.ai_generated_response, timestamp: d.sent_at },
            ])
          )

          threadHistory = threadEmails.map((e: { id: string; body_text: string; received_at: string; status: string }) => {
            const draft = draftMap.get(e.id)
            if (draft && e.status === 'sent') {
              return { direction: 'EMAIL', text: draft.text, timestamp: draft.timestamp }
            }
            return {
              direction: e.status === 'sent' ? 'EMAIL' : 'INCOMING_EMAIL',
              text: e.body_text || '',
              timestamp: e.received_at || '',
            }
          })
        }
      } catch (e) {
        console.error('Thread history fetch error:', e)
      }
    }

    // 4. If regenerating, store feedback for learning
    if (regenerate && feedback) {
      const { error: feedbackError } = await supabase.from('draft_feedback').insert({
        email_id: emailId,
        feedback_text: feedback,
        formality_preference: formality,
      })
      if (feedbackError) {
        console.error('Failed to store feedback:', feedbackError)
      }
    }

    // 5. Generate draft using AI (with AI instructions/rules + thread history)
    const { response, confidence, detectedFormality } = await generateEmailDraft(
      emailContent,
      relevantChunks,
      senderName || undefined,
      formality,
      feedback,
      aiInstructions,
      threadHistory,
      maxSimilarity
    )

    // 6. Store or update the draft
    let draft
    let draftError

    if (regenerate) {
      // First get existing draft to increment count
      const { data: existingDraft } = await supabase
        .from('email_drafts')
        .select('id, regeneration_count')
        .eq('email_id', emailId)
        .single()

      if (existingDraft) {
        // Update existing draft
        const result = await supabase
          .from('email_drafts')
          .update({
            ai_generated_response: response,
            confidence_score: confidence,
            relevant_chunks: chunkIds,
            formality: detectedFormality,
            regeneration_count: (existingDraft.regeneration_count || 0) + 1,
            status: 'pending',
          })
          .eq('id', existingDraft.id)
          .select()
          .single()
        draft = result.data
        draftError = result.error
      } else {
        // Insert new draft
        const insertResult = await supabase
          .from('email_drafts')
          .insert({
            email_id: emailId,
            ai_generated_response: response,
            confidence_score: confidence,
            relevant_chunks: chunkIds,
            formality: detectedFormality,
            regeneration_count: 0,
            status: 'pending',
          })
          .select()
          .single()
        draft = insertResult.data
        draftError = insertResult.error
      }
    } else {
      // Insert new draft
      const result = await supabase
        .from('email_drafts')
        .insert({
          email_id: emailId,
          ai_generated_response: response,
          confidence_score: confidence,
          relevant_chunks: chunkIds,
          formality: detectedFormality,
          status: 'pending',
        })
        .select()
        .single()
      draft = result.data
      draftError = result.error
    }

    if (draftError) {
      console.error('Failed to store draft:', draftError)
      return NextResponse.json(
        { error: 'Failed to store draft' },
        { status: 500 }
      )
    }

    // 7. Update email status + Phase 4: set first_response_at
    await supabase
      .from('incoming_emails')
      .update({
        status: 'draft_ready',
        // Set first_response_at only if not already set (first human interaction)
        first_response_at: new Date().toISOString(),
      })
      .eq('id', emailId)
      .is('first_response_at', null)

    // 8. Log to audit
    await supabase.from('audit_log').insert({
      email_id: emailId,
      draft_id: draft.id,
      action: regenerate ? 'draft_regenerated' : 'draft_generated',
      details: {
        confidence_score: confidence,
        chunks_used: chunkIds.length,
        formality: detectedFormality,
        had_feedback: !!feedback,
      },
    })

    return NextResponse.json({
      draft: {
        ...draft,
        formality: detectedFormality,
      },
      detectedFormality,
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
