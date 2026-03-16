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

// POST: Mark email as spam
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = getSupabaseAdmin() || await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ is_spam: true, spam_score: 100 })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update spam status' }, { status: 500 })
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
    const supabase = getSupabaseAdmin() || await createClient()

    const { error } = await supabase
      .from('incoming_emails')
      .update({ is_spam: false, spam_score: 0 })
      .eq('id', emailId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update spam status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to unmark spam' }, { status: 500 })
  }
}
