import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sla_targets')
      .select('*')
      .eq('is_active', true)
      .order('priority')

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ targets: [] })
      throw error
    }

    return NextResponse.json({ targets: data || [] })
  } catch (error) {
    console.error('SLA GET error:', error)
    return NextResponse.json({ targets: [] })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, first_response_minutes, resolution_minutes } = await request.json()

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sla_targets')
      .update({ first_response_minutes, resolution_minutes })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ target: data })
  } catch (error) {
    console.error('SLA PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update SLA' }, { status: 500 })
  }
}
