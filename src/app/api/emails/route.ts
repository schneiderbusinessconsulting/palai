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

      // Insert email
      const { error: insertError } = await supabase
        .from('incoming_emails')
        .insert({
          hubspot_email_id: String(email.id),
          hubspot_thread_id: props.hs_email_thread_id || null,
          from_email: props.hs_email_from_email || 'unknown@example.com',
          from_name: [props.hs_email_from_firstname, props.hs_email_from_lastname]
            .filter(Boolean)
            .join(' ') || null,
          subject: props.hs_email_subject || 'Kein Betreff',
          body_text: props.hs_email_text || '',
          body_html: props.hs_email_html || null,
          received_at: receivedAt.toISOString(),
          status: 'pending',
        })

      if (insertError) {
        console.error('Failed to insert email:', insertError)
      } else {
        imported++
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
