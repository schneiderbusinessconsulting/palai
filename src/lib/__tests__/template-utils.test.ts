import { describe, it, expect } from 'vitest'
import { resolveTemplateVariables, detectCourseName, getAvailableVariables } from '../template-utils'

describe('resolveTemplateVariables', () => {
  it('replaces {{name}} with recipient name', () => {
    const result = resolveTemplateVariables('Hallo {{name}}!', { recipientName: 'Max' })
    expect(result).toBe('Hallo Max!')
  })

  it('falls back to email when name is missing', () => {
    const result = resolveTemplateVariables('Hallo {{name}}!', { recipientEmail: 'max@test.ch' })
    expect(result).toBe('Hallo max@test.ch!')
  })

  it('replaces multiple variables', () => {
    const result = resolveTemplateVariables(
      'Liebe/r {{name}}, Ihr Kurs: {{kurs}}. Mit freundlichen Gruessen, {{absender}}',
      { recipientName: 'Lisa', courseName: 'Hypnose', senderName: 'Philipp' }
    )
    expect(result).toBe('Liebe/r Lisa, Ihr Kurs: Hypnose. Mit freundlichen Gruessen, Philipp')
  })

  it('replaces {{datum}} with today date', () => {
    const result = resolveTemplateVariables('Datum: {{datum}}', {})
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })

  it('keeps unknown variables as-is', () => {
    const result = resolveTemplateVariables('{{unknown}} bleibt', {})
    expect(result).toBe('{{unknown}} bleibt')
  })

  it('keeps variable if value is empty', () => {
    const result = resolveTemplateVariables('Kurs: {{kurs}}', {})
    expect(result).toBe('Kurs: {{kurs}}')
  })

  it('is case-insensitive for variable names', () => {
    const result = resolveTemplateVariables('{{Name}} {{ABSENDER}}', {
      recipientName: 'Max', senderName: 'Phil'
    })
    expect(result).toBe('Max Phil')
  })
})

describe('detectCourseName', () => {
  it('detects Hypnose', () => {
    expect(detectCourseName('Frage zur Hypnose-Ausbildung')).toBe('Hypnose-Ausbildung')
  })

  it('detects Meditation', () => {
    expect(detectCourseName('Meditation Kursanmeldung')).toBe('Meditation')
  })

  it('detects Coaching', () => {
    expect(detectCourseName('Life Coaching Infos')).toBe('Life Coaching')
  })

  it('returns undefined for unknown', () => {
    expect(detectCourseName('Allgemeine Anfrage')).toBeUndefined()
  })
})

describe('getAvailableVariables', () => {
  it('returns all available variables', () => {
    const vars = getAvailableVariables()
    expect(vars.length).toBeGreaterThanOrEqual(5)
    expect(vars.some(v => v.variable === '{{name}}')).toBe(true)
  })
})
