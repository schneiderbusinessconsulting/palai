import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { processNewEmail } from '@/lib/email-processing'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface HubSpotWebhookEvent {
  eventId: number
  subscriptionId: number
  portalId: number
  occurredAt: number
  subscriptionType: string
  attemptNumber: number
  objectId: number
  propertyName?: string
  propertyValue?: string
  changeSource?: string
}

function verifySignature(requestBody: string, signature: string | null, secret: string): boolean {
  if (!secret) return false
  if (!signature) return false
  const hash = crypto.createHmac('sha256', secret).update(requestBody).digest('hex')
  return hash === signature
}

/** Idempotency: record event, return false if already processed */
async function markEventProcessed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  event: HubSpotWebhookEvent,
  result: string
): Promise<boolean> {
  const { error } = await supabase.from('hubspot_webhook_events').insert({
    event_id: event.eventId,
    subscription_type: event.subscriptionType,
    object_id: event.objectId,
    occurred_at: new Date(event.occurredAt).toISOString(),
    result,
  })
  // Unique constraint violation = already processed
  if (error?.code === '23505') return false
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    console.log('HubSpot webhook received')

    const signature = request.headers.get('x-hubspot-signature-v3')
    const webhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('HUBSPOT_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 401 })
    }
    if (!verifySignature(body, signature, webhookSecret)) {
      console.error('Invalid HubSpot webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const events: HubSpotWebhookEvent[] = JSON.parse(body)
    const supabase = getSupabaseAdmin()

    for (const event of events) {
      console.log('Processing HubSpot event:', event.subscriptionType, event.objectId)

      // ── Conversation events ──────────────────────────────────────────────
      if (event.subscriptionType.startsWith('conversation.')) {

        // conversation.propertyChange with status → mark thread resolved
        if (
          event.subscriptionType === 'conversation.propertyChange' &&
          event.propertyName === 'hs_conversation_status' &&
          event.propertyValue === 'CLOSED'
        ) {
          const isNew = await markEventProcessed(supabase, event, 'resolved')
          if (!isNew) { console.log('Duplicate event, skipping:', event.eventId); continue }

          const { data: updated } = await supabase
            .from('incoming_emails')
            .update({
              status: 'sent',
              hubspot_status: 'CLOSED',
              sync_source: 'webhook',
              last_hubspot_sync_at: new Date().toISOString(),
            })
            .or(`hubspot_thread_id.eq.${event.objectId},hubspot_conversation_id.eq.${event.objectId}`)
            .in('status', ['pending', 'draft_ready'])
            .select('id')

          console.log(`Conversation CLOSED: marked ${updated?.length ?? 0} email(s) as sent`)
          continue
        }

        // conversation.newMessage / conversation.creation → import incoming message
        const threadId = event.objectId
        const messagesResponse = await fetch(
          `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}/messages`,
          { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } }
        )

        if (!messagesResponse.ok) {
          console.error('Failed to fetch conversation messages:', await messagesResponse.text())
          continue
        }

        const messagesData = await messagesResponse.json()
        const messages = messagesData.results || []

        for (const message of messages) {
          // OUTGOING message from team → mark the thread as resolved in our DB
          if (message.direction === 'OUTGOING' || message.createdBy?.type === 'USER') {
            const replyText = message.text || message.richText || ''
            const replyAt = message.createdAt
              ? new Date(typeof message.createdAt === 'number' ? message.createdAt : parseInt(message.createdAt)).toISOString()
              : new Date().toISOString()

            await supabase
              .from('incoming_emails')
              .update({
                status: 'sent',
                hubspot_reply_text: replyText || null,
                hubspot_reply_at: replyAt,
                hubspot_reply_from: message.senders?.[0]?.email || null,
                hubspot_conversation_id: String(threadId),
                sync_source: 'webhook',
                last_hubspot_sync_at: new Date().toISOString(),
              })
              .eq('hubspot_conversation_id', String(threadId))
              .in('status', ['pending', 'draft_ready'])

            continue
          }

          const messageId = message.id || `${threadId}-${message.createdAt}`

          // Idempotency: skip if already in DB
          const { data: existingEmail } = await supabase
            .from('incoming_emails')
            .select('id')
            .eq('hubspot_email_id', String(messageId))
            .single()
          if (existingEmail) continue

          const senderEmail = message.senders?.[0]?.email || message.from?.email || 'unknown@example.com'
          const senderName = message.senders?.[0]?.name || message.from?.name || null
          const subject = message.subject || 'Kein Betreff'
          const bodyText = message.text || message.richText || ''

          let receivedAt = new Date()
          if (message.createdAt) {
            const ts = typeof message.createdAt === 'number' ? message.createdAt : parseInt(message.createdAt)
            if (!isNaN(ts)) receivedAt = new Date(ts)
          }

          const { error: insertError } = await supabase.from('incoming_emails').insert({
            hubspot_email_id: String(messageId),
            hubspot_thread_id: String(threadId),
            hubspot_conversation_id: String(threadId),
            from_email: senderEmail,
            from_name: senderName,
            subject,
            body_text: bodyText,
            body_html: message.richText || null,
            received_at: receivedAt.toISOString(),
            status: 'pending',
            sync_source: 'webhook',
          })

          if (insertError) {
            console.error('Failed to store conversation message:', insertError)
          } else {
            console.log('Conversation message stored:', messageId)
            await supabase.from('audit_log').insert({
              action: 'received',
              details: { hubspot_email_id: messageId, thread_id: threadId, source: 'webhook' },
            })
            // Classify email (tone, spam, topics, BI) — fire-and-forget
            const { data: inserted } = await supabase
              .from('incoming_emails')
              .select('id')
              .eq('hubspot_email_id', String(messageId))
              .single()
            if (inserted) {
              processNewEmail(inserted.id, senderEmail, subject, bodyText).catch(e =>
                console.error('Classification failed for webhook email:', e)
              )
            }
          }
        }
        continue
      }

      // ── CRM email events ─────────────────────────────────────────────────
      if (event.subscriptionType.includes('email')) {
        const emailResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/emails/${event.objectId}?properties=hs_email_subject,hs_email_text,hs_email_html,hs_email_from_email,hs_email_from_firstname,hs_email_from_lastname,hs_timestamp,hs_createdate,hs_email_thread_id,hs_email_direction`,
          { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } }
        )

        if (!emailResponse.ok) {
          console.error('Failed to fetch email from HubSpot:', await emailResponse.text())
          continue
        }

        const emailData = await emailResponse.json()
        const props = emailData.properties

        // ── OUTBOUND reply sent in HubSpot ──────────────────────────────────
        if (props.hs_email_direction === 'EMAIL' && props.hs_email_thread_id) {
          const isNew = await markEventProcessed(supabase, event, 'outbound_reply')
          if (!isNew) { console.log('Duplicate outbound event, skipping:', event.eventId); continue }

          // Parse reply timestamp
          const replyTs = props.hs_timestamp || props.hs_createdate || emailData.createdAt
          let replyAt: string = new Date().toISOString()
          if (replyTs) {
            replyAt = /^\d+$/.test(String(replyTs))
              ? new Date(parseInt(String(replyTs))).toISOString()
              : new Date(replyTs).toISOString()
          }

          // Only mark emails received BEFORE the reply as sent (EC-5: avoid marking follow-ups)
          const { data: updated } = await supabase
            .from('incoming_emails')
            .update({
              status: 'sent',
              hubspot_reply_email_id: String(event.objectId),
              hubspot_reply_text: props.hs_email_text || null,
              hubspot_reply_at: replyAt,
              hubspot_reply_from: props.hs_email_from_email || null,
              sync_source: 'webhook',
              last_hubspot_sync_at: new Date().toISOString(),
            })
            .eq('hubspot_thread_id', props.hs_email_thread_id)
            .in('status', ['pending', 'draft_ready'])
            .lt('received_at', replyAt) // Only emails received before the reply
            .select('id')

          console.log(`Outbound reply detected: marked ${updated?.length ?? 0} email(s) as sent (thread: ${props.hs_email_thread_id})`)
          continue
        }

        // ── INCOMING email ──────────────────────────────────────────────────
        if (props.hs_email_direction !== 'INCOMING_EMAIL') {
          console.log('Skipping non-incoming email:', event.objectId)
          continue
        }

        const isNew = await markEventProcessed(supabase, event, 'imported')
        if (!isNew) { console.log('Duplicate incoming event, skipping:', event.eventId); continue }

        // Check if email already exists
        const { data: existingEmail } = await supabase
          .from('incoming_emails')
          .select('id')
          .eq('hubspot_email_id', String(event.objectId))
          .single()
        if (existingEmail) {
          console.log('Email already exists:', event.objectId)
          continue
        }

        let receivedAt: Date
        const timestamp = props.hs_timestamp || props.hs_createdate || emailData.createdAt
        if (timestamp) {
          receivedAt = /^\d+$/.test(String(timestamp))
            ? new Date(parseInt(String(timestamp)))
            : new Date(timestamp)
        } else {
          receivedAt = new Date()
        }
        if (isNaN(receivedAt.getTime())) receivedAt = new Date()

        const { error: insertError } = await supabase.from('incoming_emails').insert({
          hubspot_email_id: String(event.objectId),
          hubspot_thread_id: props.hs_email_thread_id,
          from_email: props.hs_email_from_email || 'unknown@example.com',
          from_name: [props.hs_email_from_firstname, props.hs_email_from_lastname].filter(Boolean).join(' ') || null,
          subject: props.hs_email_subject || 'Kein Betreff',
          body_text: props.hs_email_text || '',
          body_html: props.hs_email_html,
          received_at: receivedAt.toISOString(),
          status: 'pending',
          sync_source: 'webhook',
        })

        if (insertError) {
          console.error('Failed to store email:', insertError)
        } else {
          console.log('Email stored successfully:', event.objectId)
          await supabase.from('audit_log').insert({
            action: 'received',
            details: { hubspot_email_id: event.objectId, source: 'webhook' },
          })
          // Classify email (tone, spam, topics, BI) — fire-and-forget
          const fromEmail = props.hs_email_from_email || 'unknown@example.com'
          const subjectText = props.hs_email_subject || 'Kein Betreff'
          const bodyTextContent = props.hs_email_text || ''
          const { data: inserted } = await supabase
            .from('incoming_emails')
            .select('id')
            .eq('hubspot_email_id', String(event.objectId))
            .single()
          if (inserted) {
            processNewEmail(inserted.id, fromEmail, subjectText, bodyTextContent).catch(e =>
              console.error('Classification failed for CRM webhook email:', e)
            )
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
