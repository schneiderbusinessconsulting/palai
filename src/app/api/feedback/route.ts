import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * GET /api/feedback — List feedback threads with items
 * Query params: department (sales|product|marketing), status (open|resolved|archived)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department')
    const status = searchParams.get('status') || 'open'

    let query = supabase
      .from('feedback_threads')
      .select(`
        *,
        feedback_items (
          id, content, original_quote, department, category,
          mentioned_person, sentiment, severity, created_at,
          email_id
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (department) query = query.eq('department', department)
    if (status !== 'all') query = query.eq('status', status)

    const { data: threads, error } = await query
    if (error) {
      console.error('Feedback fetch error:', error)
      return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 })
    }

    return NextResponse.json({ threads: threads || [] })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/feedback — Extract feedback from an email using AI
 * Body: { emailId, subject, bodyText, fromName }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { emailId, subject, bodyText, fromName } = await request.json()

    if (!emailId || !bodyText) {
      return NextResponse.json({ error: 'emailId and bodyText required' }, { status: 400 })
    }

    // Check if feedback already extracted for this email
    const { data: existing } = await supabase
      .from('feedback_items')
      .select('id')
      .eq('email_id', emailId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Feedback already extracted', skipped: true })
    }

    // AI extraction
    const extraction = await extractFeedbackWithAI(subject, bodyText, fromName)

    if (!extraction.items || extraction.items.length === 0) {
      return NextResponse.json({ message: 'No feedback found in email', items: [] })
    }

    // Group items by department and find/create threads
    const itemsByDept = new Map<string, typeof extraction.items>()
    for (const item of extraction.items) {
      const dept = item.department
      if (!itemsByDept.has(dept)) itemsByDept.set(dept, [])
      itemsByDept.get(dept)!.push(item)
    }

    const createdItems = []

    for (const [dept, items] of itemsByDept) {
      // Try to find existing thread for this product/topic + department
      const product = extraction.product || subject
      let threadId: string

      const { data: existingThread } = await supabase
        .from('feedback_threads')
        .select('id, item_count')
        .eq('department', dept)
        .eq('status', 'open')
        .ilike('title', `%${product.substring(0, 30)}%`)
        .limit(1)
        .single()

      if (existingThread) {
        threadId = existingThread.id
      } else {
        // Create new thread
        const { data: newThread, error: threadError } = await supabase
          .from('feedback_threads')
          .insert({
            title: product,
            department: dept,
            product: extraction.product || null,
            problem_statement: extraction.problemStatement || null,
            ai_recommendation: extraction.aiRecommendation || null,
          })
          .select('id')
          .single()

        if (threadError || !newThread) {
          console.error('Failed to create thread:', threadError)
          continue
        }
        threadId = newThread.id
      }

      // Insert items
      for (const item of items) {
        const { data: inserted, error: itemError } = await supabase
          .from('feedback_items')
          .insert({
            thread_id: threadId,
            email_id: emailId,
            content: item.content,
            original_quote: item.originalQuote || null,
            department: dept,
            category: item.category || null,
            mentioned_person: item.mentionedPerson || null,
            sentiment: item.sentiment || 'neutral',
            severity: item.severity || 'medium',
          })
          .select()
          .single()

        if (!itemError && inserted) createdItems.push(inserted)
      }

      // Update thread item count and summary
      const { count } = await supabase
        .from('feedback_items')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId)

      await supabase
        .from('feedback_threads')
        .update({
          item_count: count || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId)
    }

    // Update thread AI summaries in background
    updateThreadSummaries(supabase, [...itemsByDept.keys()]).catch(console.error)

    return NextResponse.json({
      message: `${createdItems.length} feedback items extracted`,
      items: createdItems,
    })
  } catch (error) {
    console.error('Feedback extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract feedback' }, { status: 500 })
  }
}

interface FeedbackItem {
  content: string
  originalQuote?: string
  department: 'sales' | 'product' | 'marketing'
  category?: string
  mentionedPerson?: string
  sentiment: 'positive' | 'neutral' | 'negative'
  severity: 'low' | 'medium' | 'high'
}

interface FeedbackExtraction {
  items: FeedbackItem[]
  product?: string
  problemStatement?: string
  aiRecommendation?: string
}

async function extractFeedbackWithAI(
  subject: string,
  bodyText: string,
  fromName?: string
): Promise<FeedbackExtraction> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du bist ein Feedback-Analyst für ein Schweizer Ausbildungsunternehmen (Hypnose, Coaching, Meditation).

Analysiere die Kunden-E-Mail und extrahiere JEDEN einzelnen Feedback-Punkt. Ordne jeden Punkt einer Abteilung zu:
- "sales": Feedback zu Beratungsgesprächen, Closer/Berater, Verkaufsprozess, Kommunikation vor dem Kauf
- "product": Feedback zu Kursinhalten, Didaktik, Methodik, Seminarablauf, Trainer, Ergebnis der Ausbildung
- "marketing": Feedback zu Website, Online-Buchung, Organisation, Außendarstellung, Preiskommunikation

Erstelle auch:
1. Ein "problemStatement": Zusammenfassung des Kernproblems in 1-2 Sätzen
2. Eine "aiRecommendation": Konkreter Verbesserungsvorschlag in 2-3 Sätzen
3. Den Produktnamen falls erkennbar

Antworte als JSON:
{
  "product": "Name des Produkts/Kurses falls erkennbar",
  "problemStatement": "Das Kernproblem zusammengefasst",
  "aiRecommendation": "Konkreter Verbesserungsvorschlag",
  "items": [
    {
      "content": "Kurze Zusammenfassung des Feedback-Punkts",
      "originalQuote": "Originalzitat aus der E-Mail",
      "department": "sales|product|marketing",
      "category": "z.B. beratung, didaktik, kommunikation, organisation, praxis",
      "mentionedPerson": "Name falls erwähnt oder null",
      "sentiment": "positive|neutral|negative",
      "severity": "low|medium|high"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `E-Mail von: ${fromName || 'Unbekannt'}\nBetreff: ${subject}\n\n${bodyText}`
        }
      ]
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { items: [] }

    return JSON.parse(content) as FeedbackExtraction
  } catch (error) {
    console.error('AI feedback extraction failed:', error)
    return { items: [] }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateThreadSummaries(supabase: any, departments: string[]) {
  for (const dept of departments) {
    const { data: threads } = await supabase
      .from('feedback_threads')
      .select(`
        id, title,
        feedback_items ( content, sentiment, category, mentioned_person )
      `)
      .eq('department', dept)
      .eq('status', 'open')

    if (!threads) continue

    for (const thread of threads) {
      if (!thread.feedback_items || thread.feedback_items.length < 2) continue

      try {
        const itemSummary = thread.feedback_items
          .map((i: { content: string; sentiment: string }) => `- [${i.sentiment}] ${i.content}`)
          .join('\n')

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Erstelle eine Zusammenfassung der Feedback-Punkte zu "${thread.title}".
Antworte als JSON: { "summary": "2-3 Sätze", "problemStatement": "Kernproblem", "aiRecommendation": "Verbesserungsvorschlag" }`
            },
            { role: 'user', content: itemSummary }
          ]
        })

        const result = JSON.parse(response.choices[0]?.message?.content || '{}')
        await supabase
          .from('feedback_threads')
          .update({
            ai_summary: result.summary || null,
            problem_statement: result.problemStatement || null,
            ai_recommendation: result.aiRecommendation || null,
          })
          .eq('id', thread.id)
      } catch {
        // Non-critical, skip
      }
    }
  }
}
