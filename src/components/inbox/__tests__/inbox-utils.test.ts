import { describe, it, expect } from 'vitest'
import { getConfidenceColor } from '../inbox-utils'

// getStatusBadge, getEmailTypeBadge, getBuyingIntentBadge return JSX — we only
// test the pure, non-JSX utility function here. The badge-returning functions
// are integration-tested via component snapshots elsewhere.

describe('getConfidenceColor', () => {
  it('returns green for high confidence (>= 0.85)', () => {
    expect(getConfidenceColor(0.85)).toBe('bg-green-500')
    expect(getConfidenceColor(0.90)).toBe('bg-green-500')
    expect(getConfidenceColor(1.0)).toBe('bg-green-500')
  })

  it('returns amber for medium confidence (>= 0.7 and < 0.85)', () => {
    expect(getConfidenceColor(0.70)).toBe('bg-amber-500')
    expect(getConfidenceColor(0.75)).toBe('bg-amber-500')
    expect(getConfidenceColor(0.84)).toBe('bg-amber-500')
  })

  it('returns red for low confidence (< 0.7)', () => {
    expect(getConfidenceColor(0.69)).toBe('bg-red-500')
    expect(getConfidenceColor(0.50)).toBe('bg-red-500')
    expect(getConfidenceColor(0.0)).toBe('bg-red-500')
  })

  it('handles boundary value 0.85 as green, not amber', () => {
    expect(getConfidenceColor(0.85)).toBe('bg-green-500')
  })

  it('handles boundary value 0.7 as amber, not red', () => {
    expect(getConfidenceColor(0.70)).toBe('bg-amber-500')
  })
})
