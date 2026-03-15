import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { agent_id } = await request.json()
    const supabase = await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ assigned_agent_id: agent_id || null })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: 'Failed to assign email' }, { status: 500 })
    }

    // Write audit log (fire-and-forget)
    try {
      await supabase.from('audit_log').insert({
        action: 'assign_email',
        resource_type: 'email',
        resource_id: emailId,
        details: { agent_id: agent_id || null },
      })
    } catch { /* ignore */ }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Assign email error:', error)
    return NextResponse.json({ error: 'Failed to assign email' }, { status: 500 })
  }
}
