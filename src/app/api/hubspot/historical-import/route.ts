import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyEmail } from '@/lib/ai/openai'
import { analyzeTone, determinePriority } from '@/lib/text-utils'

// Lightweight BI scanning (reused from emails route pattern)
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

    let buyingCount = 0
    let objectionCount = 0
    let churnCount = 0

    for (const tw of triggerWords) {
      if (text.includes(tw.word.toLowerCase())) {
        insightsToInsert.push({
          email_id: emailId,
          insight_type: tw.category,
          content: `Erkanntes Muster: "${tw.word}"`,
          confidence: Math.min(tw.weight / 2, 1.0),
          metadata: { trigger_word: tw.word, weight: tw.weight },
        })

        if (tw.category === 'buying_signal') buyingCount++
        else if (tw.category === 'objection') objectionCount++
        else if (tw.category === 'churn_risk') churnCount++
      }
    }

    if (insightsToInsert.length > 0) {
      await supabase.from('bi_insights').insert(insightsToInsert)
    }

    const urgencyScore =
      tone?.urgency === 'critical' ? 25 :
      tone?.urgency === 'high' ? 18 :
      tone?.urgency === 'medium' ? 10 : 0
    const sentimentScore =
      tone?.sentiment === 'positive' ? 20 :
      tone?.sentiment === 'neutral' ? 10 : 0

    return Math.max(0, Math.min(100,
      Math.min(buyingCount * 20, 60) +
      urgencyScore +
      sentimentScore -
      objectionCount * 8 -
      churnCount * 20
    ))
  } catch {
    return 0
  }
}

async function getSlaTargets(): Promise<Record<string, string>> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('sla_targets').select('id, priority')
    if (!data) return {}
    return Object.fromEntries(data.map(t => [t.priority, t.id]))
  } catch {
    return {}
  }
}

// Historical import: fetches ALL incoming emails from HubSpot using pagination
// Stores them as incoming_emails with full AI analysis
export async function POST(request: NextRequest) {
  try {
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      return NextResponse.json(
        { success: false, imported: 0, skipped: 0, errors: 0, totalFetched: 0, unconfigured: true },
        { status: 200 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const daysBack = Math.min(Math.max(Number(body.daysBack) || 365, 1), 365)
    const maxEmails = Math.min(Math.max(Number(body.maxEmails) || 500, 1), 1000)

    const supabase = await createClient()
    const slaTargets = await getSlaTargets()

    const sinceTimestamp = Date.now() - (daysBack * 24 * 60 * 60 * 1000)

    let imported = 0
    let skipped = 0
    let errors = 0
    let after: string | undefined = undefined
    let totalFetched = 0

    // Paginate through HubSpot CRM Search API (max 100 per page)
    while (totalFetched < maxEmails) {
      const batchSize = Math.min(100, maxEmails - totalFetched)

      const searchBody: Record<string, unknown> = {
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
                value: String(sinceTimestamp),
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
        limit: batchSize,
      }

      if (after) {
        searchBody.after = after
      }

      const searchResponse = await fetch(
        'https://api.hubapi.com/crm/v3/objects/emails/search',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchBody),
        }
      )

      if (!searchResponse.ok) {
        const error = await searchResponse.text()
        console.error('HubSpot Search API error:', error)
        return NextResponse.json(
          { error: 'HubSpot API Fehler', details: error, imported, skipped },
          { status: 500 }
        )
      }

      const searchData = await searchResponse.json()
      const emails = searchData.results || []
      totalFetched += emails.length

      console.log(`Historical import: fetched ${emails.length} emails (total: ${totalFetched})`)

      if (emails.length === 0) break

      // Process each email
      for (const email of emails) {
        const props = email.properties

        // Skip if already exists
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
        if (isNaN(receivedAt.getTime())) receivedAt = new Date()

        const fromName = [props.hs_email_from_firstname, props.hs_email_from_lastname]
          .filter(Boolean)
          .join(' ') || null
        const subject = props.hs_email_subject || 'Kein Betreff'
        const bodyText = props.hs_email_text || ''
        const fromEmail = props.hs_email_from_email || 'unknown@example.com'

        try {
          // AI classification
          const classification = await classifyEmail(fromEmail, subject, bodyText)
          const tone = analyzeTone(subject, bodyText)
          const priority = determinePriority(classification.emailType, tone.urgency, classification.needsResponse)
          const slaTargetId = slaTargets[priority] || null

          const { data: newEmail, error: insertError } = await supabase
            .from('incoming_emails')
            .insert({
              hubspot_email_id: String(email.id),
              hubspot_thread_id: props.hs_email_thread_id || null,
              from_email: fromEmail,
              from_name: fromName,
              subject,
              body_text: bodyText,
              body_html: props.hs_email_html || null,
              received_at: receivedAt.toISOString(),
              status: 'sent', // Historical emails are already handled
              email_type: classification.emailType,
              needs_response: classification.needsResponse,
              classification_reason: classification.reason,
              priority,
              sla_target_id: slaTargetId,
              sla_status: classification.needsResponse ? 'ok' : null,
              tone_formality: tone.formality,
              tone_sentiment: tone.sentiment,
              tone_urgency: tone.urgency,
            })
            .select('id')
            .single()

          if (insertError) {
            console.error('Failed to insert historical email:', insertError.message)
            errors++
          } else if (newEmail?.id) {
            imported++

            // BI scanning for customer inquiries
            if (classification.emailType === 'customer_inquiry' || classification.emailType === 'form_submission') {
              const intentScore = await scanEmailForBiInsights(
                newEmail.id, subject, bodyText,
                { urgency: tone.urgency, sentiment: tone.sentiment }
              )
              if (intentScore > 0) {
                await supabase
                  .from('incoming_emails')
                  .update({ buying_intent_score: intentScore })
                  .eq('id', newEmail.id)
              }
            }
          }
        } catch (err) {
          console.error('Error processing email:', err)
          errors++
        }
      }

      // Check for next page
      const paging = searchData.paging?.next?.after
      if (!paging || emails.length < batchSize) break
      after = paging
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      totalFetched,
      message: `${imported} E-Mails importiert, ${skipped} übersprungen, ${errors} Fehler`,
    })
  } catch (error) {
    console.error('Historical import error:', error)
    return NextResponse.json(
      { error: 'Import fehlgeschlagen', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
