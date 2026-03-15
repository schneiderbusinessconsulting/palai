import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: List all sequences
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sequences')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sequences: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 })
  }
}

// POST: Create a new sequence
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sequences')
      .insert({
        name: body.name,
        steps: body.steps || [],
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sequence: data })
  } catch {
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 })
  }
}

// PATCH: Update a sequence
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()
    const { error } = await supabase
      .from('sequences')
      .update({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.steps !== undefined && { steps: body.steps }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      })
      .eq('id', body.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 })
  }
}
