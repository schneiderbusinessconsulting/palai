import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Saved views - stored in saved_views table if exists,
// otherwise gracefully return empty
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('saved_views')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ views: [] })
      return NextResponse.json({ error: 'Failed to process views request' }, { status: 500 })
    }

    return NextResponse.json({ views: data || [] })
  } catch {
    return NextResponse.json({ views: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, filters } = await request.json()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('saved_views')
      .insert({ name, filters })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Views table not available. Run migration 009.' }, { status: 501 })
      }
      return NextResponse.json({ error: 'Failed to process views request' }, { status: 500 })
    }

    return NextResponse.json({ view: data })
  } catch (error) {
    console.error('Create view error:', error)
    return NextResponse.json({ error: 'Failed to create view' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { view_id } = await request.json()
    const supabase = await createClient()

    const { error } = await supabase
      .from('saved_views')
      .delete()
      .eq('id', view_id)

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ success: true })
      return NextResponse.json({ error: 'Failed to process views request' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete view' }, { status: 500 })
  }
}
