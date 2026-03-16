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

// PATCH — set tags (replace all)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { tags } = await request.json()

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() || await createClient()
    const { error } = await supabase
      .from('incoming_emails')
      .update({ tags })
      .eq('id', emailId)

    if (error) {
      // If tags column doesn't exist yet (migration 009 not applied)
      if (error.code === '42703') {
        return NextResponse.json({ error: 'Tags column not available' }, { status: 501 })
      }
      throw error
    }

    return NextResponse.json({ success: true, tags })
  } catch (error) {
    console.error('Tags PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}

// POST — add a single tag
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { tag } = await request.json()

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json({ error: 'tag must be a non-empty string' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() || await createClient()

    // Get current tags
    const { data: email } = await supabase
      .from('incoming_emails')
      .select('tags')
      .eq('id', emailId)
      .single()

    const currentTags: string[] = email?.tags || []
    if (currentTags.includes(tag)) {
      return NextResponse.json({ success: true, tags: currentTags })
    }

    const newTags = [...currentTags, tag]
    const { error } = await supabase
      .from('incoming_emails')
      .update({ tags: newTags })
      .eq('id', emailId)

    if (error) {
      if (error.code === '42703') {
        return NextResponse.json({ error: 'Tags column not available' }, { status: 501 })
      }
      throw error
    }

    return NextResponse.json({ success: true, tags: newTags })
  } catch (error) {
    console.error('Tags POST error:', error)
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 })
  }
}

// DELETE — remove a single tag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { tag } = await request.json()

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json({ error: 'tag must be a non-empty string' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() || await createClient()

    const { data: email } = await supabase
      .from('incoming_emails')
      .select('tags')
      .eq('id', emailId)
      .single()

    const currentTags: string[] = email?.tags || []
    const newTags = currentTags.filter(t => t !== tag)

    const { error } = await supabase
      .from('incoming_emails')
      .update({ tags: newTags })
      .eq('id', emailId)

    if (error) {
      if (error.code === '42703') {
        return NextResponse.json({ error: 'Tags column not available' }, { status: 501 })
      }
      throw error
    }

    return NextResponse.json({ success: true, tags: newTags })
  } catch (error) {
    console.error('Tags DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 })
  }
}
