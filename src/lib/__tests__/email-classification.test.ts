import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the OpenAI module before importing classifyEmail so the lazy client
// is never instantiated (no OPENAI_API_KEY required in tests).
vi.mock('../ai/openai', async (importOriginal) => {
  const original = await importOriginal<typeof import('../ai/openai')>()
  return {
    ...original,
    // Provide a stub that returns a customer_inquiry result so any tests that
    // fall through to the AI branch still get a deterministic value.
    classifyEmail: vi.fn(original.classifyEmail),
  }
})

// Also stub the OpenAI client so no real HTTP requests are made.
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            emailType: 'customer_inquiry',
            needsResponse: true,
            reason: 'Test-Fallback',
          }),
        },
      },
    ],
  })

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    embeddings: { create: vi.fn() },
  }))

  return { default: MockOpenAI }
})

import { classifyEmail } from '../ai/openai'

describe('classifyEmail – rule-based classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── system_alert via known sender domain ─────────────────────────────────

  it('classifies emails from stripe.com as system_alert', async () => {
    const result = await classifyEmail(
      'noreply@stripe.com',
      'Your payout has been processed',
      'Your payout of CHF 1250 was sent to your bank account.',
    )
    expect(result.emailType).toBe('system_alert')
    expect(result.needsResponse).toBe(false)
  })

  it('classifies emails from github.com as system_alert', async () => {
    const result = await classifyEmail(
      'noreply@github.com',
      'Pull request merged',
      'Your pull request was merged into main.',
    )
    expect(result.emailType).toBe('system_alert')
    expect(result.needsResponse).toBe(false)
  })

  it('classifies emails from no-reply@ address as system_alert', async () => {
    const result = await classifyEmail(
      'no-reply@somesaas.io',
      'Weekly digest',
      'Here is your weekly activity summary.',
    )
    expect(result.emailType).toBe('system_alert')
    expect(result.needsResponse).toBe(false)
  })

  it('classifies emails from noreply@ address as system_alert', async () => {
    const result = await classifyEmail(
      'noreply@newsletter.example.com',
      'Monthly newsletter',
      'Check out our latest updates.',
    )
    expect(result.emailType).toBe('system_alert')
    expect(result.needsResponse).toBe(false)
  })

  // ── Override: system sender but subject looks like a customer enquiry ────

  it('classifies stripe email with "Anfrage" as notification due to transaction keyword', async () => {
    const result = await classifyEmail(
      'support@stripe.com',
      'Anfrage zur Zahlung',
      'Ich habe eine Frage zu meiner letzten Transaktion.',
    )
    // mightBeCustomer bypasses system_alert, but "Transaktion" triggers notification
    expect(result.emailType).toBe('notification')
  })

  // ── notification via build/deploy keywords ───────────────────────────────

  it('classifies build failure subject as notification', async () => {
    const result = await classifyEmail(
      'ci@mycompany.com',
      'Build failed on branch main',
      'The CI pipeline failed. Please check the logs.',
    )
    expect(result.emailType).toBe('notification')
    expect(result.needsResponse).toBe(false)
  })

  it('classifies deploy success subject as notification', async () => {
    const result = await classifyEmail(
      'ci@mycompany.com',
      'Deploy succeeded',
      'Deployment to production completed successfully.',
    )
    expect(result.emailType).toBe('notification')
    expect(result.needsResponse).toBe(false)
  })

  // ── notification via transaction keywords ────────────────────────────────

  it('classifies payment receipt as notification', async () => {
    const result = await classifyEmail(
      'billing@someplatform.com',
      'Ihre Rechnung für März 2026',
      'Vielen Dank für Ihren Einkauf. Ihr Receipt liegt bei.',
    )
    expect(result.emailType).toBe('notification')
    expect(result.needsResponse).toBe(false)
  })

  it('classifies "new purchase" confirmation as notification', async () => {
    const result = await classifyEmail(
      'sales@platform.com',
      'Congratulations! New purchase',
      'A new customer just purchased your product.',
    )
    expect(result.emailType).toBe('notification')
    expect(result.needsResponse).toBe(false)
  })

  // ── form_submission ───────────────────────────────────────────────────────

  it('classifies tally.so form without comment as form_submission with no response needed', async () => {
    const result = await classifyEmail(
      'notification@tally.so',
      'New form submission',
      'Name: Max Muster\nEmail: max@test.ch\nKurs: Hypnose',
    )
    expect(result.emailType).toBe('form_submission')
    expect(result.needsResponse).toBe(false)
  })

  it('classifies form with a real comment as form_submission needing response', async () => {
    const result = await classifyEmail(
      'notification@tally.so',
      'New form submission',
      'Name: Lisa Meier\nEmail: lisa@test.ch\nKommentar:\nIch habe noch eine spezifische Frage zum Kursinhalt.',
    )
    expect(result.emailType).toBe('form_submission')
    expect(result.needsResponse).toBe(true)
  })

  it('classifies typeform from noreply as system_alert (noreply@ pattern)', async () => {
    const result = await classifyEmail(
      'noreply@typeform.com',
      'New typeform response',
      'Anmeldung: Hans Muster hat das Formular ausgefüllt.',
    )
    // noreply@ matches alwaysSystemFrom before form check
    expect(result.emailType).toBe('system_alert')
  })

  // ── customer_inquiry (AI fallback) ───────────────────────────────────────

  it('falls back to customer_inquiry for plain customer emails', async () => {
    const result = await classifyEmail(
      'kunde@gmail.com',
      'Frage zur Hypnose-Ausbildung',
      'Guten Tag, ich würde gerne mehr Informationen zu Ihrer Hypnose-Ausbildung erhalten.',
    )
    expect(result.emailType).toBe('customer_inquiry')
    expect(result.needsResponse).toBe(true)
  })
})
