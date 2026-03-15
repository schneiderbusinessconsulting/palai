import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: List all playbooks
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: 'Failed to fetch playbooks' }, { status: 500 })
    return NextResponse.json({ playbooks: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch playbooks' }, { status: 500 })
  }
}

// POST: Create a new playbook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('playbooks')
      .insert({
        name: body.name,
        trigger_conditions: body.trigger_conditions || [],
        steps: body.steps || [],
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 })
    return NextResponse.json({ playbook: data })
  } catch {
    return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 })
  }
}

// PATCH: Update a playbook
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()
    const { error } = await supabase
      .from('playbooks')
      .update({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.trigger_conditions !== undefined && { trigger_conditions: body.trigger_conditions }),
        ...(body.steps !== undefined && { steps: body.steps }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      })
      .eq('id', body.id)

    if (error) return NextResponse.json({ error: 'Failed to update playbook' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update playbook' }, { status: 500 })
  }
}
