import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cn, formatRelativeDate, formatAbsoluteDate } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    expect(cn('foo', true && 'bar')).toBe('foo bar')
  })

  it('merges tailwind classes — later wins', () => {
    // twMerge resolves conflicting tailwind utilities
    expect(cn('p-4', 'p-8')).toBe('p-8')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('deduplicates identical classes', () => {
    const result = cn('flex', 'flex')
    expect(result).toBe('flex')
  })

  it('handles arrays and objects', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
    expect(cn({ foo: true, bar: false })).toBe('foo')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
    expect(cn(undefined, null as never, '')).toBe('')
  })
})

// ─── formatRelativeDate ───────────────────────────────────────────────────────

describe('formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Fix "now" to a known Wednesday
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "gerade eben" for timestamps less than 1 minute ago', () => {
    const date = new Date(Date.now() - 30_000) // 30 seconds ago
    expect(formatRelativeDate(date.toISOString())).toBe('gerade eben')
  })

  it('returns "vor wenigen Minuten" for 1–5 minutes ago', () => {
    const oneMinAgo = new Date(Date.now() - 60_000)
    expect(formatRelativeDate(oneMinAgo.toISOString())).toBe('vor wenigen Minuten')

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000)
    expect(formatRelativeDate(fiveMinAgo.toISOString())).toBe('vor wenigen Minuten')
  })

  it('returns "vor X Min" for 6–59 minutes ago', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000)
    expect(formatRelativeDate(tenMinAgo.toISOString())).toBe('vor 10 Min')

    const fiftyMinAgo = new Date(Date.now() - 50 * 60_000)
    expect(formatRelativeDate(fiftyMinAgo.toISOString())).toBe('vor 50 Min')
  })

  it('returns "vor Xh" for 1–23 hours ago', () => {
    const oneHourAgo = new Date(Date.now() - 3600_000)
    expect(formatRelativeDate(oneHourAgo.toISOString())).toBe('vor 1h')

    const tenHoursAgo = new Date(Date.now() - 10 * 3600_000)
    expect(formatRelativeDate(tenHoursAgo.toISOString())).toBe('vor 10h')
  })

  it('returns "gestern" for exactly 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 86400_000)
    expect(formatRelativeDate(oneDayAgo.toISOString())).toBe('gestern')
  })

  it('returns "vor X Tagen" for 2–6 days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400_000)
    expect(formatRelativeDate(twoDaysAgo.toISOString())).toBe('vor 2 Tagen')

    const sixDaysAgo = new Date(Date.now() - 6 * 86400_000)
    expect(formatRelativeDate(sixDaysAgo.toISOString())).toBe('vor 6 Tagen')
  })

  it('returns "vor X Wochen" for 7–29 days ago', () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 86400_000)
    expect(formatRelativeDate(oneWeekAgo.toISOString())).toBe('vor 1 Wochen')

    const threeWeeksAgo = new Date(Date.now() - 21 * 86400_000)
    expect(formatRelativeDate(threeWeeksAgo.toISOString())).toBe('vor 3 Wochen')
  })

  it('falls back to locale date string for dates 30+ days ago', () => {
    // 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000)
    const result = formatRelativeDate(thirtyDaysAgo.toISOString())
    // Should be a localeDateString, not one of the relative labels
    expect(result).not.toMatch(/^vor|^gerade|^gestern/)
    // de-CH format check: contains digits and dots or similar date notation
    expect(result.length).toBeGreaterThan(4)
  })
})

// ─── formatAbsoluteDate ───────────────────────────────────────────────────────

describe('formatAbsoluteDate', () => {
  it('formats a date without time (default)', () => {
    const result = formatAbsoluteDate('2026-03-15T12:00:00.000Z')
    // Should contain the year
    expect(result).toContain('2026')
  })

  it('formats a date with time when withTime is true', () => {
    const result = formatAbsoluteDate('2026-03-15T14:30:00.000Z', { withTime: true })
    expect(result).toContain('2026')
    // Should contain some form of time digits
    expect(result).toMatch(/\d{2}/)
  })

  it('does not include time component when withTime is false or omitted', () => {
    const withoutTime = formatAbsoluteDate('2026-03-15T14:30:00.000Z')
    const withTimeFalse = formatAbsoluteDate('2026-03-15T14:30:00.000Z', { withTime: false })
    // Both should produce the same date-only output
    expect(withoutTime).toBe(withTimeFalse)
  })

  it('returns a different (longer) string when withTime is true', () => {
    const withoutTime = formatAbsoluteDate('2026-03-15T14:30:00.000Z')
    const withTime = formatAbsoluteDate('2026-03-15T14:30:00.000Z', { withTime: true })
    expect(withTime.length).toBeGreaterThan(withoutTime.length)
  })

  it('handles ISO date-only string', () => {
    const result = formatAbsoluteDate('2026-01-01')
    expect(result).toContain('2026')
  })
})
