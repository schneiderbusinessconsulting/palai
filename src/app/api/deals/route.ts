import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')

    let query = supabase.from('deals')
      .select('id, title, stage, value, probability, customer_email, assigned_agent_id, notes, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (stage && stage !== 'all') query = query.eq('stage', stage)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Failed to process deals request' }, { status: 500 })
    return NextResponse.json({ deals: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Whitelist allowed fields
    const allowed = {
      title: body.title.trim(),
      stage: VALID_STAGES.includes(body.stage) ? body.stage : 'lead',
      value: typeof body.value === 'number' ? body.value : 0,
      probability: typeof body.probability === 'number' ? Math.min(100, Math.max(0, body.probability)) : 0,
      customer_email: body.customer_email || null,
      assigned_agent_id: body.assigned_agent_id || null,
      notes: body.notes || null,
    }

    const { data, error } = await supabase.from('deals').insert(allowed).select().single()
    if (error) return NextResponse.json({ error: 'Failed to process deals request' }, { status: 500 })
    return NextResponse.json({ deal: data })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Whitelist allowed update fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) updates.title = String(body.title).trim()
    if (body.stage !== undefined && VALID_STAGES.includes(body.stage)) updates.stage = body.stage
    if (body.value !== undefined) updates.value = typeof body.value === 'number' ? body.value : 0
    if (body.probability !== undefined) updates.probability = typeof body.probability === 'number' ? Math.min(100, Math.max(0, body.probability)) : 0
    if (body.customer_email !== undefined) updates.customer_email = body.customer_email
    if (body.assigned_agent_id !== undefined) updates.assigned_agent_id = body.assigned_agent_id
    if (body.notes !== undefined) updates.notes = body.notes

    const { data, error } = await supabase.from('deals').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: 'Failed to process deals request' }, { status: 500 })
    return NextResponse.json({ deal: data })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
