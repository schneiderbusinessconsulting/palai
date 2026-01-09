import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient } from '@/lib/hubspot/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { draftId, finalText } = await request.json()

    const supabase = await createClient()

    // 1. Get the email and draft
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

    const { data: draft, error: draftError } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', draftId)
      .single()

    if (draftError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // 2. Send via HubSpot
    const hubspot = createHubSpotClient()
    const responseText = finalText || draft.edited_response || draft.ai_generated_response

    const sentEmail = await hubspot.sendEmail({
      to: email.from_email,
      subject: `Re: ${email.subject}`,
      body: responseText,
      threadId: email.hubspot_thread_id,
    })

    // 3. Update draft status
    await supabase
      .from('email_drafts')
      .update({
        status: finalText ? 'edited' : 'approved',
        edited_response: finalText || null,
        sent_at: new Date().toISOString(),
        hubspot_sent_email_id: sentEmail.id,
      })
      .eq('id', draftId)

    // 4. Update email status
    await supabase
      .from('incoming_emails')
      .update({ status: 'sent' })
      .eq('id', emailId)

    // 5. Log to audit
    await supabase.from('audit_log').insert({
      email_id: emailId,
      draft_id: draftId,
      action: 'sent',
      details: {
        hubspot_sent_email_id: sentEmail.id,
        was_edited: !!finalText,
      },
    })

    return NextResponse.json({
      success: true,
      hubspotEmailId: sentEmail.id,
    })
  } catch (error) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
