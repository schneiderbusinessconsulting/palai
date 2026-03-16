import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params
    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() || await createClient()

    const { data: emails, error } = await supabase
      .from('incoming_emails')
      .select(`
        id,
        hubspot_email_id,
        from_email,
        from_name,
        subject,
        body_text,
        body_html,
        received_at,
        status,
        email_type,
        needs_response,
        hubspot_thread_id,
        email_drafts (
          id,
          ai_generated_response,
          edited_response,
          status,
          sent_at
        )
      `)
      .eq('hubspot_thread_id', threadId)
      .order('received_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 })
    }

    return NextResponse.json({ emails: emails || [] })
  } catch (error) {
    console.error('Thread fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 })
  }
}
