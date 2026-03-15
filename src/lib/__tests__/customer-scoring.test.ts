import { describe, it, expect } from 'vitest'
import {
  calculateHealthScore,
  determineSegment,
  getSegmentConfig,
} from '@/lib/customer-scoring'

describe('calculateHealthScore', () => {
  it('returns 50 for perfectly neutral inputs', () => {
    // happiness=3 (neutral), 0 emails, 0 response rate, 0 days
    const score = calculateHealthScore(3, 0, 0, 0)
    expect(score).toBe(50)
  })

  it('maxes out at 100', () => {
    const score = calculateHealthScore(5, 100, 1, 0)
    expect(score).toBe(100)
  })

  it('floors at 0', () => {
    const score = calculateHealthScore(1, 0, 0, 100)
    expect(score).toBe(0)
  })

  it('adds happiness bonus for happy customers', () => {
    // happiness=5 → (5-3)*15 = +30
    const happy = calculateHealthScore(5, 0, 0, 0)
    const neutral = calculateHealthScore(3, 0, 0, 0)
    expect(happy - neutral).toBe(30)
  })

  it('subtracts happiness penalty for unhappy customers', () => {
    // happiness=1 → (1-3)*15 = -30
    const unhappy = calculateHealthScore(1, 0, 0, 0)
    const neutral = calculateHealthScore(3, 0, 0, 0)
    expect(neutral - unhappy).toBe(30)
  })

  it('adds email activity bonus capped at 20', () => {
    const fewEmails = calculateHealthScore(3, 3, 0, 0)
    const manyEmails = calculateHealthScore(3, 50, 0, 0)
    // 3*2=6 vs cap=20
    expect(fewEmails).toBe(56)
    expect(manyEmails).toBe(70)
  })

  it('adds response rate bonus', () => {
    const withResponse = calculateHealthScore(3, 0, 1, 0)
    const noResponse = calculateHealthScore(3, 0, 0, 0)
    expect(withResponse - noResponse).toBe(10)
  })

  it('applies recency penalty for >90 days', () => {
    const recent = calculateHealthScore(3, 0, 0, 10)
    const old = calculateHealthScore(3, 0, 0, 91)
    expect(recent - old).toBe(20)
  })

  it('applies smaller recency penalty for 31-90 days', () => {
    const recent = calculateHealthScore(3, 0, 0, 10)
    const stale = calculateHealthScore(3, 0, 0, 60)
    expect(recent - stale).toBe(10)
  })

  it('returns rounded integer', () => {
    const score = calculateHealthScore(3.5, 1, 0.5, 0)
    expect(Number.isInteger(score)).toBe(true)
  })
})

describe('determineSegment', () => {
  it('returns vip for high health + high buying intent', () => {
    expect(determineSegment(85, 10, 10, 70)).toBe('vip')
  })

  it('returns churned for low health score', () => {
    expect(determineSegment(20, 5, 10, 30)).toBe('churned')
  })

  it('returns churned for >90 days since last contact', () => {
    expect(determineSegment(60, 5, 91, 30)).toBe('churned')
  })

  it('returns at_risk for health score 30-49', () => {
    expect(determineSegment(40, 5, 20, 30)).toBe('at_risk')
  })

  it('returns new for low activity + recent contact', () => {
    expect(determineSegment(60, 2, 10, 30)).toBe('new')
  })

  it('returns active as default', () => {
    expect(determineSegment(60, 10, 10, 30)).toBe('active')
  })

  it('prefers vip over other segments when conditions overlap', () => {
    // Both VIP conditions AND new conditions met
    expect(determineSegment(90, 1, 5, 80)).toBe('vip')
  })

  it('prefers churned over at_risk when both match', () => {
    expect(determineSegment(25, 5, 100, 10)).toBe('churned')
  })
})

describe('getSegmentConfig', () => {
  it('returns correct config for vip', () => {
    const config = getSegmentConfig('vip')
    expect(config.label).toBe('VIP')
    expect(config.color).toContain('amber')
  })

  it('returns correct config for at_risk', () => {
    const config = getSegmentConfig('at_risk')
    expect(config.label).toBe('Gefährdet')
    expect(config.color).toContain('red')
  })

  it('returns correct config for new', () => {
    const config = getSegmentConfig('new')
    expect(config.label).toBe('Neu')
    expect(config.color).toContain('blue')
  })

  it('returns correct config for churned', () => {
    const config = getSegmentConfig('churned')
    expect(config.label).toBe('Abgewandert')
    expect(config.color).toContain('slate')
  })

  it('returns correct config for active', () => {
    const config = getSegmentConfig('active')
    expect(config.label).toBe('Aktiv')
    expect(config.color).toContain('green')
  })

  it('falls back to active for unknown segment', () => {
    const config = getSegmentConfig('unknown_segment')
    expect(config.label).toBe('Aktiv')
  })
})
