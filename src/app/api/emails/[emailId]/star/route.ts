import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { star_type } = await request.json()
    const supabase = await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ star_type: star_type ?? null })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update star' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Star email error:', error)
    return NextResponse.json({ error: 'Failed to update star' }, { status: 500 })
  }
}
