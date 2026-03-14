import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAutomationRules } from '@/lib/automation/engine'

/**
 * SLA Auto-Update: Checks all open emails and updates sla_status
 * based on elapsed time vs SLA target.
 * - ok → at_risk (>80% of target elapsed)
 * - at_risk → breached (>100% of target elapsed)
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Fetch open emails that need response with their SLA targets
    const { data: emails, error } = await supabase
      .from('incoming_emails')
      .select('id, received_at, priority, sla_status, sla_target_id')
      .eq('needs_response', true)
      .in('status', ['pending', 'draft_ready'])
      .in('sla_status', ['ok', 'at_risk'])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0 })
    }

    // Fetch SLA targets
    const { data: slaTargets } = await supabase
      .from('sla_targets')
      .select('id, priority, first_response_minutes')

    if (!slaTargets?.length) {
      return NextResponse.json({ checked: emails.length, updated: 0 })
    }

    const targetMap = new Map(slaTargets.map(t => [t.id, t]))
    // Also build priority-based lookup
    const priorityMap = new Map(slaTargets.map(t => [t.priority, t]))

    const now = Date.now()
    let updated = 0

    for (const email of emails) {
      const target = email.sla_target_id
        ? targetMap.get(email.sla_target_id)
        : priorityMap.get(email.priority || 'normal')

      if (!target) continue

      const elapsedMinutes = (now - new Date(email.received_at).getTime()) / (1000 * 60)
      const targetMinutes = target.first_response_minutes

      let newStatus: string | null = null

      if (elapsedMinutes > targetMinutes && email.sla_status !== 'breached') {
        newStatus = 'breached'
      } else if (elapsedMinutes > targetMinutes * 0.8 && email.sla_status === 'ok') {
        newStatus = 'at_risk'
      }

      if (newStatus) {
        await supabase
          .from('incoming_emails')
          .update({ sla_status: newStatus })
          .eq('id', email.id)
        updated++

        // Fire automation rules for SLA transitions
        const trigger = newStatus === 'breached' ? 'sla_breached' : 'sla_at_risk'
        runAutomationRules(supabase, { id: email.id, priority: email.priority }, trigger)
          .catch(err => console.error('Automation trigger error:', err))
      }
    }

    return NextResponse.json({ checked: emails.length, updated })
  } catch (error) {
    console.error('SLA check error:', error)
    return NextResponse.json({ error: 'Failed to check SLA' }, { status: 500 })
  }
}
