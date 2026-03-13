import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateEmailDraft, classifyEmail } from '@/lib/ai/openai'
import { analyzeTone, determinePriority } from '@/lib/text-utils'

// Phase 3: BI scanning — fire-and-forget, runs in background after email insert
async function scanEmailForBiInsights(emailId: string, subject: string, bodyText: string) {
  try {
    const supabase = await createClient()
    const { data: triggerWords } = await supabase
      .from('bi_trigger_words')
      .select('word, category, weight')
      .eq('is_active', true)

    if (!triggerWords?.length) return

    const text = `${subject} ${bodyText}`.toLowerCase()
    const insightsToInsert: Array<{
      email_id: string
      insight_type: string
      content: string
      confidence: number
      metadata: Record<string, unknown>
    }> = []

    for (const tw of triggerWords) {
      if (text.includes(tw.word.toLowerCase())) {
        // Check if this category is already added (avoid duplicates)
        const alreadyAdded = insightsToInsert.some(i => i.insight_type === tw.category)
        if (!alreadyAdded) {
          insightsToInsert.push({
            email_id: emailId,
            insight_type: tw.category,
            content: `Erkanntes Muster: "${tw.word}"`,
            confidence: Math.min(tw.weight / 2, 1.0),
            metadata: { trigger_word: tw.word, weight: tw.weight },
          })
        }
      }
    }

    if (insightsToInsert.length > 0) {
      await supabase.from('bi_insights').insert(insightsToInsert)
    }
  } catch {
    // Ignore — BI table may not exist yet (migration 006 not applied)
  }
}

// Phase 4: Fetch SLA targets once per import batch
async function getSlaTargets(): Promise<Record<string, string>> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('sla_targets').select('id, priority')
    if (!data) return {}
    return Object.fromEntries(data.map(t => [t.priority, t.id]))
  } catch {
    return {} // sla_targets table may not exist yet
  }
}

// Helper function to generate draft for an email (runs in background)
async function generateDraftForEmail(
  emailId: string,
  subject: string,
  bodyText: string,
  fromName?: string | null
) {
  try {
    const supabase = await createClient()

    // Check if draft already exists
    const { data: existingDraft } = await supabase
      .from('email_drafts')
      .select('id')
      .eq('email_id', emailId)
      .single()

    if (existingDraft) {
      return // Already has a draft
    }

    // Create embedding for the email content
    const emailContent = `${subject}\n\n${bodyText}`
    const embedding = await createEmbedding(emailContent)

    // Search for relevant knowledge chunks (threshold 0.5 for broader matching)
    const { data: chunks } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      }
    )

    const relevantChunks = chunks?.map((c: { content: string }) => c.content) || []
    const chunkIds = chunks?.map((c: { id: string }) => c.id) || []

    // Fetch AI instructions (rules) - these always apply
    const { data: aiRules } = await supabase
      .from('knowledge_chunks')
      .select('content')
      .eq('source_type', 'ai_instructions')

    const aiInstructions = aiRules?.map((r: { content: string }) => r.content) || []

    // Generate draft using AI (with AI instructions/rules)
    const { response, confidence, detectedFormality } = await generateEmailDraft(
      emailContent,
      relevantChunks,
      fromName || undefined,
      undefined, // formality - auto-detect
      undefined, // feedback
      aiInstructions
    )

    // Store the draft
    await supabase
      .from('email_drafts')
      .insert({
        email_id: emailId,
        ai_generated_response: response,
        confidence_score: confidence,
        relevant_chunks: chunkIds,
        formality: detectedFormality,
        status: 'pending',
      })

    // Update email status
    await supabase
      .from('incoming_emails')
      .update({ status: 'draft_ready' })
      .eq('id', emailId)

    console.log(`Auto-generated draft for email ${emailId}`)
  } catch (error) {
    console.error(`Failed to auto-generate draft for email ${emailId}:`, error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    let query = supabase
      .from('incoming_emails')
      .select(`
        *,
        email_drafts (
          id,
          ai_generated_response,
          edited_response,
          confidence_score,
          status,
          formality
        )
      `, { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: emails, error, count } = await query

    if (error) {
      console.error('Failed to fetch emails:', error)
      return NextResponse.json(
        { error: 'Failed to fetch emails' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      emails: emails || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Emails API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}

// Manual sync from HubSpot - uses CRM Search API for recent incoming emails
export async function POST(request: NextRequest) {
  try {
    // Check if auto-draft is enabled
    const { searchParams } = new URL(request.url)
    const autoDraftEnabled = searchParams.get('autoDraft') === 'true'

    const supabase = await createClient()

    // Use CRM Search API to find recent incoming emails (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

    const searchResponse = await fetch(
      'https://api.hubapi.com/crm/v3/objects/emails/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'hs_email_direction',
                  operator: 'EQ',
                  value: 'INCOMING_EMAIL',
                },
                {
                  propertyName: 'hs_timestamp',
                  operator: 'GTE',
                  value: String(thirtyDaysAgo),
                },
              ],
            },
          ],
          sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
          properties: [
            'hs_email_subject',
            'hs_email_text',
            'hs_email_html',
            'hs_email_from_email',
            'hs_email_from_firstname',
            'hs_email_from_lastname',
            'hs_timestamp',
            'hs_createdate',
            'hs_email_thread_id',
            'hs_email_direction',
          ],
          limit: 100,
        }),
      }
    )

    if (!searchResponse.ok) {
      const error = await searchResponse.text()
      console.error('HubSpot Search API error:', error)
      return NextResponse.json(
        { error: 'Failed to search HubSpot emails', details: error },
        { status: 500 }
      )
    }

    const searchData = await searchResponse.json()
    const emails = searchData.results || []

    console.log(`Found ${emails.length} incoming emails from HubSpot`)

    let imported = 0
    let skipped = 0

    // Phase 4: Fetch SLA targets once for this batch
    const slaTargets = await getSlaTargets()

    for (const email of emails) {
      const props = email.properties

      // Check if already exists
      const { data: existing } = await supabase
        .from('incoming_emails')
        .select('id')
        .eq('hubspot_email_id', String(email.id))
        .single()

      if (existing) {
        skipped++
        continue
      }

      // Parse timestamp
      let receivedAt = new Date()
      const timestamp = props.hs_timestamp || props.hs_createdate

      if (timestamp) {
        if (/^\d+$/.test(String(timestamp))) {
          receivedAt = new Date(parseInt(String(timestamp)))
        } else {
          receivedAt = new Date(timestamp)
        }
      }

      if (isNaN(receivedAt.getTime())) {
        receivedAt = new Date()
      }

      const fromName = [props.hs_email_from_firstname, props.hs_email_from_lastname]
        .filter(Boolean)
        .join(' ') || null
      const subject = props.hs_email_subject || 'Kein Betreff'
      const bodyText = props.hs_email_text || ''
      const fromEmail = props.hs_email_from_email || 'unknown@example.com'

      // Classify email type (system alert, form submission, customer inquiry)
      const classification = await classifyEmail(fromEmail, subject, bodyText)

      // Phase 5: Tone analysis (rule-based, free)
      const tone = analyzeTone(subject, bodyText)

      // Phase 4: Determine priority + SLA target
      const priority = determinePriority(classification.emailType, tone.urgency, classification.needsResponse)
      const slaTargetId = slaTargets[priority] || null

      const { data: newEmail, error: insertError } = await supabase
        .from('incoming_emails')
        .insert({
          hubspot_email_id: String(email.id),
          hubspot_thread_id: props.hs_email_thread_id || null,
          from_email: fromEmail,
          from_name: fromName,
          subject: subject,
          body_text: bodyText,
          body_html: props.hs_email_html || null,
          received_at: receivedAt.toISOString(),
          status: 'pending',
          email_type: classification.emailType,
          needs_response: classification.needsResponse,
          classification_reason: classification.reason,
          // Phase 4: SLA
          priority,
          sla_target_id: slaTargetId,
          sla_status: classification.needsResponse ? 'ok' : null,
          // Phase 5: Tone
          tone_formality: tone.formality,
          tone_sentiment: tone.sentiment,
          tone_urgency: tone.urgency,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert email:', insertError)
      } else {
        imported++
        if (newEmail?.id) {
          // Phase 3: BI scanning (fire-and-forget)
          if (classification.emailType === 'customer_inquiry' || classification.emailType === 'form_submission') {
            scanEmailForBiInsights(newEmail.id, subject, bodyText)
              .catch(err => console.error('BI scan failed:', err))
          }
          // Auto-draft if enabled
          if (autoDraftEnabled && classification.needsResponse) {
            generateDraftForEmail(newEmail.id, subject, bodyText, fromName)
              .catch(err => console.error('Background draft generation failed:', err))
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: emails.length,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}

// Re-classify existing emails AND sync HubSpot conversation status
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'classify'

    const supabase = await createClient()

    // Action: sync-status - Check HubSpot for closed conversations
    if (action === 'sync-status') {
      // Get all pending emails with thread IDs
      const { data: pendingEmails, error: fetchError } = await supabase
        .from('incoming_emails')
        .select('id, hubspot_thread_id')
        .in('status', ['pending', 'draft_ready'])
        .not('hubspot_thread_id', 'is', null)

      if (fetchError) {
        return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
      }

      // Get unique thread IDs
      const threadIds = [...new Set(pendingEmails?.map(e => e.hubspot_thread_id).filter(Boolean))]
      let closedCount = 0

      // Check each thread's status in HubSpot
      for (const threadId of threadIds) {
        try {
          // Try Conversations API first
          const response = await fetch(
            `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              },
            }
          )

          if (response.ok) {
            const thread = await response.json()
            // HubSpot thread status: OPEN, CLOSED
            if (thread.status === 'CLOSED') {
              // Mark all emails in this thread as sent
              const { data: updated } = await supabase
                .from('incoming_emails')
                .update({ status: 'sent' })
                .eq('hubspot_thread_id', threadId)
                .in('status', ['pending', 'draft_ready'])
                .select('id')

              closedCount += updated?.length || 0
            }
          }
        } catch (err) {
          console.error(`Failed to check thread ${threadId}:`, err)
        }
      }

      return NextResponse.json({
        success: true,
        checkedThreads: threadIds.length,
        closedEmails: closedCount,
        message: `${closedCount} E-Mails als geschlossen markiert`,
      })
    }

    // Default action: classify
    // Get all emails without classification
    const { data: unclassifiedEmails, error: fetchError } = await supabase
      .from('incoming_emails')
      .select('id, from_email, subject, body_text')
      .is('email_type', null)

    if (fetchError) {
      console.error('Failed to fetch unclassified emails:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch emails' },
        { status: 500 }
      )
    }

    let classified = 0
    let systemMails = 0

    for (const email of unclassifiedEmails || []) {
      const classification = await classifyEmail(
        email.from_email,
        email.subject,
        email.body_text || ''
      )

      await supabase
        .from('incoming_emails')
        .update({
          email_type: classification.emailType,
          needs_response: classification.needsResponse,
          classification_reason: classification.reason,
        })
        .eq('id', email.id)

      classified++
      if (classification.emailType === 'system_alert' || classification.emailType === 'notification') {
        systemMails++
      }
    }

    return NextResponse.json({
      success: true,
      classified,
      systemMails,
      message: `${classified} E-Mails klassifiziert, davon ${systemMails} System-Mails`,
    })
  } catch (error) {
    console.error('PATCH error:', error)
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}
