import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Dashboard Health – Prüft ob Dashboards echte Daten haben

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface TableCheck {
  name: string
  count: number
  healthy: boolean
  details?: Record<string, number>
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const tables: TableCheck[] = []
  const issues: string[] = []
  const recommendations: string[] = []

  // --- incoming_emails ---
  const { count: totalEmails } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })

  const { count: withBuyingIntent } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .gt('buying_intent_score', 0)

  const { count: withSentiment } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .not('tone_sentiment', 'is', null)

  const { count: withTopicTags } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .not('topic_tags', 'eq', '{}')
    .not('topic_tags', 'is', null)

  // Unklassifizierte E-Mails zählen
  const { count: unclassifiedType } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .is('email_type', null)

  const { count: unclassifiedSentiment } = await supabase
    .from('incoming_emails')
    .select('*', { count: 'exact', head: true })
    .is('tone_sentiment', null)

  const unclassifiedCount = Math.max(unclassifiedType ?? 0, unclassifiedSentiment ?? 0)

  tables.push({
    name: 'incoming_emails',
    count: totalEmails ?? 0,
    healthy: (totalEmails ?? 0) > 0,
    details: {
      withBuyingIntent: withBuyingIntent ?? 0,
      withSentiment: withSentiment ?? 0,
      withTopicTags: withTopicTags ?? 0,
      unclassified: unclassifiedCount,
    },
  })

  if ((totalEmails ?? 0) === 0) {
    issues.push('Keine E-Mails in der Datenbank')
    recommendations.push('Importieren Sie E-Mails über die Inbox oder HubSpot-Sync')
  }

  if (unclassifiedCount > 0) {
    issues.push(`${unclassifiedCount} E-Mail(s) ohne Klassifizierung`)
  }

  // --- Weitere Tabellen prüfen ---
  const simpleTables = [
    'csat_ratings',
    'bi_insights',
    'learning_cases',
    'knowledge_chunks',
    'email_drafts',
  ]

  for (const tableName of simpleTables) {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (error) {
      tables.push({ name: tableName, count: 0, healthy: false })
      issues.push(`Tabelle ${tableName}: ${error.message}`)
    } else {
      tables.push({
        name: tableName,
        count: count ?? 0,
        healthy: (count ?? 0) > 0,
      })
    }
  }

  // support_agents (nur aktive)
  const { count: activeAgents, error: agentsErr } = await supabase
    .from('support_agents')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  if (agentsErr) {
    tables.push({ name: 'support_agents (active)', count: 0, healthy: false })
    issues.push(`support_agents: ${agentsErr.message}`)
  } else {
    tables.push({
      name: 'support_agents (active)',
      count: activeAgents ?? 0,
      healthy: (activeAgents ?? 0) > 0,
    })
    if ((activeAgents ?? 0) === 0) {
      recommendations.push('Keine aktiven Agenten vorhanden – bitte Agenten anlegen')
    }
  }

  // Auto-Klassifizierung auslösen wenn > 10 unklassifizierte E-Mails
  let autoClassifyTriggered = false
  if (unclassifiedCount > 10) {
    try {
      const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
      await fetch(`${baseUrl}/api/emails`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        cache: 'no-store',
      })
      autoClassifyTriggered = true
      recommendations.push(
        `Auto-Klassifizierung für ${unclassifiedCount} E-Mails ausgelöst`
      )
    } catch (err) {
      issues.push(
        `Auto-Klassifizierung fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannt'}`
      )
    }
  }

  return NextResponse.json({
    tables,
    issues,
    recommendations,
    autoClassifyTriggered,
    checkedAt: new Date().toISOString(),
  })
}
