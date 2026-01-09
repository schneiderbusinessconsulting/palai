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

// Manual sync from HubSpot
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Only fetch emails from the last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

    // Fetch recent emails from HubSpot
    const hubspotResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/emails?limit=100&properties=hs_email_subject,hs_email_text,hs_email_html,hs_email_from_email,hs_email_from_firstname,hs_email_from_lastname,hs_timestamp,hs_createdate,hs_email_thread_id,hs_email_direction&filterGroups=[{"filters":[{"propertyName":"hs_email_direction","operator":"EQ","value":"INCOMING_EMAIL"}]}]`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!hubspotResponse.ok) {
      const error = await hubspotResponse.text()
      console.error('HubSpot API error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch from HubSpot' },
        { status: 500 }
      )
    }

    const hubspotData = await hubspotResponse.json()
    const emails = hubspotData.results || []

    let imported = 0
    let skipped = 0

    for (const email of emails) {
      const props = email.properties

      // Parse timestamp - try multiple formats
      let receivedAt: Date
      const timestamp = props.hs_timestamp || props.hs_createdate || email.createdAt

      if (timestamp) {
        // If it's a number string (milliseconds)
        if (/^\d+$/.test(String(timestamp))) {
          receivedAt = new Date(parseInt(String(timestamp)))
        } else {
          // If it's already an ISO string
          receivedAt = new Date(timestamp)
        }
      } else {
        receivedAt = new Date()
      }

      // Skip if invalid date or older than 7 days
      if (isNaN(receivedAt.getTime()) || receivedAt.getTime() < sevenDaysAgo) {
        skipped++
        continue
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from('incoming_emails')
        .select('id')
        .eq('hubspot_email_id', email.id)
        .single()

      if (existing) {
        skipped++
        continue
      }

      // Insert new email
      const { error: insertError } = await supabase
        .from('incoming_emails')
        .insert({
          hubspot_email_id: email.id,
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
