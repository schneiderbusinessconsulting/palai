import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * CRUD for automation rules.
 * Graceful degradation if automation_rules table doesn't exist.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: rules, error } = await supabase
      .from('automation_rules')
      .select('*')
      .order('priority', { ascending: true })

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ rules: [], tableExists: false })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rules: rules || [] })
  } catch (error) {
    console.error('Automation rules GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        name: body.name,
        description: body.description || null,
        trigger: body.trigger,
        conditions: body.conditions || [],
        actions: body.actions || [],
        is_active: body.is_active ?? true,
        priority: body.priority ?? 0,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Automation rules table not found. Run migration 009 first.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rule: data })
  } catch (error) {
    console.error('Automation rules POST error:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('automation_rules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rule: data })
  } catch (error) {
    console.error('Automation rules PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Automation rules DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
