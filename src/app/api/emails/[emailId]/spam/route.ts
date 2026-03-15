import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Mark email as spam
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ is_spam: true, spam_score: 100 })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to mark as spam' }, { status: 500 })
  }
}

// DELETE: Mark email as not spam
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ is_spam: false, spam_score: 0 })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to unmark spam' }, { status: 500 })
  }
}
