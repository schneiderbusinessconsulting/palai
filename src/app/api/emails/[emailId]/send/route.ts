import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient } from '@/lib/hubspot/client'
import { wordEditDistance } from '@/lib/text-utils'

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

      if (!sentEmail.actualSent) {
        console.log('Email logged to HubSpot but not actually sent - RESEND_API_KEY not configured')
      }
    }

    // 3. Assign owner to sent email if specified (skip for draft only)
    if (ownerId && !draftOnly) {
      try {
        await hubspot.assignOwnerToEmail(sentEmail.id, ownerId)
        if (email.hubspot_email_id) {
          await hubspot.updateEmailStatus(email.hubspot_email_id, 'REPLIED')
          await hubspot.assignOwnerToEmail(email.hubspot_email_id, ownerId)
        }
      } catch (e) {
        console.error('Failed to assign owner:', e)
      }
    }

    // 4. Self-learning: calculate edit distance if draft was manually edited
    const wasEdited = !!finalText
    let editDist: number | null = null

    if (wasEdited && draft.ai_generated_response) {
      editDist = wordEditDistance(draft.ai_generated_response, finalText)
    }

    // 5. Update draft status (with learning fields)
    const draftStatus = draftOnly ? 'saved_to_hubspot' : (finalText ? 'edited' : 'approved')
    await supabase
      .from('email_drafts')
      .update({
        status: draftStatus,
        edited_response: finalText || null,
        sent_at: draftOnly ? null : new Date().toISOString(),
        hubspot_sent_email_id: sentEmail.id,
        // Phase 2: Self-learning fields (graceful: ignore error if columns missing)
        was_manually_rewritten: wasEdited || null,
        edit_distance: editDist,
      })
      .eq('id', draftId)

    // 6. Update email status + SLA resolution time
    const now = new Date().toISOString()
    await supabase
      .from('incoming_emails')
      .update({
        status: draftOnly ? 'draft_saved' : 'sent',
        assigned_owner_id: ownerId || null,
        // Phase 4: SLA tracking — mark resolved when sent
        ...(draftOnly ? {} : { resolved_at: now }),
      })
      .eq('id', emailId)

    // 7. Phase 4: Compute and store SLA status
    if (!draftOnly && email.received_at) {
      try {
        const receivedMs = new Date(email.received_at).getTime()
        const resolvedMs = new Date(now).getTime()
        const resolutionMinutes = Math.floor((resolvedMs - receivedMs) / (1000 * 60))

        // Determine SLA compliance based on priority
        const slaThresholds: Record<string, number> = {
          critical: 240,  // 4h
          high: 480,      // 8h
          normal: 1440,   // 24h
          low: 2880,      // 48h
        }
        const priority = email.priority || 'normal'
        const threshold = slaThresholds[priority] || slaThresholds.normal
        const slaStatus = resolutionMinutes <= threshold ? 'ok' : 'breached'

        await supabase
          .from('incoming_emails')
          .update({ sla_status: slaStatus })
          .eq('id', emailId)
      } catch {
        // Ignore SLA update errors (columns may not exist yet)
      }
    }

    // 8. Phase 2: Create learning case if draft was significantly edited
    // Use dynamic threshold from app_config (fallback to 0.1)
    let learningThreshold = 0.1
    try {
      const { data: configRow } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'learning_min_edit_distance')
        .single()
      if (configRow) learningThreshold = parseFloat(configRow.value) || 0.1
    } catch { /* use default */ }

    if (wasEdited && editDist !== null && editDist > learningThreshold) {
      try {
        await supabase.from('learning_cases').insert({
          email_id: emailId,
          draft_id: draftId,
          original_draft: draft.ai_generated_response,
          corrected_response: finalText,
          edit_distance: editDist,
          difficulty_score: editDist, // initially same as edit distance
          was_escalated: false,
          knowledge_extracted: false,
          status: 'pending',
        })
      } catch {
        // Ignore if learning_cases table doesn't exist yet
      }
    }

    // 9. Log to audit
    await supabase.from('audit_log').insert({
      email_id: emailId,
      draft_id: draftId,
      action: draftOnly ? 'saved_to_hubspot' : 'sent',
      details: {
        hubspot_sent_email_id: sentEmail.id,
        was_edited: wasEdited,
        edit_distance: editDist,
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
