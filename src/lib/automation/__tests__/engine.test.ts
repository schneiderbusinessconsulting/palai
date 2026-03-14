import { describe, it, expect } from 'vitest'
import { evaluateConditions, AutomationCondition } from '../engine'

describe('evaluateConditions', () => {
  const email = {
    id: 'test-1',
    from_email: 'customer@example.com',
    from_name: 'John Doe',
    subject: 'Urgent: Payment issue',
    priority: 'high',
    tone_sentiment: 'negative',
    buying_intent_score: 75,
    email_type: 'customer_inquiry',
    tags: ['vip', 'payment'],
  }

  it('should match eq condition', () => {
    const conditions: AutomationCondition[] = [
      { field: 'priority', operator: 'eq', value: 'high' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should not match eq when different', () => {
    const conditions: AutomationCondition[] = [
      { field: 'priority', operator: 'eq', value: 'low' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(false)
  })

  it('should match neq condition', () => {
    const conditions: AutomationCondition[] = [
      { field: 'priority', operator: 'neq', value: 'low' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should match contains on string', () => {
    const conditions: AutomationCondition[] = [
      { field: 'from_email', operator: 'contains', value: '@example.com' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should match contains on array', () => {
    const conditions: AutomationCondition[] = [
      { field: 'tags', operator: 'contains', value: 'vip' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should match not_contains', () => {
    const conditions: AutomationCondition[] = [
      { field: 'subject', operator: 'not_contains', value: 'refund' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should match in operator', () => {
    const conditions: AutomationCondition[] = [
      { field: 'tone_sentiment', operator: 'in', value: ['negative', 'frustrated'] },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should match gt operator', () => {
    const conditions: AutomationCondition[] = [
      { field: 'buying_intent_score', operator: 'gt', value: 50 },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should not match gt when less', () => {
    const conditions: AutomationCondition[] = [
      { field: 'buying_intent_score', operator: 'gt', value: 80 },
    ]
    expect(evaluateConditions(email, conditions)).toBe(false)
  })

  it('should match gte operator at boundary', () => {
    const conditions: AutomationCondition[] = [
      { field: 'buying_intent_score', operator: 'gte', value: 75 },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should match lt operator', () => {
    const conditions: AutomationCondition[] = [
      { field: 'buying_intent_score', operator: 'lt', value: 100 },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should require ALL conditions to match', () => {
    const conditions: AutomationCondition[] = [
      { field: 'priority', operator: 'eq', value: 'high' },
      { field: 'tone_sentiment', operator: 'eq', value: 'negative' },
      { field: 'buying_intent_score', operator: 'gt', value: 50 },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })

  it('should fail if any condition does not match', () => {
    const conditions: AutomationCondition[] = [
      { field: 'priority', operator: 'eq', value: 'high' },
      { field: 'tone_sentiment', operator: 'eq', value: 'positive' }, // mismatch
    ]
    expect(evaluateConditions(email, conditions)).toBe(false)
  })

  it('should match empty conditions (no filter)', () => {
    expect(evaluateConditions(email, [])).toBe(true)
  })

  it('should handle case-insensitive contains', () => {
    const conditions: AutomationCondition[] = [
      { field: 'subject', operator: 'contains', value: 'URGENT' },
    ]
    expect(evaluateConditions(email, conditions)).toBe(true)
  })
})
