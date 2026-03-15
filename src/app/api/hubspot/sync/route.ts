import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHubSpotClient } from '@/lib/hubspot/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { emailId } = body as { emailId?: string }

    const supabase = await createClient()
    const hubspot = createHubSpotClient()

    // Ensure custom properties exist
    await hubspot.ensureCustomProperties()

    if (emailId) {
      // Sync a specific email's data to HubSpot contact
      const { data: email, error } = await supabase
        .from('incoming_emails')
        .select('*')
        .eq('id', emailId)
        .single()

      if (error || !email) {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        )
      }

      const success = await hubspot.syncContactProperties({
        contactEmail: email.from_email,
        properties: {
          palai_priority: email.priority || undefined,
          palai_support_level: email.support_level || undefined,
          palai_topic: email.topic_cluster || undefined,
          palai_sentiment: email.tone_sentiment || undefined,
          palai_sla_status: email.sla_status || undefined,
          palai_last_email_date: email.received_at || undefined,
          palai_buying_intent: email.buying_intent_score ?? undefined,
        },
      })

      return NextResponse.json({
        success,
        synced: success ? 1 : 0,
        message: success
          ? 'Kontakt-Eigenschaften synchronisiert'
          : 'Kontakt nicht in HubSpot gefunden',
      })
    }

    // Batch sync: all contacts from last 30 days (limit 50)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: emails, error: emailsError } = await supabase
      .from('incoming_emails')
      .select('*')
      .gte('received_at', thirtyDaysAgo.toISOString())
      .order('received_at', { ascending: false })
      .limit(500)

    if (emailsError) {
      return NextResponse.json(
        { error: 'Failed to fetch emails' },
        { status: 500 }
      )
    }

    // Aggregate by contact email
    const contactMap = new Map<string, {
      priority: string | null
      support_level: string | null
      topic_cluster: string | null
      tone_sentiment: string | null
      sla_status: string | null
      last_email_date: string | null
      total_emails: number
      buying_intent_max: number | null
    }>()

    for (const email of emails || []) {
      const key = email.from_email
      const existing = contactMap.get(key)

      if (!existing) {
        contactMap.set(key, {
          priority: email.priority,
          support_level: email.support_level,
          topic_cluster: email.topic_cluster,
          tone_sentiment: email.tone_sentiment,
          sla_status: email.sla_status,
          last_email_date: email.received_at,
          total_emails: 1,
          buying_intent_max: email.buying_intent_score,
        })
      } else {
        existing.total_emails += 1
        // Keep the most recent values (emails are ordered desc)
        if (!existing.priority) existing.priority = email.priority
        if (!existing.support_level) existing.support_level = email.support_level
        if (!existing.topic_cluster) existing.topic_cluster = email.topic_cluster
        if (!existing.tone_sentiment) existing.tone_sentiment = email.tone_sentiment
        if (!existing.sla_status) existing.sla_status = email.sla_status
        // Max buying intent across all emails
        if (email.buying_intent_score != null) {
          existing.buying_intent_max = Math.max(
            existing.buying_intent_max ?? 0,
            email.buying_intent_score
          )
        }
      }
    }

    // Sync top 50 contacts
    const contacts = Array.from(contactMap.entries()).slice(0, 50)
    let synced = 0

    for (const [contactEmail, data] of contacts) {
      try {
        const success = await hubspot.syncContactProperties({
          contactEmail,
          properties: {
            palai_priority: data.priority || undefined,
            palai_support_level: data.support_level || undefined,
            palai_topic: data.topic_cluster || undefined,
            palai_sentiment: data.tone_sentiment || undefined,
            palai_sla_status: data.sla_status || undefined,
            palai_last_email_date: data.last_email_date || undefined,
            palai_total_emails: data.total_emails,
            palai_buying_intent: data.buying_intent_max ?? undefined,
          },
        })
        if (success) synced++
      } catch (e) {
        console.error(`Failed to sync ${contactEmail}:`, e)
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      total: contacts.length,
      message: `${synced} von ${contacts.length} Kontakten synchronisiert`,
    })
  } catch (error) {
    console.error('HubSpot sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync HubSpot properties' },
      { status: 500 }
    )
  }
}
