import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    const supabase = await createClient()

    let query = supabase
      .from('learning_cases')
      .select(`
        id,
        email_id,
        draft_id,
        original_draft,
        corrected_response,
        edit_distance,
        difficulty_score,
        topic_cluster,
        was_escalated,
        knowledge_extracted,
        extracted_chunk_id,
        status,
        created_at,
        incoming_emails (
          subject,
          from_name,
          from_email,
          email_type
        )
      `)
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      // Table may not exist yet (migration 006 not run)
      if (error.code === '42P01') {
        return NextResponse.json({ cases: [], total: 0, pending: 0 })
      }
      throw error
    }

    // Stats
    const { count: pendingCount } = await supabase
      .from('learning_cases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    return NextResponse.json({
      cases: data || [],
      total: data?.length || 0,
      pending: pendingCount || 0,
    })
  } catch (error) {
    console.error('Learning cases API error:', error)
    return NextResponse.json({ cases: [], total: 0, pending: 0 })
  }
}
