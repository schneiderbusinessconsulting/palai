import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Admin client for agents (bypasses RLS) — used for writes
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('support_agents')
      .select('id, name, email, role, specializations, is_active, max_open_tickets')
      .eq('is_active', true)
      .order('role')
      .order('name')

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ agents: [] })
      throw error
    }

    return NextResponse.json({ agents: data || [] })
  } catch (error) {
    console.error('Agents GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, role, specializations, maxOpenTickets } = await request.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('support_agents')
      .insert({
        name,
        email,
        role: role || 'L1',
        specializations: specializations || [],
        max_open_tickets: maxOpenTickets || 20,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ agent: data })
  } catch (error) {
    console.error('Agents POST error:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, email, role, specializations, max_open_tickets, is_active } = await request.json()
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (role !== undefined) updates.role = role
    if (specializations !== undefined) updates.specializations = specializations
    if (max_open_tickets !== undefined) updates.max_open_tickets = max_open_tickets
    if (is_active !== undefined) updates.is_active = is_active
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('support_agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ agent: data })
  } catch (error) {
    console.error('Agents PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}
