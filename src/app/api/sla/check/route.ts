import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAutomationRules } from '@/lib/automation/engine'
import { calculateBusinessMinutes, BusinessHoursConfig } from '@/lib/business-hours'

/**
 * SLA Auto-Update: Checks all open emails and updates sla_status
 * based on elapsed business minutes vs SLA target.
 * - ok → at_risk (>80% of target elapsed)
 * - at_risk → breached (>100% of target elapsed)
 *
 * Uses business hours from DB (if available) to only count working time.
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Fetch business hours (optional — uses defaults if table doesn't exist)
    let businessHours: BusinessHoursConfig[] | undefined
    try {
      const { data: bh } = await supabase
        .from('business_hours')
        .select('day_of_week, start_time, end_time, is_active')
        .order('day_of_week')
      if (bh?.length) businessHours = bh as BusinessHoursConfig[]
    } catch { /* table may not exist — use defaults */ }

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

    const now = new Date()
    let updated = 0

    for (const email of emails) {
      const target = email.sla_target_id
        ? targetMap.get(email.sla_target_id)
        : priorityMap.get(email.priority || 'normal')

      if (!target) continue

      // Use business hours for elapsed time calculation
      const elapsedMinutes = calculateBusinessMinutes(
        new Date(email.received_at),
        now,
        businessHours
      )
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
