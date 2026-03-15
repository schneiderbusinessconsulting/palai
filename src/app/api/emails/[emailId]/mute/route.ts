import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    // Get current mute state
    const { data: email } = await supabase
      .from('incoming_emails')
      .select('is_muted')
      .eq('id', emailId)
      .single()

    const newMuted = !(email?.is_muted)

    const { error } = await supabase
      .from('incoming_emails')
      .update({ is_muted: newMuted })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_muted: newMuted })
  } catch {
    return NextResponse.json({ error: 'Failed to toggle mute' }, { status: 500 })
  }
}
