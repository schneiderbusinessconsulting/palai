import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'

export interface Course {
  id: string
  name: string
  description: string | null
  content: string | null
  target_audience: string | null
  learning_goals: string[]
  next_start: string | null
  duration: string | null
  price: number | null
  installment_count: number | null
  installment_amount: number | null
  spots_available: number | null
  total_spots: number | null
  status: string
  created_at: string
  updated_at: string
}

// GET all courses
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching courses:', error)
      return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
    }

    return NextResponse.json({ courses: data || [] })
  } catch (error) {
    console.error('Courses GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

// POST create new course
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Nicht authentifiziert', details: authError?.message }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      content,
      target_audience,
      learning_goals,
      next_start,
      duration,
      price,
      installment_count,
      installment_amount,
      spots_available,
      total_spots,
      status,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('courses')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        content: content?.trim() || null,
        target_audience: target_audience?.trim() || null,
        learning_goals: learning_goals || [],
        next_start: next_start || null,
        duration: duration?.trim() || null,
        price: price || null,
        installment_count: installment_count || null,
        installment_amount: installment_amount || null,
        spots_available: spots_available ?? null,
        total_spots: total_spots ?? null,
        status: status || 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating course:', error)
      return NextResponse.json({ error: 'Failed to create course', details: error.message, code: error.code }, { status: 500 })
    }

    // Sync to knowledge base (don't fail if this fails)
    try {
      await syncCourseToKnowledge(supabase, data)
    } catch (syncError) {
      console.error('Knowledge sync failed (non-fatal):', syncError)
    }

    return NextResponse.json({ course: data })
  } catch (error) {
    console.error('Courses POST error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create course', details: errorMessage }, { status: 500 })
  }
}

// PATCH update course
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Course ID ist erforderlich' }, { status: 400 })
    }

    const supabase = await createClient()

    // Clean up updates
    const cleanUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) cleanUpdates.name = updates.name?.trim()
    if (updates.description !== undefined) cleanUpdates.description = updates.description?.trim() || null
    if (updates.content !== undefined) cleanUpdates.content = updates.content?.trim() || null
    if (updates.target_audience !== undefined) cleanUpdates.target_audience = updates.target_audience?.trim() || null
    if (updates.learning_goals !== undefined) cleanUpdates.learning_goals = updates.learning_goals
    if (updates.next_start !== undefined) cleanUpdates.next_start = updates.next_start || null
    if (updates.duration !== undefined) cleanUpdates.duration = updates.duration?.trim() || null
    if (updates.price !== undefined) cleanUpdates.price = updates.price || null
    if (updates.installment_count !== undefined) cleanUpdates.installment_count = updates.installment_count || null
    if (updates.installment_amount !== undefined) cleanUpdates.installment_amount = updates.installment_amount || null
    if (updates.spots_available !== undefined) cleanUpdates.spots_available = updates.spots_available ?? null
    if (updates.total_spots !== undefined) cleanUpdates.total_spots = updates.total_spots ?? null
    if (updates.status !== undefined) cleanUpdates.status = updates.status

    const { data, error } = await supabase
      .from('courses')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating course:', error)
      return NextResponse.json({ error: 'Failed to update course', details: error.message }, { status: 500 })
    }

    // Sync to knowledge base (don't fail if this fails)
    try {
      await syncCourseToKnowledge(supabase, data)
    } catch (syncError) {
      console.error('Knowledge sync failed (non-fatal):', syncError)
    }

    return NextResponse.json({ course: data })
  } catch (error) {
    console.error('Courses PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
  }
}

// DELETE course
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Course ID ist erforderlich' }, { status: 400 })
    }

    const supabase = await createClient()

    // First delete associated knowledge chunks
    await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('source_type', 'course_info')
      .eq('source_id', id)

    // Then delete the course
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting course:', error)
      return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Courses DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
  }
}

// Helper: Sync course to knowledge base
async function syncCourseToKnowledge(supabase: Awaited<ReturnType<typeof createClient>>, course: Course) {
  try {
    // Build comprehensive course text for AI
    let courseText = `KURS: ${course.name}\n\n`

    if (course.description) {
      courseText += `KURZBESCHREIBUNG:\n${course.description}\n\n`
    }

    if (course.content) {
      courseText += `INHALT:\n${course.content}\n\n`
    }

    if (course.target_audience) {
      courseText += `ZIELGRUPPE:\n${course.target_audience}\n\n`
    }

    if (course.learning_goals && course.learning_goals.length > 0) {
      courseText += `LERNZIELE:\n${course.learning_goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\n`
    }

    if (course.price) {
      courseText += `PREIS: CHF ${course.price.toLocaleString('de-CH')}\n`
      if (course.installment_count && course.installment_amount) {
        courseText += `RATENZAHLUNG: ${course.installment_count}x CHF ${course.installment_amount.toLocaleString('de-CH')}\n`
      }
    }

    if (course.duration) {
      courseText += `DAUER: ${course.duration}\n`
    }

    if (course.next_start) {
      const startDate = new Date(course.next_start)
      courseText += `NÄCHSTER START: ${startDate.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })}\n`
    }

    if (course.spots_available !== null && course.total_spots) {
      courseText += `VERFÜGBARE PLÄTZE: ${course.spots_available} von ${course.total_spots}\n`
    }

    // Delete existing knowledge chunk for this course
    await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('source_type', 'course_info')
      .eq('source_id', course.id)

    // Create embedding
    const embedding = await createEmbedding(courseText)

    // Insert new knowledge chunk
    await supabase
      .from('knowledge_chunks')
      .insert({
        content: courseText,
        embedding,
        source_type: 'course_info',
        source_id: course.id,
        source_title: course.name,
        metadata: {
          course_id: course.id,
          price: course.price,
          duration: course.duration,
        },
      })

    console.log('Course synced to knowledge base:', course.name)
  } catch (error) {
    console.error('Error syncing course to knowledge:', error)
    // Don't fail the main operation
  }
}
