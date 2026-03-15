/**
 * SLA status-transition logic tests.
 *
 * The SLA check route (/api/sla/check) derives new SLA status from:
 *   - elapsedBusinessMinutes (via calculateBusinessMinutes)
 *   - targetMinutes (from sla_targets table)
 *
 * Rules:
 *   - elapsedMinutes > targetMinutes                → 'breached'
 *   - elapsedMinutes > targetMinutes * 0.8 && current === 'ok' → 'at_risk'
 *   - otherwise                                     → no change (null)
 *
 * We extract and unit-test those rules here without touching Supabase.
 * We also test calculateBusinessMinutes directly for SLA-relevant scenarios.
 */
import { describe, it, expect } from 'vitest'
import { calculateBusinessMinutes, BusinessHoursConfig } from '../business-hours'

// ─── Pure SLA transition helper (mirrors the route's logic) ─────────────────

type SlaStatus = 'ok' | 'at_risk' | 'breached'

function computeNewSlaStatus(
  elapsedMinutes: number,
  targetMinutes: number,
  currentStatus: SlaStatus,
): SlaStatus | null {
  if (elapsedMinutes > targetMinutes && currentStatus !== 'breached') {
    return 'breached'
  }
  if (elapsedMinutes > targetMinutes * 0.8 && currentStatus === 'ok') {
    return 'at_risk'
  }
  return null // no change
}

// ─── SLA transition logic ────────────────────────────────────────────────────

describe('SLA status transitions', () => {
  it('returns null when well within target', () => {
    // 60 elapsed, 480 target → 12.5 % used
    expect(computeNewSlaStatus(60, 480, 'ok')).toBeNull()
  })

  it('returns "at_risk" when > 80 % of target elapsed and status is "ok"', () => {
    // 400 elapsed, 480 target → 83 % used
    expect(computeNewSlaStatus(400, 480, 'ok')).toBe('at_risk')
  })

  it('does not transition to at_risk when status is already "at_risk"', () => {
    // Already at_risk — only breach upgrade is allowed now
    expect(computeNewSlaStatus(400, 480, 'at_risk')).toBeNull()
  })

  it('returns "breached" when elapsed exceeds target (from ok)', () => {
    expect(computeNewSlaStatus(500, 480, 'ok')).toBe('breached')
  })

  it('returns "breached" when elapsed exceeds target (from at_risk)', () => {
    expect(computeNewSlaStatus(500, 480, 'at_risk')).toBe('breached')
  })

  it('does not change status when already breached', () => {
    expect(computeNewSlaStatus(1000, 480, 'breached')).toBeNull()
  })

  it('is not at_risk exactly at 80 % boundary', () => {
    // 384 = 480 * 0.8 — not strictly greater
    expect(computeNewSlaStatus(384, 480, 'ok')).toBeNull()
  })

  it('becomes at_risk one minute past the 80 % threshold', () => {
    // 385 > 384 → at_risk
    expect(computeNewSlaStatus(385, 480, 'ok')).toBe('at_risk')
  })

  it('handles zero-elapsed (fresh email)', () => {
    expect(computeNewSlaStatus(0, 240, 'ok')).toBeNull()
  })

  it('handles very short SLA targets (30-minute target)', () => {
    // 25 minutes elapsed, 30-minute target → 83 % → at_risk
    expect(computeNewSlaStatus(25, 30, 'ok')).toBe('at_risk')
    // 31 minutes elapsed → breached
    expect(computeNewSlaStatus(31, 30, 'ok')).toBe('breached')
  })
})

// ─── calculateBusinessMinutes for SLA-relevant time windows ─────────────────

const businessHours: BusinessHoursConfig[] = [
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_active: true },
]

describe('calculateBusinessMinutes for SLA scenarios', () => {
  it('email received and responded within same business morning — 30 minutes', () => {
    // Monday 09:00 → 09:30
    const received = new Date(2026, 2, 9, 9, 0, 0)
    const checked = new Date(2026, 2, 9, 9, 30, 0)
    expect(calculateBusinessMinutes(received, checked, businessHours)).toBe(30)
  })

  it('email received at end of day — rolls over to next morning', () => {
    // Monday 16:30 → Tuesday 08:30 = 30 + 30 = 60 business minutes
    const received = new Date(2026, 2, 9, 16, 30, 0)
    const checked = new Date(2026, 2, 10, 8, 30, 0)
    expect(calculateBusinessMinutes(received, checked, businessHours)).toBe(60)
  })

  it('email received Friday end-of-day — weekend does not count', () => {
    // Friday 16:00 → Monday 09:00 = 60 + 60 = 120 business minutes
    const received = new Date(2026, 2, 13, 16, 0, 0) // Friday
    const checked = new Date(2026, 2, 16, 9, 0, 0)  // Monday
    expect(calculateBusinessMinutes(received, checked, businessHours)).toBe(120)
  })

  it('email received outside business hours — pre-hours time not counted', () => {
    // Monday 06:00 → Monday 09:00 = only 08:00-09:00 = 60 minutes
    const received = new Date(2026, 2, 9, 6, 0, 0)
    const checked = new Date(2026, 2, 9, 9, 0, 0)
    expect(calculateBusinessMinutes(received, checked, businessHours)).toBe(60)
  })

  it('email received at weekend — full first business day available if needed', () => {
    // Saturday 10:00 → Monday 17:00 = full Monday = 540 minutes
    const received = new Date(2026, 2, 14, 10, 0, 0) // Saturday
    const checked = new Date(2026, 2, 16, 17, 0, 0)  // Monday
    expect(calculateBusinessMinutes(received, checked, businessHours)).toBe(540)
  })

  it('SLA breach check: 4-hour target (240 min) — exactly at boundary is at_risk', () => {
    // Monday 08:00 → Monday 12:00 = 240 minutes
    const received = new Date(2026, 2, 9, 8, 0, 0)
    const checked = new Date(2026, 2, 9, 12, 0, 0)
    const elapsed = calculateBusinessMinutes(received, checked, businessHours)
    expect(elapsed).toBe(240)
    // 240 > 240 * 0.8 (192) and status is 'ok' → becomes at_risk (not breached yet)
    expect(computeNewSlaStatus(elapsed, 240, 'ok')).toBe('at_risk')
  })

  it('SLA breach check: 4-hour target — 1 minute over causes breach', () => {
    // Monday 08:00 → Monday 12:01
    const received = new Date(2026, 2, 9, 8, 0, 0)
    const checked = new Date(2026, 2, 9, 12, 1, 0)
    const elapsed = calculateBusinessMinutes(received, checked, businessHours)
    expect(elapsed).toBe(241)
    expect(computeNewSlaStatus(elapsed, 240, 'ok')).toBe('breached')
  })

  it('SLA at_risk check: 8-hour target, 80% = 384 min crossed', () => {
    // Monday 08:00 → roughly 14:25 (385 business minutes)
    const received = new Date(2026, 2, 9, 8, 0, 0)
    const checked = new Date(2026, 2, 9, 14, 25, 0)
    const elapsed = calculateBusinessMinutes(received, checked, businessHours)
    expect(elapsed).toBeGreaterThan(384)
    expect(computeNewSlaStatus(elapsed, 480, 'ok')).toBe('at_risk')
  })
})
