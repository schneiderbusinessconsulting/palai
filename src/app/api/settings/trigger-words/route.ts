import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bi_trigger_words')
      .select('id, word, category, weight, is_active')
      .order('category')
      .order('word')

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ words: [] })
      throw error
    }

    return NextResponse.json({ words: data || [] })
  } catch (error) {
    console.error('Trigger words GET error:', error)
    return NextResponse.json({ words: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { word, category, weight } = await request.json()

    if (!word || !category) {
      return NextResponse.json({ error: 'word and category required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bi_trigger_words')
      .insert({ word: word.trim().toLowerCase(), category, weight: weight || 1.0, is_active: true })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ word: data })
  } catch (error) {
    console.error('Trigger words POST error:', error)
    return NextResponse.json({ error: 'Failed to create trigger word' }, { status: 500 })
  }
}
