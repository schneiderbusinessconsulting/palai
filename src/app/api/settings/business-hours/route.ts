import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Business hours settings.
 * Graceful degradation if business_hours table doesn't exist — uses defaults.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('business_hours')
      .select('*')
      .order('day_of_week', { ascending: true })

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist — return defaults
        return NextResponse.json({
          hours: [
            { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_active: true },
            { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_active: true },
            { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_active: true },
            { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_active: true },
            { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_active: true },
          ],
          tableExists: false,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ hours: data || [] })
  } catch (error) {
    console.error('Business hours GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch business hours' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { hours } = await request.json()

    if (!Array.isArray(hours)) {
      return NextResponse.json({ error: 'Hours array required' }, { status: 400 })
    }

    // Upsert each day
    for (const h of hours) {
      const { error } = await supabase
        .from('business_hours')
        .upsert(
          {
            day_of_week: h.day_of_week,
            start_time: h.start_time,
            end_time: h.end_time,
            is_active: h.is_active,
          },
          { onConflict: 'day_of_week' }
        )

      if (error) {
        if (error.code === '42P01') {
          return NextResponse.json({ error: 'Business hours table not found' }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Business hours PUT error:', error)
    return NextResponse.json({ error: 'Failed to update business hours' }, { status: 500 })
  }
}
