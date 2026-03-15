import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

interface HubSpotEmail {
  id: string
  properties: {
    hs_email_subject?: string
    hs_email_text?: string
    hs_email_from_email?: string
    hs_email_direction?: string
    hs_email_thread_id?: string
    hs_timestamp?: string
  }
}

async function fetchHubSpotEmailPage(after?: string): Promise<{
  results: HubSpotEmail[]
  paging?: { next?: { after: string } }
}> {
  const params = new URLSearchParams({
    limit: '100',
    properties: 'hs_email_subject,hs_email_text,hs_email_from_email,hs_email_direction,hs_email_thread_id,hs_timestamp',
  })
  if (after) params.set('after', after)

  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/emails?${params}`,
    { headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` } }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot API error ${res.status}: ${text}`)
  }
  return res.json()
}

async function extractKnowledgeFromThread(
  subject: string,
  incoming: string,
  reply: string
): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Du bist ein Experte für das Palacios Institut (Hypnose, Coaching, Weiterbildung in der Schweiz). ' +
          'Extrahiere das wichtigste Wissen aus diesem E-Mail-Thread für eine Knowledge Base. ' +
          'Beschreibe: was war die Frage/das Anliegen, wie wurde es beantwortet, was ist dabei zu beachten. ' +
          'Schreibe in der 3. Person und maximal 200 Wörter. Nur relevante fachliche Inhalte.',
      },
      {
        role: 'user',
        content: `Betreff: ${subject}\n\nEingehende E-Mail:\n${incoming}\n\nAntwort des Instituts:\n${reply}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.3,
  })
  return response.choices[0].message.content || ''
}

export async function POST() {
  try {
    const supabase = await createClient()

    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      return NextResponse.json({ success: false, total_emails: 0, threads: 0, extracted: 0, skipped: 0, errors: [], unconfigured: true }, { status: 200 })
    }

    // Fetch all emails from HubSpot (max 1000)
    const allEmails: HubSpotEmail[] = []
    let after: string | undefined
    let pageCount = 0

    while (pageCount < 10) {
      const data = await fetchHubSpotEmailPage(after)
      allEmails.push(...(data.results || []))
      if (!data.paging?.next?.after) break
      after = data.paging.next.after
      pageCount++
    }

    // Group by thread ID
    const threads = allEmails.reduce<Record<string, HubSpotEmail[]>>((acc, email) => {
      const threadId = email.properties.hs_email_thread_id || email.id
      if (!acc[threadId]) acc[threadId] = []
      acc[threadId].push(email)
      return acc
    }, {})

    let extracted = 0
    let skipped = 0
    const errors: string[] = []

    for (const emails of Object.values(threads)) {
      const incoming = emails.filter(
        (e) => e.properties.hs_email_direction === 'INCOMING_EMAIL'
      )
      const replies = emails.filter(
        (e) =>
          e.properties.hs_email_direction === 'EMAIL' ||
          e.properties.hs_email_direction === 'FORWARDED_EMAIL'
      )

      if (incoming.length === 0 || replies.length === 0) {
        skipped++
        continue
      }

      const incomingEmail = incoming[0]
      const replyEmail = replies[0]

      const subject = incomingEmail.properties.hs_email_subject || 'Kein Betreff'
      const incomingText = incomingEmail.properties.hs_email_text?.substring(0, 2000) || ''
      const replyText = replyEmail.properties.hs_email_text?.substring(0, 2000) || ''

      if (!incomingText.trim() || !replyText.trim()) {
        skipped++
        continue
      }

      try {
        const sourceTitle = `Training: ${subject.substring(0, 80)}`

        // Deduplication: skip if this thread was already imported
        const { data: existing } = await supabase
          .from('knowledge_chunks')
          .select('id')
          .eq('source_type', 'email_training')
          .eq('source_title', sourceTitle)
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        const knowledge = await extractKnowledgeFromThread(subject, incomingText, replyText)

        if (!knowledge.trim()) {
          skipped++
          continue
        }

        const embedding = await createEmbedding(knowledge)

        const { error } = await supabase.from('knowledge_chunks').insert({
          content: knowledge,
          embedding,
          source_type: 'email_training',
          source_title: sourceTitle,
          metadata: {
            hubspot_thread_id: emails[0].properties.hs_email_thread_id,
            imported_at: new Date().toISOString(),
          },
        })

        if (error) {
          errors.push(error.message)
        } else {
          extracted++
        }
      } catch (e) {
        errors.push(String(e))
      }
    }

    return NextResponse.json({
      success: true,
      total_emails: allEmails.length,
      threads: Object.keys(threads).length,
      extracted,
      skipped,
      errors: errors.slice(0, 5),
    })
  } catch (error) {
    console.error('HubSpot bulk training error:', error)
    return NextResponse.json(
      { error: `Bulk training fehlgeschlagen: ${String(error)}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const [trainingRes, instructionsRes] = await Promise.all([
      supabase
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', 'email_training'),
      supabase
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('source_type', 'ai_instructions'),
    ])

    return NextResponse.json({
      email_training_count: trainingRes.count || 0,
      ai_instructions_count: instructionsRes.count || 0,
    })
  } catch (error) {
    console.error('Training stats error:', error)
    return NextResponse.json({ email_training_count: 0, ai_instructions_count: 0 })
  }
}
