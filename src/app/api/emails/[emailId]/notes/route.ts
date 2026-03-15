import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Notes are stored in the email_notes table if it exists,
// otherwise return empty (table created via optional migration)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('email_notes')
      .select('*')
      .eq('email_id', emailId)
      .order('created_at', { ascending: true })

    if (error) {
      // Table might not exist yet — return empty
      if (error.code === '42P01') {
        return NextResponse.json({ notes: [] })
      }
      return NextResponse.json({ error: 'Failed to process notes request' }, { status: 500 })
    }

    return NextResponse.json({ notes: data || [] })
  } catch {
    return NextResponse.json({ notes: [] })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { content, agent_name } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('email_notes')
      .insert({
        email_id: emailId,
        agent_name: agent_name || 'Unbekannt',
        content: content.trim(),
      })
      .select()
      .single()

    if (error) {
      // Table might not exist — return graceful error
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Notes table not available. Run migration 009.' }, { status: 501 })
      }
      return NextResponse.json({ error: 'Failed to process notes request' }, { status: 500 })
    }

    return NextResponse.json({ note: data })
  } catch (error) {
    console.error('Create note error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { note_id } = await request.json()
    const supabase = await createClient()

    const { error } = await supabase
      .from('email_notes')
      .delete()
      .eq('id', note_id)

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ success: true })
      return NextResponse.json({ error: 'Failed to process notes request' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
