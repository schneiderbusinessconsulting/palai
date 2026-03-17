import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createEmbedding } from '@/lib/ai/openai'
import { processNewEmail } from '@/lib/email-processing'

// Levenshtein-based normalized edit distance (0.0 = identical, 1.0 = completely different)
function calculateEditDistance(original: string, edited: string): number {
  const a = original.trim()
  const b = edited.trim()
  if (a === b) return 0
  if (!a.length || !b.length) return 1

  const maxLen = Math.max(a.length, b.length)
  // Simple character-level comparison for performance (good enough for distance estimation)
  let diffs = 0
  const minLen = Math.min(a.length, b.length)
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) diffs++
  }
  diffs += Math.abs(a.length - b.length)
  return Math.min(diffs / maxLen, 1.0)
}

// Derive a CSAT rating from edit distance:
// No/minimal edits → AI did great → high rating
// Heavy edits → AI was poor → low rating
function deriveCsatFromEditDistance(editDistance: number): number {
  if (editDistance <= 0.05) return 5   // Almost no change
  if (editDistance <= 0.15) return 4   // Minor tweaks
  if (editDistance <= 0.35) return 3   // Moderate edits
  if (editDistance <= 0.60) return 2   // Significant rewrite
  return 1                             // Complete rewrite
}

export async function POST() {
  try {
    const supabase = await createClient()

    const stats = {
      emailsClassified: 0,
      editDistanceCalculated: 0,
      learningCasesCreated: 0,
      csatRatingsCreated: 0,
      knowledgeChunksCreated: 0,
      errors: [] as string[],
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 0: Classify unprocessed emails via shared pipeline
    // ═══════════════════════════════════════════════════════════════════════
    const { data: unclassifiedEmails } = await supabase
      .from('incoming_emails')
      .select('id, from_email, subject, body_text')
      .or('email_type.is.null,tone_sentiment.is.null')
      .limit(100)

    for (const email of unclassifiedEmails || []) {
      try {
        await processNewEmail(
          email.id,
          email.from_email || 'unknown@example.com',
          email.subject || '',
          email.body_text || ''
        )
        stats.emailsClassified++
      } catch (e) {
        stats.errors.push(`Classify ${email.id}: ${String(e).substring(0, 80)}`)
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Calculate edit_distance for drafts that have edited_response
    // ═══════════════════════════════════════════════════════════════════════
    const { data: draftsNeedingDistance } = await supabase
      .from('email_drafts')
      .select('id, ai_generated_response, edited_response, edit_distance')
      .not('edited_response', 'is', null)
      .is('edit_distance', null)
      .limit(200)

    for (const draft of draftsNeedingDistance || []) {
      const dist = calculateEditDistance(
        draft.ai_generated_response,
        draft.edited_response
      )
      await supabase
        .from('email_drafts')
        .update({
          edit_distance: Math.round(dist * 1000) / 1000,
          was_manually_rewritten: dist > 0.3,
        })
        .eq('id', draft.id)
      stats.editDistanceCalculated++
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Create learning_cases for edited drafts without one
    // ═══════════════════════════════════════════════════════════════════════
    const { data: draftsForLearning } = await supabase
      .from('email_drafts')
      .select('id, email_id, ai_generated_response, edited_response, edit_distance, learning_extracted')
      .not('edited_response', 'is', null)
      .eq('learning_extracted', false)
      .limit(200)

    for (const draft of draftsForLearning || []) {
      // Check if learning case already exists
      const { data: existing } = await supabase
        .from('learning_cases')
        .select('id')
        .eq('draft_id', draft.id)
        .maybeSingle()

      if (existing) {
        // Mark as extracted on draft
        await supabase
          .from('email_drafts')
          .update({ learning_extracted: true })
          .eq('id', draft.id)
        continue
      }

      const editDist = draft.edit_distance ??
        calculateEditDistance(draft.ai_generated_response, draft.edited_response)

      const { error } = await supabase
        .from('learning_cases')
        .insert({
          email_id: draft.email_id,
          draft_id: draft.id,
          original_draft: draft.ai_generated_response,
          corrected_response: draft.edited_response,
          edit_distance: Math.round(editDist * 1000) / 1000,
          difficulty_score: editDist > 0.5 ? 0.8 : editDist > 0.2 ? 0.5 : 0.2,
          status: 'pending',
        })

      if (error) {
        stats.errors.push(`Learning case: ${error.message}`)
      } else {
        stats.learningCasesCreated++
        await supabase
          .from('email_drafts')
          .update({ learning_extracted: true })
          .eq('id', draft.id)
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Derive CSAT ratings from drafts of sent emails
    // ═══════════════════════════════════════════════════════════════════════
    // Find sent emails that have drafts but no CSAT rating yet
    const { data: sentEmails } = await supabase
      .from('incoming_emails')
      .select('id')
      .eq('status', 'sent')
      .limit(200)

    const sentIds = (sentEmails || []).map(e => e.id)

    if (sentIds.length > 0) {
      // Get existing CSAT ratings to avoid duplicates
      const { data: existingCsat } = await supabase
        .from('csat_ratings')
        .select('email_id')
        .in('email_id', sentIds)

      const csatEmailIds = new Set((existingCsat || []).map(c => c.email_id))

      // Get drafts for sent emails without CSAT
      const emailsNeedingCsat = sentIds.filter(id => !csatEmailIds.has(id))

      for (const emailId of emailsNeedingCsat) {
        const { data: draft } = await supabase
          .from('email_drafts')
          .select('ai_generated_response, edited_response, edit_distance')
          .eq('email_id', emailId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!draft) continue

        let editDist = draft.edit_distance
        if (editDist === null && draft.edited_response) {
          editDist = calculateEditDistance(
            draft.ai_generated_response,
            draft.edited_response
          )
        }

        // If no edited_response → AI draft was used as-is → perfect score
        const rating = editDist !== null
          ? deriveCsatFromEditDistance(editDist)
          : 5

        const { error } = await supabase
          .from('csat_ratings')
          .insert({
            email_id: emailId,
            rating,
            comment: editDist !== null
              ? `Auto-CSAT: Edit-Distance ${(editDist * 100).toFixed(0)}%`
              : 'Auto-CSAT: Draft unverändert gesendet',
          })

        if (error) {
          stats.errors.push(`CSAT: ${error.message}`)
        } else {
          stats.csatRatingsCreated++
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Create knowledge chunks from sent emails (Q&A pairs)
    // ═══════════════════════════════════════════════════════════════════════
    for (const emailId of sentIds) {
      // Check if knowledge chunk already exists for this email
      const { data: existingChunk } = await supabase
        .from('knowledge_chunks')
        .select('id')
        .eq('source_type', 'sent_response')
        .contains('metadata', { email_id: emailId })
        .maybeSingle()

      if (existingChunk) continue

      // Fetch email + draft
      const { data: email } = await supabase
        .from('incoming_emails')
        .select('subject, body_text, from_name')
        .eq('id', emailId)
        .single()

      const { data: draft } = await supabase
        .from('email_drafts')
        .select('ai_generated_response, edited_response')
        .eq('email_id', emailId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!email || !draft) continue

      const finalResponse = draft.edited_response || draft.ai_generated_response
      const question = `${email.subject}\n${(email.body_text || '').substring(0, 1000)}`

      const qaChunk = `KUNDENANFRAGE (${email.from_name || 'Kunde'}):\n${question}\n\nGESENDETE ANTWORT:\n${finalResponse}`

      try {
        const embedding = await createEmbedding(qaChunk)

        const { error } = await supabase.from('knowledge_chunks').insert({
          content: qaChunk,
          embedding,
          source_type: 'sent_response',
          source_title: `Antwort: ${(email.subject || '').substring(0, 200)}`,
          metadata: {
            email_id: emailId,
            from_name: email.from_name,
            was_edited: !!draft.edited_response,
            backfilled: true,
          },
        })

        if (error) {
          stats.errors.push(`KB: ${error.message}`)
        } else {
          stats.knowledgeChunksCreated++
        }
      } catch (e) {
        stats.errors.push(`KB embedding: ${String(e).substring(0, 100)}`)
      }
    }

    return NextResponse.json({
      success: true,
      ...stats,
      errors: stats.errors.slice(0, 10),
      message: [
        stats.emailsClassified > 0 && `${stats.emailsClassified} E-Mails klassifiziert`,
        stats.editDistanceCalculated > 0 && `${stats.editDistanceCalculated} Edit-Distances berechnet`,
        stats.learningCasesCreated > 0 && `${stats.learningCasesCreated} Learning Cases erstellt`,
        stats.csatRatingsCreated > 0 && `${stats.csatRatingsCreated} CSAT-Bewertungen abgeleitet`,
        stats.knowledgeChunksCreated > 0 && `${stats.knowledgeChunksCreated} KB-Einträge erstellt`,
        stats.emailsClassified === 0 && stats.editDistanceCalculated === 0 && stats.learningCasesCreated === 0 &&
          stats.csatRatingsCreated === 0 && stats.knowledgeChunksCreated === 0 &&
          'Nichts zu backfillen — alle Daten sind aktuell',
      ].filter(Boolean).join(', '),
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { error: `Backfill fehlgeschlagen: ${String(error)}` },
      { status: 500 }
    )
  }
}
