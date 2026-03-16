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

/**
 * Snooze/unsnooze an email.
 * Uses snoozed_until column on incoming_emails (if it exists).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { until } = await request.json()

    if (!until) {
      return NextResponse.json({ error: 'Snooze date required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() || await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ snoozed_until: until })
      .eq('id', emailId)

    if (error) {
      // Column may not exist
      if (error.message?.includes('snoozed_until')) {
        return NextResponse.json({ error: 'Snooze column not available. Run migration first.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to process snooze request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, snoozed_until: until })
  } catch (error) {
    console.error('Snooze error:', error)
    return NextResponse.json({ error: 'Failed to snooze email' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = getSupabaseAdmin() || await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ snoozed_until: null })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: 'Failed to process snooze request' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsnooze error:', error)
    return NextResponse.json({ error: 'Failed to unsnooze email' }, { status: 500 })
  }
}
