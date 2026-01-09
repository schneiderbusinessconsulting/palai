import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient } from '@/lib/hubspot/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { draftId, finalText, ownerId, draftOnly } = await request.json()

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

    // 2. Send or save draft
    const hubspot = createHubSpotClient()
    const responseText = finalText || draft.edited_response || draft.ai_generated_response

    let sentEmail: { id: string; actualSent: boolean }

    if (draftOnly) {
      // Only save to HubSpot as draft (no Resend)
      sentEmail = await hubspot.saveDraftToHubSpot({
        to: email.from_email,
        subject: `Re: ${email.subject}`,
        body: responseText,
      })
    } else {
      // Full send via Resend + HubSpot
      sentEmail = await hubspot.sendEmail({
        to: email.from_email,
        subject: `Re: ${email.subject}`,
        body: responseText,
        threadId: email.hubspot_thread_id,
      })

      // Check if email was actually sent
      if (!sentEmail.actualSent) {
        console.log('Email logged to HubSpot but not actually sent - RESEND_API_KEY not configured')
      }
    }

    // 3. Assign owner to sent email if specified (skip for draft only)
    if (ownerId && !draftOnly) {
      try {
        await hubspot.assignOwnerToEmail(sentEmail.id, ownerId)
        // Also mark original incoming email as replied in HubSpot
        if (email.hubspot_email_id) {
          await hubspot.updateEmailStatus(email.hubspot_email_id, 'REPLIED')
          await hubspot.assignOwnerToEmail(email.hubspot_email_id, ownerId)
        }
      } catch (e) {
        console.error('Failed to assign owner:', e)
      }
    }

    // 4. Update draft status
    await supabase
      .from('email_drafts')
      .update({
        status: draftOnly ? 'saved_to_hubspot' : (finalText ? 'edited' : 'approved'),
        edited_response: finalText || null,
        sent_at: draftOnly ? null : new Date().toISOString(),
        hubspot_sent_email_id: sentEmail.id,
      })
      .eq('id', draftId)

    // 5. Update email status
    await supabase
      .from('incoming_emails')
      .update({
        status: draftOnly ? 'draft_saved' : 'sent',
        assigned_owner_id: ownerId || null,
      })
      .eq('id', emailId)

    // 6. Log to audit
    await supabase.from('audit_log').insert({
      email_id: emailId,
      draft_id: draftId,
      action: draftOnly ? 'saved_to_hubspot' : 'sent',
      details: {
        hubspot_sent_email_id: sentEmail.id,
        was_edited: !!finalText,
        assigned_owner_id: ownerId,
        draft_only: draftOnly,
      },
    })

    return NextResponse.json({
      success: true,
      hubspotEmailId: sentEmail.id,
      actualSent: draftOnly ? false : sentEmail.actualSent,
      message: draftOnly
        ? 'Entwurf in HubSpot gespeichert'
        : sentEmail.actualSent
          ? 'E-Mail erfolgreich gesendet'
          : 'E-Mail in HubSpot gespeichert (RESEND_API_KEY nicht konfiguriert)',
    })
  } catch (error) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
