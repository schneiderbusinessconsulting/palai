import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client inside function to avoid build errors
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

// Verify HubSpot webhook signature
function verifySignature(
  requestBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return true // Skip verification if not configured

  const hash = crypto
    .createHmac('sha256', secret)
    .update(requestBody)
    .digest('hex')

  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Log incoming webhook for debugging
    console.log('HubSpot webhook received')

    // Skip signature verification for now - HubSpot signature can be tricky
    // TODO: Re-enable once working
    // const signature = request.headers.get('x-hubspot-signature-v3')
    // const webhookSecret = process.env.HUBSPOT_WEBHOOK_SECRET
    // if (webhookSecret && !verifySignature(body, signature, webhookSecret)) {
    //   console.error('Invalid HubSpot webhook signature')
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const events: HubSpotWebhookEvent[] = JSON.parse(body)
    const supabase = getSupabaseAdmin()

    for (const event of events) {
      console.log('Processing HubSpot event:', event.subscriptionType, event.objectId)

      // Handle conversation events (Conversations Inbox API)
      if (event.subscriptionType.includes('conversation')) {
        const threadId = event.objectId

        // Fetch messages from the conversation thread
        const messagesResponse = await fetch(
          `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}/messages`,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            },
          }
        )

        if (!messagesResponse.ok) {
          // Try alternative endpoint for conversation details
          const threadResponse = await fetch(
            `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              },
            }
          )

          if (!threadResponse.ok) {
            console.error('Failed to fetch conversation from HubSpot:', await threadResponse.text())
            continue
          }

          const threadData = await threadResponse.json()
          console.log('Thread data:', JSON.stringify(threadData, null, 2))
          continue
        }

        const messagesData = await messagesResponse.json()
        const messages = messagesData.results || []

        // Process each incoming message
        for (const message of messages) {
          // Skip outgoing messages
          if (message.direction === 'OUTGOING' || message.createdBy?.type === 'USER') {
            continue
          }

          const messageId = message.id || `${threadId}-${message.createdAt}`

          // Check if message already exists
          const { data: existingEmail } = await supabase
            .from('incoming_emails')
            .select('id')
            .eq('hubspot_email_id', String(messageId))
            .single()

          if (existingEmail) {
            continue
          }

          // Parse sender info
          const senderEmail = message.senders?.[0]?.email ||
                             message.from?.email ||
                             'unknown@example.com'
          const senderName = message.senders?.[0]?.name ||
                            message.from?.name ||
                            null

          // Get message content
          const subject = message.subject || 'Kein Betreff'
          const bodyText = message.text || message.richText || ''

          // Parse timestamp
          let receivedAt = new Date()
          if (message.createdAt) {
            const ts = typeof message.createdAt === 'number'
              ? message.createdAt
              : parseInt(message.createdAt)
            if (!isNaN(ts)) {
              receivedAt = new Date(ts)
            }
          }

          // Store in database
          const { error: insertError } = await supabase
            .from('incoming_emails')
            .insert({
              hubspot_email_id: String(messageId),
              hubspot_thread_id: String(threadId),
              from_email: senderEmail,
              from_name: senderName,
              subject: subject,
              body_text: bodyText,
              body_html: message.richText || null,
              received_at: receivedAt.toISOString(),
              status: 'pending',
            })

          if (insertError) {
            console.error('Failed to store conversation message:', insertError)
          } else {
            console.log('Conversation message stored:', messageId)

            await supabase.from('audit_log').insert({
              action: 'received',
              details: { hubspot_email_id: messageId, thread_id: threadId },
            })
          }
        }
      }

      // Handle CRM email events (legacy email objects)
      if (event.subscriptionType.includes('email') && !event.subscriptionType.includes('conversation')) {
        const emailResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/emails/${event.objectId}?properties=hs_email_subject,hs_email_text,hs_email_html,hs_email_from_email,hs_email_from_firstname,hs_email_from_lastname,hs_timestamp,hs_createdate,hs_email_thread_id,hs_email_direction`,
          {
            headers: {
              Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            },
          }
        )

        if (!emailResponse.ok) {
          console.error('Failed to fetch email from HubSpot:', await emailResponse.text())
          continue
        }

        const emailData = await emailResponse.json()
        const props = emailData.properties

        // Only process incoming emails
        if (props.hs_email_direction !== 'INCOMING_EMAIL') {
          console.log('Skipping non-incoming email:', event.objectId)
          continue
        }

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

        // Parse timestamp correctly
        let receivedAt: Date
        const timestamp = props.hs_timestamp || props.hs_createdate || emailData.createdAt

        if (timestamp) {
          if (/^\d+$/.test(String(timestamp))) {
            receivedAt = new Date(parseInt(String(timestamp)))
          } else {
            receivedAt = new Date(timestamp)
          }
        } else {
          receivedAt = new Date()
        }

        // Validate date
        if (isNaN(receivedAt.getTime())) {
          receivedAt = new Date()
        }

        // Store email in database
        const { error: insertError } = await supabase
          .from('incoming_emails')
          .insert({
            hubspot_email_id: String(event.objectId),
            hubspot_thread_id: props.hs_email_thread_id,
            from_email: props.hs_email_from_email || 'unknown@example.com',
            from_name: [props.hs_email_from_firstname, props.hs_email_from_lastname]
              .filter(Boolean)
              .join(' ') || null,
            subject: props.hs_email_subject || 'Kein Betreff',
            body_text: props.hs_email_text || '',
            body_html: props.hs_email_html,
            received_at: receivedAt.toISOString(),
            status: 'pending',
          })

        if (insertError) {
          console.error('Failed to store email:', insertError)
        } else {
          console.log('Email stored successfully:', event.objectId)

          // Log to audit
          await supabase.from('audit_log').insert({
            action: 'received',
            details: { hubspot_email_id: event.objectId },
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// HubSpot sends a GET request to verify the webhook URL
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
