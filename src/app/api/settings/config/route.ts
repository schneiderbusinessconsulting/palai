import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — fetch all config values (or a specific key)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    const supabase = await createClient()

    if (key) {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value, description')
        .eq('key', key)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Config key not found' }, { status: 404 })
      }
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('app_config')
      .select('key, value, description, updated_at')
      .order('key')

    if (error) {
      // If table doesn't exist yet (migration not applied), return empty config
      if (error.code === '42P01') {
        return NextResponse.json({ config: {}, rows: [] })
      }
      console.error('Config GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }

    // Return as object map for easy use
    const configMap: Record<string, string> = {}
    for (const row of data || []) {
      configMap[row.key] = row.value
    }

    return NextResponse.json({ config: configMap, rows: data || [] })
  } catch (error) {
    console.error('Config GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

// PATCH — update one or more config values
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    // Accept either { key, value } or { updates: { key: value, ... } }
    const updates: Record<string, string> = body.updates || (body.key ? { [body.key]: body.value } : body)

    const upserts = Object.entries(updates).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }))

    if (upserts.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { error } = await supabase
      .from('app_config')
      .upsert(upserts, { onConflict: 'key' })

    if (error) {
      // If table doesn't exist yet (migration not applied), return gracefully
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, note: 'app_config table not yet created' })
      }
      console.error('Config PATCH error:', error)
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: upserts.length })
  } catch (error) {
    console.error('Config PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
