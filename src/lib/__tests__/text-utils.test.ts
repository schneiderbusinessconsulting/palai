import { describe, it, expect } from 'vitest'
import {
  wordEditDistance,
  analyzeTone,
  determinePriority,
  calculateHappinessScore,
  detectSpam,
  detectTopicTags,
} from '@/lib/text-utils'

describe('wordEditDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(wordEditDistance('hello world', 'hello world')).toBe(0)
  })

  it('returns 1 for completely different strings', () => {
    expect(wordEditDistance('hello', 'goodbye')).toBe(1)
  })

  it('returns 0 for both empty strings', () => {
    expect(wordEditDistance('', '')).toBe(0)
  })

  it('returns 1 when one string is empty', () => {
    expect(wordEditDistance('hello', '')).toBe(1)
    expect(wordEditDistance('', 'hello')).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(wordEditDistance('Hello World', 'hello world')).toBe(0)
  })

  it('returns intermediate distance for partial overlap', () => {
    const dist = wordEditDistance('the quick brown fox', 'the slow brown dog')
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeLessThan(1)
  })

  it('rounds to 2 decimal places', () => {
    const dist = wordEditDistance('a b c d e', 'a b x y z')
    const str = String(dist)
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

describe('analyzeTone', () => {
  it('detects critical urgency', () => {
    const tone = analyzeTone('DRINGEND', 'Bitte sofort handeln')
    expect(tone.urgency).toBe('critical')
  })

  it('detects high urgency', () => {
    const tone = analyzeTone('', 'Bitte rasch antworten')
    expect(tone.urgency).toBe('high')
  })

  it('detects low urgency', () => {
    const tone = analyzeTone('', 'Keine Eile damit')
    expect(tone.urgency).toBe('low')
  })

  it('defaults to medium urgency', () => {
    const tone = analyzeTone('Anfrage', 'Ich habe eine Frage')
    expect(tone.urgency).toBe('medium')
  })

  it('detects frustrated sentiment', () => {
    const tone = analyzeTone('Beschwerde', 'Ich bin frustriert über den Service')
    expect(tone.sentiment).toBe('frustrated')
  })

  it('detects negative sentiment', () => {
    const tone = analyzeTone('Problem', 'Leider funktioniert es nicht')
    expect(tone.sentiment).toBe('negative')
  })

  it('detects positive sentiment', () => {
    const tone = analyzeTone('Danke', 'Das war super, vielen Dank!')
    expect(tone.sentiment).toBe('positive')
  })

  it('defaults to neutral sentiment', () => {
    const tone = analyzeTone('Anfrage', 'Ich möchte Informationen zum Kurs')
    expect(tone.sentiment).toBe('neutral')
  })

  it('detects formal tone (Sie)', () => {
    const tone = analyzeTone('', 'Können Sie mir helfen? Ich möchte Ihnen schreiben.')
    expect(tone.formality).toBe('formal')
  })

  it('detects informal tone (du)', () => {
    const tone = analyzeTone('', 'Kannst du mir helfen? Ich schreibe dir.')
    expect(tone.formality).toBe('informal')
  })
})

describe('determinePriority', () => {
  it('returns low when no response needed', () => {
    expect(determinePriority('customer_inquiry', 'critical', false)).toBe('low')
  })

  it('returns critical for critical urgency', () => {
    expect(determinePriority('customer_inquiry', 'critical', true)).toBe('critical')
  })

  it('returns high for customer_inquiry with high urgency', () => {
    expect(determinePriority('customer_inquiry', 'high', true)).toBe('high')
  })

  it('returns normal for customer_inquiry with medium urgency', () => {
    expect(determinePriority('customer_inquiry', 'medium', true)).toBe('normal')
  })

  it('returns normal for form_submission', () => {
    expect(determinePriority('form_submission', 'medium', true)).toBe('normal')
  })

  it('returns low for other types', () => {
    expect(determinePriority('system_alert', 'medium', true)).toBe('low')
  })
})

describe('calculateHappinessScore', () => {
  it('returns 1 for strong negative indicators', () => {
    expect(calculateHappinessScore('Skandal', 'Das ist unzumutbar und inakzeptabel!')).toBe(1)
  })

  it('returns 5 for strong positive without negatives', () => {
    expect(calculateHappinessScore('Fantastisch', 'Ich bin begeistert und überwältigt!')).toBe(5)
  })

  it('returns 3 for neutral text', () => {
    expect(calculateHappinessScore('Anfrage', 'Ich möchte gerne Informationen zum Kurs erhalten.')).toBe(3)
  })

  it('increases score for positive words', () => {
    const score = calculateHappinessScore('', 'Das war toll und super, wunderbar gemacht!')
    expect(score).toBeGreaterThan(3)
  })

  it('decreases score for negative words', () => {
    const score = calculateHappinessScore('Problem', 'Leider gibt es einen Fehler, schade')
    expect(score).toBeLessThan(3)
  })

  it('decreases score for churn signals', () => {
    const score = calculateHappinessScore('Stornierung', 'Ich möchte kündigen und absagen')
    expect(score).toBeLessThan(3)
  })

  it('clamps between 1 and 5', () => {
    const low = calculateHappinessScore('Katastrophe', 'Fehler Problem Mangel Beschwerde')
    const high = calculateHappinessScore('Perfekt', 'Toll super wunderbar gut danke empfehlen')
    expect(low).toBeGreaterThanOrEqual(1)
    expect(high).toBeLessThanOrEqual(5)
  })
})

describe('detectSpam', () => {
  it('detects bulk email domains as spam', () => {
    const result = detectSpam('newsletter@mailchimp.com', 'Special Offer', 'Click here to unsubscribe')
    expect(result.isSpam).toBe(true)
    expect(result.spamScore).toBeGreaterThanOrEqual(60)
  })

  it('does not flag normal customer email as spam', () => {
    const result = detectSpam('customer@example.com', 'Anfrage zum Kurs', 'Hallo, ich hätte gerne mehr Informationen.')
    expect(result.isSpam).toBe(false)
    expect(result.spamScore).toBeLessThan(60)
  })

  it('scores unsubscribe keywords', () => {
    const result = detectSpam('info@example.com', 'Newsletter', 'Click to unsubscribe from this list')
    expect(result.spamScore).toBeGreaterThanOrEqual(30)
  })

  it('scores promotional keywords', () => {
    const result = detectSpam('info@example.com', 'Kostenlos gewinnen', 'Sonderangebot nur heute!')
    expect(result.spamScore).toBeGreaterThanOrEqual(30)
  })

  it('scores ALL-CAPS subjects', () => {
    const result = detectSpam('spam@example.com', 'FREE MONEY WINNER NOW', 'Click here')
    expect(result.spamScore).toBeGreaterThanOrEqual(20)
  })

  it('scores excessive URLs', () => {
    const urls = Array(6).fill('https://example.com/link').join(' ')
    const result = detectSpam('info@example.com', 'Links', urls)
    expect(result.spamScore).toBeGreaterThanOrEqual(15)
  })

  it('scores generic greeting + promo combo', () => {
    const result = detectSpam('info@example.com', 'Sonderangebot', 'Sehr geehrte Damen und Herren, kostenlos gewinnen!')
    expect(result.spamScore).toBeGreaterThanOrEqual(25)
  })

  it('boosts score for suspicious prefix with other signals', () => {
    const withPrefix = detectSpam('noreply@example.com', 'Rabatt', 'Kostenlos gewinnen!')
    const withoutPrefix = detectSpam('sales@example.com', 'Rabatt', 'Kostenlos gewinnen!')
    expect(withPrefix.spamScore).toBeGreaterThan(withoutPrefix.spamScore)
  })

  it('returns 0 spam score for clean email', () => {
    const result = detectSpam('customer@gmail.com', 'Frage', 'Können Sie mir helfen?')
    expect(result.spamScore).toBe(0)
    expect(result.isSpam).toBe(false)
  })
})

describe('detectTopicTags', () => {
  it('detects Anfrage tag', () => {
    const tags = detectTopicTags('Anfrage', 'Ich habe eine Frage dazu')
    expect(tags).toContain('Anfrage')
  })

  it('detects Beschwerde tag', () => {
    const tags = detectTopicTags('Beschwerde', 'Ich bin unzufrieden mit dem Mangel')
    expect(tags).toContain('Beschwerde')
  })

  it('detects Kurs tag', () => {
    const tags = detectTopicTags('Kurs', 'Ich möchte mich für die Ausbildung anmelden')
    expect(tags).toContain('Kurs')
  })

  it('detects Rechnung tag', () => {
    const tags = detectTopicTags('', 'Die Rechnung und Zahlung ist noch offen')
    expect(tags).toContain('Rechnung')
  })

  it('returns max 3 tags', () => {
    const text = 'Anfrage Beschwerde Kurs Rechnung Termin Anmeldung Produkt Kooperation'
    const tags = detectTopicTags(text, text)
    expect(tags.length).toBeLessThanOrEqual(3)
  })

  it('returns empty array for no matches', () => {
    const tags = detectTopicTags('Hello', 'World xyz abc')
    expect(tags).toEqual([])
  })

  it('sorts by relevance (number of keyword matches)', () => {
    const tags = detectTopicTags(
      'Kurs Ausbildung Seminar',
      'Der Kurs und die Ausbildung und das Seminar und der Workshop sind toll. Frage dazu.'
    )
    expect(tags[0]).toBe('Kurs')
  })

  it('detects Stornierung tag', () => {
    const tags = detectTopicTags('Stornierung', 'Ich möchte kündigen und stornieren')
    expect(tags).toContain('Stornierung')
  })
})
