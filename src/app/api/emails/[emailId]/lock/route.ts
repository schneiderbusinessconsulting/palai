import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const LOCK_TTL_MINUTES = 10

async function purgeStaleLocks(supabase: Awaited<ReturnType<typeof createClient>>) {
  const cutoff = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000).toISOString()
  await supabase.from('email_locks').delete().lt('locked_at', cutoff)
}

// GET — check current lock status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const supabase = getSupabaseAdmin() || await createClient()

    await purgeStaleLocks(supabase)

    const { data } = await supabase
      .from('email_locks')
      .select('locked_by, locked_at')
      .eq('email_id', emailId)
      .maybeSingle()

    return NextResponse.json({ lock: data || null })
  } catch (error) {
    console.error('Lock GET error:', error)
    return NextResponse.json({ lock: null })
  }
}

// POST — acquire lock; 409 if already held by someone else
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { agent_name } = await request.json()

    if (!agent_name) {
      return NextResponse.json({ error: 'agent_name required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin() || await createClient()
    await purgeStaleLocks(supabase)

    // Check for existing lock held by someone else
    const { data: existing } = await supabase
      .from('email_locks')
      .select('locked_by, locked_at')
      .eq('email_id', emailId)
      .maybeSingle()

    if (existing && existing.locked_by !== agent_name) {
      return NextResponse.json(
        { error: 'locked', locked_by: existing.locked_by, locked_at: existing.locked_at },
        { status: 409 }
      )
    }

    // Upsert (acquire or refresh own lock)
    const { error } = await supabase.from('email_locks').upsert(
      { email_id: emailId, locked_by: agent_name, locked_at: new Date().toISOString() },
      { onConflict: 'email_id' }
    )

    if (error) {
      // If email_locks table doesn't exist yet — allow silently
      if (error.code === '42P01') return NextResponse.json({ success: true })
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lock POST error:', error)
    // Don't block the user on lock errors — fail silently
    return NextResponse.json({ success: true })
  }
}

// DELETE — release lock
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    const { agent_name } = await request.json()

    const supabase = getSupabaseAdmin() || await createClient()

    const query = supabase.from('email_locks').delete().eq('email_id', emailId)
    // Only release own lock (don't let someone else's delete cancel another's lock)
    if (agent_name) query.eq('locked_by', agent_name)

    await query

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lock DELETE error:', error)
    return NextResponse.json({ success: true })
  }
}
