import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET all templates
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('email_templates')
      .select('id, name, subject, body, category, variables, is_favorite, usage_count, created_at, updated_at')
      .order('is_favorite', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(100)

    if (error) {
      // Table may not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ templates: [] })
      }
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST create new template
export async function POST(request: NextRequest) {
  try {
    const { title, content, category } = await request.json()

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'title and content required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        title: title.trim(),
        content: content.trim(),
        category: category?.trim() || 'Allgemein',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

// PATCH update template
export async function PATCH(request: NextRequest) {
  try {
    const { id, title, content, category, is_favorite } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = await createClient()

    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title.trim()
    if (content !== undefined) updates.content = content.trim()
    if (category !== undefined) updates.category = category.trim()
    if (is_favorite !== undefined) updates.is_favorite = is_favorite

    const { data, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (error) {
    console.error('Templates PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE template
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Templates DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
