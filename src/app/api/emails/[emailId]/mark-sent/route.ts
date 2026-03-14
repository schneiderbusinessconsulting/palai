import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    // Parse optional body with edited response
    let editedResponse: string | null = null
    try {
      const body = await request.json()
      editedResponse = body.editedResponse || null
    } catch {
      // No body sent, that's fine
    }

    // If edited response provided, save it to the draft
    if (editedResponse) {
      // Check if a draft exists
      const { data: existingDraft } = await supabase
        .from('email_drafts')
        .select('id')
        .eq('email_id', emailId)
        .single()

      if (existingDraft) {
        // Update existing draft
        const { error: draftError } = await supabase
          .from('email_drafts')
          .update({
            edited_response: editedResponse,
            status: 'edited',
            updated_at: new Date().toISOString(),
          })
          .eq('email_id', emailId)

        if (draftError) {
          console.error('Save draft edit error:', draftError)
        }
      } else {
        // Create new draft for manual response
        const { error: draftError } = await supabase
          .from('email_drafts')
          .insert({
            email_id: emailId,
            ai_generated_response: editedResponse,
            edited_response: editedResponse,
            confidence_score: 1.0,
            status: 'edited',
            formality: 'sie',
          })

        if (draftError) {
          console.error('Create manual draft error:', draftError)
        }
      }
    }

    // Update email status to sent
    const { error } = await supabase
      .from('incoming_emails')
      .update({
        status: 'sent',
      })
      .eq('id', emailId)

    if (error) {
      console.error('Mark as sent error:', error)
      return NextResponse.json(
        { error: 'Failed to mark as sent' },
        { status: 500 }
      )
    }

    // --- LEARNING: Store sent Q&A as knowledge chunk ---
    try {
      // Fetch email content
      const { data: email } = await supabase
        .from('incoming_emails')
        .select('subject, body_text, from_name')
        .eq('id', emailId)
        .single()

      // Fetch the draft response
      const { data: draft } = await supabase
        .from('email_drafts')
        .select('ai_generated_response, edited_response')
        .eq('email_id', emailId)
        .single()

      if (email && draft) {
        const finalResponse = editedResponse || draft.edited_response || draft.ai_generated_response
        const question = `${email.subject}\n${email.body_text}`.substring(0, 500)

        // Create a Q&A formatted chunk for learning
        const qaChunk = `KUNDENANFRAGE (${email.from_name || 'Kunde'}):\n${question}\n\nGESENDETE ANTWORT:\n${finalResponse}`

        // Create embedding for similarity search
        const embedding = await createEmbedding(qaChunk)

        // Store as knowledge chunk
        await supabase
          .from('knowledge_chunks')
          .insert({
            content: qaChunk,
            embedding,
            source_type: 'sent_response',
            source_title: `Antwort: ${email.subject}`.substring(0, 200),
            metadata: {
              email_id: emailId,
              from_name: email.from_name,
              was_edited: !!editedResponse || !!draft.edited_response,
            },
          })

        console.log('Learning: Stored sent response as knowledge chunk for:', email.subject)
      }
    } catch (learnError) {
      // Don't fail the main operation if learning fails
      console.error('Learning storage error (non-critical):', learnError)
    }

    return NextResponse.json({
      success: true,
      message: 'Als gesendet markiert',
    })
  } catch (error) {
    console.error('Mark as sent error:', error)
    return NextResponse.json(
      { error: 'Failed to mark as sent' },
      { status: 500 }
    )
  }
}

// Save edited draft without marking as sent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { editedResponse } = await request.json()
    const supabase = await createClient()

    // Check if a draft exists
    const { data: existingDraft } = await supabase
      .from('email_drafts')
      .select('id')
      .eq('email_id', emailId)
      .single()

    if (existingDraft) {
      // Update existing draft
      const { error } = await supabase
        .from('email_drafts')
        .update({
          edited_response: editedResponse,
          status: 'edited',
          updated_at: new Date().toISOString(),
        })
        .eq('email_id', emailId)

      if (error) {
        console.error('Save draft error:', error)
        return NextResponse.json(
          { error: 'Failed to save draft' },
          { status: 500 }
        )
      }
    } else {
      // Create new draft for manual response
      const { error } = await supabase
        .from('email_drafts')
        .insert({
          email_id: emailId,
          ai_generated_response: editedResponse,
          edited_response: editedResponse,
          confidence_score: 1.0,
          status: 'edited',
          formality: 'sie',
        })

      if (error) {
        console.error('Create manual draft error:', error)
        return NextResponse.json(
          { error: 'Failed to create draft' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Entwurf gespeichert',
    })
  } catch (error) {
    console.error('Save draft error:', error)
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    )
  }
}
