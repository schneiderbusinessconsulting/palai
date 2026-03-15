import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { emailId, rating, comment } = await request.json()

    if (!emailId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.from('csat_ratings').insert({
      email_id: emailId,
      rating,
      comment: comment || null,
    })

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet — silently ignore
        return NextResponse.json({ success: true })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CSAT API error:', error)
    return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const startDate = searchParams.get('start') || new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('csat_ratings')
      .select('rating, created_at')
      .gte('created_at', `${startDate}T00:00:00`)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ ratings: [], avg: 0, total: 0 })
      throw error
    }

    const ratings = data || []
    const avg = ratings.length > 0
      ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
      : 0

    const distribution = [1, 2, 3, 4, 5].map(n => ({
      stars: n,
      count: ratings.filter(r => r.rating === n).length,
    }))

    return NextResponse.json({ ratings, avg, total: ratings.length, distribution })
  } catch (error) {
    console.error('CSAT GET error:', error)
    return NextResponse.json({ ratings: [], avg: 0, total: 0 })
  }
}
