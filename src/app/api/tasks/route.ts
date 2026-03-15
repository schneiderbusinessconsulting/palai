import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assignedAgentId = searchParams.get('assigned_agent_id')

    let query = supabase.from('tasks')
      .select('id, title, description, status, priority, assigned_agent_id, related_email_id, related_customer_email, due_date, completed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (status && status !== 'all') query = query.eq('status', status)
    if (assignedAgentId) query = query.eq('assigned_agent_id', assignedAgentId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tasks: data || [] })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Whitelist allowed fields to prevent mass assignment
    const allowed = {
      title: body.title,
      description: body.description || null,
      status: body.status || 'open',
      priority: body.priority || 'normal',
      assigned_agent_id: body.assigned_agent_id || null,
      related_email_id: body.related_email_id || null,
      related_customer_email: body.related_customer_email || null,
      due_date: body.due_date || null,
    }

    if (!allowed.title || typeof allowed.title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase.from('tasks').insert(allowed).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ task: data })
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
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === 'done') updates.completed_at = new Date().toISOString()
    }
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.assigned_agent_id !== undefined) updates.assigned_agent_id = body.assigned_agent_id
    if (body.due_date !== undefined) updates.due_date = body.due_date

    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ task: data })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
