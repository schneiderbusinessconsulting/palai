import { NextRequest, NextResponse } from 'next/server'
import { categorizeKnowledgeContent } from '@/lib/ai/openai'

export async function POST(request: NextRequest) {
  try {
    const { title, content } = await request.json()

    if (!title && !content) {
      return NextResponse.json(
        { error: 'Title or content required for categorization' },
        { status: 400 }
      )
    }

    const result = await categorizeKnowledgeContent(title || '', content || '')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Categorization error:', error)
    return NextResponse.json(
      { error: 'Categorization failed' },
      { status: 500 }
    )
  }
}
