import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

// Manual sync from HubSpot Conversations Inbox (OPEN conversations only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Fetch OPEN conversations from HubSpot Inbox
    const inboxResponse = await fetch(
      'https://api.hubapi.com/conversations/v3/conversations?limit=100',
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!inboxResponse.ok) {
      const error = await inboxResponse.text()
      console.error('HubSpot Conversations API error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch from HubSpot Inbox', details: error },
        { status: 500 }
      )
    }

    const inboxData = await inboxResponse.json()
    const conversations = inboxData.results || []

    console.log(`Found ${conversations.length} conversations in HubSpot Inbox`)

    let imported = 0
    let skipped = 0

    for (const convo of conversations) {
      // Skip closed conversations
      if (convo.status === 'CLOSED') {
        skipped++
        continue
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from('incoming_emails')
        .select('id')
        .eq('hubspot_thread_id', String(convo.id))
        .single()

      if (existing) {
        skipped++
        continue
      }

      // Get the latest message from this conversation
      const messagesResponse = await fetch(
        `https://api.hubapi.com/conversations/v3/conversations/${convo.id}/messages?limit=1`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          },
        }
      )

      let subject = convo.subject || 'Kein Betreff'
      let bodyText = ''
      let fromEmail = 'unknown@example.com'
      let fromName = ''
      let receivedAt = new Date()

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        const latestMessage = messagesData.results?.[0]

        if (latestMessage) {
          bodyText = latestMessage.text || latestMessage.richText || ''
          fromEmail = latestMessage.senders?.[0]?.email || latestMessage.from?.email || fromEmail
          fromName = latestMessage.senders?.[0]?.name || latestMessage.from?.name || ''

          if (latestMessage.createdAt) {
            receivedAt = new Date(latestMessage.createdAt)
          }
        }
      }

      // Use conversation data as fallback
      if (!bodyText && convo.preview) {
        bodyText = convo.preview
      }

      if (convo.latestMessageTimestamp) {
        receivedAt = new Date(convo.latestMessageTimestamp)
      }

      // Insert conversation as email
      const { error: insertError } = await supabase
        .from('incoming_emails')
        .insert({
          hubspot_email_id: String(convo.id),
          hubspot_thread_id: String(convo.id),
          from_email: fromEmail,
          from_name: fromName || null,
          subject: subject,
          body_text: bodyText,
          received_at: receivedAt.toISOString(),
          status: 'pending',
        })

      if (insertError) {
        console.error('Failed to insert conversation:', insertError)
      } else {
        imported++
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: conversations.length,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}
