import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding, generateEmailDraft, classifyEmail } from '@/lib/ai/openai'

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

    // Search for relevant knowledge chunks
    const { data: chunks } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: embedding,
        match_threshold: 0.65,
        match_count: 5,
      }
    )

    const relevantChunks = chunks?.map((c: { content: string }) => c.content) || []
    const chunkIds = chunks?.map((c: { id: string }) => c.id) || []

    // Generate draft using AI
    const { response, confidence, detectedFormality } = await generateEmailDraft(
      emailContent,
      relevantChunks,
      fromName || undefined
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
    const limit = parseInt(searchParams.get('limit') || '20')
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
          status
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

      // Insert email and get the new ID
      const fromName = [props.hs_email_from_firstname, props.hs_email_from_lastname]
        .filter(Boolean)
        .join(' ') || null
      const subject = props.hs_email_subject || 'Kein Betreff'
      const bodyText = props.hs_email_text || ''
      const fromEmail = props.hs_email_from_email || 'unknown@example.com'

      // Classify email type (system alert, form submission, customer inquiry)
      const classification = await classifyEmail(fromEmail, subject, bodyText)

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
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert email:', insertError)
      } else {
        imported++
        // Only generate draft for emails that need a response
        if (newEmail?.id && classification.needsResponse) {
          generateDraftForEmail(newEmail.id, subject, bodyText, fromName)
            .catch(err => console.error('Background draft generation failed:', err))
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
