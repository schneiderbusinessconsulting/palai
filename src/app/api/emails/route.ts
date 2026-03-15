import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateEmailDraft, classifyEmail } from '@/lib/ai/openai'
import { analyzeTone, determinePriority } from '@/lib/text-utils'

// Phase 3: BI scanning — fire-and-forget, runs in background after email insert
// Returns buying intent score (0-100) for immediate storage on the email record
async function scanEmailForBiInsights(
  emailId: string,
  subject: string,
  bodyText: string,
  tone?: { urgency?: string; sentiment?: string }
): Promise<number> {
  try {
    const supabase = await createClient()
    const { data: triggerWords } = await supabase
      .from('bi_trigger_words')
      .select('word, category, weight')
      .eq('is_active', true)

    if (!triggerWords?.length) return 0

    const text = `${subject} ${bodyText}`.toLowerCase()
    const insightsToInsert: Array<{
      email_id: string
      insight_type: string
      content: string
      confidence: number
      metadata: Record<string, unknown>
    }> = []

    // Track signal counts for buying intent formula
    let buyingCount = 0
    let objectionCount = 0
    let churnCount = 0

    for (const tw of triggerWords) {
      if (text.includes(tw.word.toLowerCase())) {
        // Store ALL matches — no category deduplication (one signal per word)
        insightsToInsert.push({
          email_id: emailId,
          insight_type: tw.category,
          content: `Erkanntes Muster: "${tw.word}"`,
          confidence: Math.min(tw.weight / 2, 1.0),
          metadata: { trigger_word: tw.word, weight: tw.weight },
        })

        // Count by category for buying intent score
        if (tw.category === 'buying_signal') buyingCount++
        else if (tw.category === 'objection') objectionCount++
        else if (tw.category === 'churn_risk') churnCount++
      }
    }

    if (insightsToInsert.length > 0) {
      await supabase.from('bi_insights').insert(insightsToInsert)
    }

    // Calculate buying intent score (0-100)
    const urgencyScore =
      tone?.urgency === 'critical' ? 25 :
      tone?.urgency === 'high' ? 18 :
      tone?.urgency === 'medium' ? 10 : 0
    const sentimentScore =
      tone?.sentiment === 'positive' ? 20 :
      tone?.sentiment === 'neutral' ? 10 : 0

    const intentScore = Math.max(0, Math.min(100,
      Math.min(buyingCount * 20, 60) +
      urgencyScore +
      sentimentScore -
      objectionCount * 8 -
      churnCount * 20
    ))

    return intentScore
  } catch {
    // Ignore — BI table may not exist yet (migration 006 not applied)
    return 0
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
  fromName?: string | null,
  hubspotThreadId?: string | null
) {
  try {
    const supabase = await createClient()

    // Check if draft already exists
    const { data: existingDraft } = await supabase
      .from('email_drafts')
      .select('id')
      .eq('email_id', emailId)
      .limit(1)
      .maybeSingle()

    if (existingDraft) {
      return // Already has a draft
    }

    // Read dynamic RAG threshold from app_config (fallback to 0.5)
    let ragThreshold = 0.5
    try {
      const { data: configRow } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'rag_match_threshold')
        .single()
      if (configRow) ragThreshold = parseFloat(configRow.value) || 0.5
    } catch { /* use default */ }

    // Create embedding for the email content
    const emailContent = `${subject}\n\n${bodyText}`
    const embedding = await createEmbedding(emailContent)

    // Search for relevant knowledge chunks
    const { data: chunks } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: embedding,
        match_threshold: ragThreshold,
        match_count: 5,
      }
    )

    const relevantChunks = chunks?.map((c: { content: string }) => c.content) || []
    const chunkIds = chunks?.map((c: { id: string }) => c.id) || []
    const maxSimilarity: number = chunks?.length > 0
      ? Math.max(...chunks.map((c: { similarity: number }) => c.similarity || 0))
      : 0

    // Fetch AI instructions (rules) - these always apply
    const { data: aiRules } = await supabase
      .from('knowledge_chunks')
      .select('content')
      .eq('source_type', 'ai_instructions')

    const aiInstructions = aiRules?.map((r: { content: string }) => r.content) || []

    // Build thread history from DB (same thread, previous messages)
    let threadHistory: { direction: string; text: string; timestamp: string }[] = []
    if (hubspotThreadId) {
      try {
        // Step 1: get sibling email IDs in this thread
        const { data: threadEmails } = await supabase
          .from('incoming_emails')
          .select('id, body_text, received_at, status')
          .eq('hubspot_thread_id', hubspotThreadId)
          .neq('id', emailId)
          .order('received_at', { ascending: true })
          .limit(5)

        if (threadEmails && threadEmails.length > 0) {
          // Incoming emails from thread
          const incoming = threadEmails.map((e: { id: string; body_text: string; received_at: string; status: string }) => ({
            direction: e.status === 'sent' ? 'EMAIL' : 'INCOMING_EMAIL',
            text: e.body_text || '',
            timestamp: e.received_at || '',
          }))

          // Step 2: get sent drafts for those email IDs (outgoing replies)
          const threadEmailIds = threadEmails.map((e: { id: string }) => e.id)
          const { data: sentDrafts } = await supabase
            .from('email_drafts')
            .select('email_id, edited_response, ai_generated_response, sent_at')
            .in('email_id', threadEmailIds)
            .eq('status', 'edited')
            .not('sent_at', 'is', null)
            .order('sent_at', { ascending: true })

          // Merge: replace 'sent' status emails with their actual draft text if available
          const draftMap = new Map(
            (sentDrafts || []).map((d: { email_id: string; edited_response: string; ai_generated_response: string; sent_at: string }) => [
              d.email_id,
              { text: d.edited_response || d.ai_generated_response, timestamp: d.sent_at },
            ])
          )

          threadHistory = incoming.map((e, i) => {
            const draft = draftMap.get(threadEmails[i]?.id)
            if (draft && e.direction === 'EMAIL') {
              return { direction: 'EMAIL', text: draft.text, timestamp: draft.timestamp }
            }
            return e
          })
        }
      } catch (e) {
        console.error('Thread history fetch error in auto-draft:', e)
      }
    }

    // Generate draft using AI (with AI instructions/rules + thread history)
    const { response, confidence, detectedFormality } = await generateEmailDraft(
      emailContent,
      relevantChunks,
      fromName || undefined,
      undefined, // formality - auto-detect
      undefined, // feedback
      aiInstructions,
      threadHistory,
      maxSimilarity
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
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase nicht konfiguriert — .env.local prüfen (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const assignedAgentId = searchParams.get('assigned_agent_id')
    const tags = searchParams.get('tags')

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

    // Filter by assigned agent
    if (assignedAgentId === 'unassigned') {
      query = query.is('assigned_agent_id', null)
    } else if (assignedAgentId) {
      query = query.eq('assigned_agent_id', assignedAgentId)
    }

    // Filter by tags (requires tags column from migration 009)
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
      if (tagList.length > 0) {
        query = query.contains('tags', tagList)
      }
    }

    const { data: emails, error, count } = await query

    if (error) {
      console.error('Failed to fetch emails:', error.message, error.code, error.details)
      return NextResponse.json(
        { error: 'Failed to fetch emails', details: error.message },
        { status: 500 }
      )
    }

    // Thread grouping
    const groupByThread = searchParams.get('group_by_thread') === 'true'
    if (groupByThread && emails?.length) {
      const threadMap = new Map<string, typeof emails>()
      const noThread: typeof emails = []

      for (const email of emails) {
        const threadId = (email as Record<string, unknown>).hubspot_thread_id as string | null
        if (threadId) {
          if (!threadMap.has(threadId)) threadMap.set(threadId, [])
          threadMap.get(threadId)!.push(email)
        } else {
          noThread.push(email)
        }
      }

      const threads = Array.from(threadMap.entries()).map(([thread_id, threadEmails]) => ({
        thread_id,
        emails: threadEmails,
        count: threadEmails.length,
        latest_received_at: threadEmails[0].received_at,
        subject: threadEmails[0].subject,
        from_email: threadEmails[0].from_email,
        from_name: threadEmails[0].from_name,
      })).sort((a, b) => new Date(b.latest_received_at).getTime() - new Date(a.latest_received_at).getTime())

      // Add single emails as single-item threads
      for (const email of noThread) {
        threads.push({
          thread_id: email.id,
          emails: [email],
          count: 1,
          latest_received_at: email.received_at,
          subject: email.subject,
          from_email: email.from_email,
          from_name: email.from_name,
        })
      }

      threads.sort((a, b) => new Date(b.latest_received_at).getTime() - new Date(a.latest_received_at).getTime())

      return NextResponse.json({
        threads,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      })
    }

    return NextResponse.json({
      emails: emails || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Emails API error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Manual sync from HubSpot - uses CRM Search API for recent incoming emails
export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase nicht konfiguriert — .env.local prüfen' },
        { status: 503 }
      )
    }
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'HubSpot nicht konfiguriert — HUBSPOT_ACCESS_TOKEN in .env.local fehlt' },
        { status: 503 }
      )
    }

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

    // Default agent: assign to Philipp (L1) by default
    let defaultAgentId: string | null = null
    try {
      const { data: defaultAgent } = await supabase
        .from('support_agents')
        .select('id')
        .eq('role', 'L1')
        .eq('is_active', true)
        .limit(1)
        .single()
      defaultAgentId = defaultAgent?.id || null
    } catch { /* no default agent */ }

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

      // Skip outgoing emails (team replies) — but mark their thread as resolved
      if (props.hs_email_direction === 'EMAIL' && props.hs_email_thread_id) {
        await supabase
          .from('incoming_emails')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('hubspot_thread_id', props.hs_email_thread_id)
          .in('status', ['pending', 'draft_ready'])
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
          // Default assignment
          assigned_agent_id: defaultAgentId,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert email:', insertError)
      } else {
        imported++
        if (newEmail?.id) {
          const hubspotThreadId = props.hs_email_thread_id || null
          // Phase 3: BI scanning — async so we can store buying intent score
          if (classification.emailType === 'customer_inquiry' || classification.emailType === 'form_submission') {
            scanEmailForBiInsights(newEmail.id, subject, bodyText, { urgency: tone.urgency, sentiment: tone.sentiment })
              .then(async (intentScore) => {
                if (intentScore > 0) {
                  const supabase2 = await createClient()
                  await supabase2
                    .from('incoming_emails')
                    .update({ buying_intent_score: intentScore })
                    .eq('id', newEmail.id)
                }
              })
              .catch(err => console.error('BI scan failed:', err))
          }
          // Auto-draft if enabled
          if (autoDraftEnabled && classification.needsResponse) {
            generateDraftForEmail(newEmail.id, subject, bodyText, fromName, hubspotThreadId)
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

    // Default action: full backfill analysis for all emails missing data
    // Get emails without classification OR without tone analysis
    const { data: unanalyzedEmails, error: fetchError } = await supabase
      .from('incoming_emails')
      .select('id, from_email, subject, body_text, email_type, tone_sentiment, buying_intent_score')
      .or('email_type.is.null,tone_sentiment.is.null')
      .limit(200)

    if (fetchError) {
      console.error('Failed to fetch unanalyzed emails:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch emails' },
        { status: 500 }
      )
    }

    let classified = 0
    let toneAnalyzed = 0
    let biScanned = 0
    let systemMails = 0

    // Fetch SLA targets once for the batch
    const slaTargets = await getSlaTargets()

    for (const email of unanalyzedEmails || []) {
      const updates: Record<string, unknown> = {}

      // Step 1: Classify if missing
      if (!email.email_type) {
        const classification = await classifyEmail(
          email.from_email,
          email.subject,
          email.body_text || ''
        )
        updates.email_type = classification.emailType
        updates.needs_response = classification.needsResponse
        updates.classification_reason = classification.reason
        classified++
        if (classification.emailType === 'system_alert' || classification.emailType === 'notification') {
          systemMails++
        }
      }

      // Step 2: Tone analysis if missing
      if (!email.tone_sentiment) {
        const tone = analyzeTone(email.subject, email.body_text || '')
        updates.tone_formality = tone.formality
        updates.tone_sentiment = tone.sentiment
        updates.tone_urgency = tone.urgency

        // Step 3: Priority + SLA (depends on classification + tone)
        const emailType = (updates.email_type || email.email_type) as string
        const priority = determinePriority(emailType, tone.urgency, (updates.needs_response ?? true) as boolean)
        updates.priority = priority
        updates.sla_target_id = slaTargets[priority] || null
        updates.sla_status = (updates.needs_response ?? true) ? 'ok' : null
        toneAnalyzed++
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('incoming_emails')
          .update(updates)
          .eq('id', email.id)
      }

      // Step 4: BI scan if no buying intent yet (for customer inquiries only)
      const emailType = (updates.email_type || email.email_type) as string
      if (
        (email.buying_intent_score === null || email.buying_intent_score === 0) &&
        (emailType === 'customer_inquiry' || emailType === 'form_submission')
      ) {
        const tone = email.tone_sentiment
          ? { urgency: undefined, sentiment: email.tone_sentiment }
          : undefined
        const intentScore = await scanEmailForBiInsights(
          email.id,
          email.subject,
          email.body_text || '',
          tone
        )
        if (intentScore > 0) {
          await supabase
            .from('incoming_emails')
            .update({ buying_intent_score: intentScore })
            .eq('id', email.id)
        }
        biScanned++
      }
    }

    return NextResponse.json({
      success: true,
      total: (unanalyzedEmails || []).length,
      classified,
      toneAnalyzed,
      biScanned,
      systemMails,
      message: `${classified} klassifiziert, ${toneAnalyzed} Tone-Analyse, ${biScanned} BI-Scan, ${systemMails} System-Mails`,
    })
  } catch (error) {
    console.error('PATCH error:', error)
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}
