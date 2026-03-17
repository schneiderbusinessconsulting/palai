import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sync Monitor – Prüft HubSpot-Synchronisierungs-Gesundheit

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const issues: string[] = []
  const now = new Date()

  // E-Mails die seit > 24h auf "pending" stehen
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const { count: over24h } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .eq('hubspot_sync_status', 'pending')
    .lt('created_at', cutoff24h)

  const { count: over48h } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .eq('hubspot_sync_status', 'pending')
    .lt('created_at', cutoff48h)

  if ((over24h ?? 0) > 0) {
    issues.push(`${over24h} E-Mail(s) seit über 24 Stunden im Status "pending"`)
  }
  if ((over48h ?? 0) > 0) {
    issues.push(`${over48h} E-Mail(s) seit über 48 Stunden im Status "pending" – kritisch!`)
  }

  // E-Mails mit hubspot_thread_id aber ohne sync_source
  const { count: missingSource } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .not('hubspot_thread_id', 'is', null)
    .is('sync_source', null)

  if ((missingSource ?? 0) > 0) {
    issues.push(
      `${missingSource} E-Mail(s) haben hubspot_thread_id aber keine sync_source`
    )
  }

  // Letzter erfolgreicher Sync-Zeitpunkt
  const { data: lastSyncRow } = await supabase
    .from('incoming_emails')
    .select('last_hubspot_sync_at')
    .not('last_hubspot_sync_at', 'is', null)
    .order('last_hubspot_sync_at', { ascending: false })
    .limit(1)
    .single()

  const lastSync = lastSyncRow?.last_hubspot_sync_at ?? null

  if (!lastSync) {
    issues.push('Kein erfolgreicher HubSpot-Sync in der Datenbank gefunden')
  } else {
    const lastSyncDate = new Date(lastSync)
    const hoursSinceSync = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60)
    if (hoursSinceSync > 24) {
      issues.push(
        `Letzter HubSpot-Sync ist ${Math.round(hoursSinceSync)} Stunden her`
      )
    }
  }

  // Aufschlüsselung nach sync_source
  const { data: syncSourceRows } = await supabase
    .from('incoming_emails')
    .select('sync_source')
    .not('sync_source', 'is', null)

  const syncSources: Record<string, number> = {}
  if (syncSourceRows) {
    for (const row of syncSourceRows) {
      const src = row.sync_source || 'unknown'
      syncSources[src] = (syncSources[src] || 0) + 1
    }
  }

  return NextResponse.json({
    stale: {
      over24h: over24h ?? 0,
      over48h: over48h ?? 0,
    },
    missingSource: missingSource ?? 0,
    syncSources,
    lastSync,
    issues,
    checkedAt: new Date().toISOString(),
  })
}
