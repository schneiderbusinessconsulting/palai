import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHubSpotClient } from '@/lib/hubspot/client'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Polling fallback for bidirectional HubSpot sync.
 * Checks all open threads for outbound replies or closed status in HubSpot.
 *
 * Configure in Railway:
 *   GET /api/cron/hubspot-sync?secret=<CRON_SECRET>
 *   Schedule: every 15 minutes
 */
export async function GET(request: NextRequest) {
  // Auth check
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'HUBSPOT_ACCESS_TOKEN not configured' }, { status: 500 })
  }

  const supabase = getSupabaseAdmin()
  const hubspot = createHubSpotClient()

  // Fetch open emails that have a HubSpot thread ID and haven't been synced in 30+ min
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: openEmails, error } = await supabase
    .from('incoming_emails')
    .select('id, hubspot_thread_id, hubspot_conversation_id, received_at, first_response_at')
    .in('status', ['pending', 'draft_ready'])
    .not('hubspot_thread_id', 'is', null)
    .or(`last_hubspot_sync_at.is.null,last_hubspot_sync_at.lt.${thirtyMinsAgo}`)
    .order('received_at', { ascending: true })
    .limit(50) // Rate-limit protection: max 50 threads per run

  if (error) {
    console.error('Cron: failed to fetch open emails:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!openEmails || openEmails.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No open threads to sync' })
  }

  let resolved = 0
  let checked = 0
  const errors: string[] = []

  for (const email of openEmails) {
    try {
      checked++

      // 1. Check for outbound replies in HubSpot CRM
      const replies = await hubspot.getOutboundRepliesForThread(email.hubspot_thread_id!)
      if (replies.length > 0) {
        // Use the earliest reply that came after this email was received
        const validReply = replies.find(r => r.sentAt > email.received_at)
        if (validReply) {
          await supabase
            .from('incoming_emails')
            .update({
              status: 'sent',
              hubspot_reply_email_id: validReply.id,
              hubspot_reply_text: validReply.text || null,
              hubspot_reply_at: validReply.sentAt,
              hubspot_reply_from: validReply.fromEmail || null,
              sync_source: 'polling',
              last_hubspot_sync_at: new Date().toISOString(),
              // Set first_response_at if not already set
              ...(!email.first_response_at ? { first_response_at: validReply.sentAt } : {}),
            })
            .eq('id', email.id)
          resolved++
          continue
        }
      }

      // 2. Check conversation status if we have a conversation ID
      if (email.hubspot_conversation_id) {
        const thread = await hubspot.getConversationThread(email.hubspot_conversation_id)
        if (thread?.status === 'CLOSED') {
          await supabase
            .from('incoming_emails')
            .update({
              status: 'sent',
              hubspot_status: 'CLOSED',
              sync_source: 'polling',
              last_hubspot_sync_at: new Date().toISOString(),
            })
            .eq('id', email.id)
          resolved++
          continue
        }
      }

      // 3. Just update the sync timestamp (no change needed)
      await supabase
        .from('incoming_emails')
        .update({ last_hubspot_sync_at: new Date().toISOString() })
        .eq('id', email.id)

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${email.id}: ${msg}`)
      console.error(`Cron: error syncing email ${email.id}:`, e)
    }
  }

  console.log(`HubSpot cron sync: checked=${checked}, resolved=${resolved}, errors=${errors.length}`)

  return NextResponse.json({
    checked,
    resolved,
    errors: errors.length > 0 ? errors : undefined,
  })
}
