import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    return NextResponse.json({ agents: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, role, specializations, maxOpenTickets } = await request.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 })
    }

    const supabase = await createClient()
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
    const { id, ...updates } = await request.json()
    const supabase = await createClient()
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
