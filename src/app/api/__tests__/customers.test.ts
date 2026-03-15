import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET } from '@/app/api/customers/route'

function makeRequest(url: string) {
  return new NextRequest(url)
}

function setupChainResult(data: unknown, error: unknown = null) {
  ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve({ data, error })
    return Promise.resolve({ data, error })
  }
  mockSupabase.from.mockReturnValue(mockChain)
}

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chain methods
    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('returns empty customers array when no emails exist', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/customers')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.customers).toEqual([])
  })

  it('returns aggregated customer data', async () => {
    const emails = [
      {
        id: '1',
        from_email: 'customer@example.com',
        from_name: 'Jane Doe',
        subject: 'Question about course',
        received_at: '2024-01-02T00:00:00Z',
        status: 'pending',
        tone_sentiment: 'positive',
        buying_intent_score: 75,
        priority: 'high',
      },
      {
        id: '2',
        from_email: 'customer@example.com',
        from_name: 'Jane Doe',
        subject: 'Follow up',
        received_at: '2024-01-01T00:00:00Z',
        status: 'sent',
        tone_sentiment: 'neutral',
        buying_intent_score: 30,
        priority: 'medium',
      },
    ]
    setupChainResult(emails)

    const req = makeRequest('http://localhost/api/customers')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.customers).toHaveLength(1)

    const customer = body.customers[0]
    expect(customer.email).toBe('customer@example.com')
    expect(customer.name).toBe('Jane Doe')
    expect(customer.totalEmails).toBe(2)
    expect(customer.resolvedCount).toBe(1)
    expect(customer.avgBuyingIntent).toBe(53) // Math.round((75+30)/2)
    expect(customer.dominantSentiment).toBe('positive')
    expect(customer.lastContact).toBe('2024-01-02T00:00:00Z')
  })

  it('aggregates multiple customers separately', async () => {
    const emails = [
      {
        id: '1',
        from_email: 'alice@example.com',
        from_name: 'Alice',
        subject: 'Question 1',
        received_at: '2024-01-02T00:00:00Z',
        status: 'pending',
        tone_sentiment: 'positive',
        buying_intent_score: 80,
        priority: 'high',
      },
      {
        id: '2',
        from_email: 'bob@example.com',
        from_name: 'Bob',
        subject: 'Question 2',
        received_at: '2024-01-03T00:00:00Z',
        status: 'sent',
        tone_sentiment: 'negative',
        buying_intent_score: 10,
        priority: 'low',
      },
    ]
    setupChainResult(emails)

    const req = makeRequest('http://localhost/api/customers')
    const res = await GET(req)
    const body = await res.json()
    expect(body.customers).toHaveLength(2)
    // Should be sorted by lastContact descending
    expect(body.customers[0].email).toBe('bob@example.com')
    expect(body.customers[1].email).toBe('alice@example.com')
  })

  it('passes search param as OR filter', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/customers?search=alice')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.or).toHaveBeenCalledWith(
      'from_email.ilike.%alice%,from_name.ilike.%alice%'
    )
  })

  it('respects limit parameter', async () => {
    const manyEmails = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      from_email: `customer${i}@example.com`,
      from_name: `Customer ${i}`,
      subject: 'Test',
      received_at: new Date(Date.now() - i * 1000).toISOString(),
      status: 'pending',
      tone_sentiment: 'neutral',
      buying_intent_score: 0,
      priority: 'medium',
    }))
    setupChainResult(manyEmails)

    const req = makeRequest('http://localhost/api/customers?limit=5')
    const res = await GET(req)
    const body = await res.json()
    expect(body.customers.length).toBeLessThanOrEqual(5)
  })

  it('returns 500 on database error', async () => {
    setupChainResult(null, { message: 'Database connection failed' })

    const req = makeRequest('http://localhost/api/customers')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Database connection failed')
  })

  it('excludes own company emails (filtering is applied via .not in query)', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/customers')
    await GET(req)
    // The query should exclude own emails via .not('from_email', 'in', ...)
    expect(mockChain.not).toHaveBeenCalledWith(
      'from_email',
      'in',
      expect.stringContaining('palacios-relations.ch')
    )
  })

  it('filters by customer_inquiry and form_submission email types', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/customers')
    await GET(req)
    expect(mockChain.in).toHaveBeenCalledWith(
      'email_type',
      ['customer_inquiry', 'form_submission']
    )
  })

  it('uses last received_at as lastContact for customer', async () => {
    const emails = [
      {
        id: '1',
        from_email: 'user@example.com',
        from_name: 'User',
        subject: 'Old email',
        received_at: '2024-01-01T00:00:00Z',
        status: 'sent',
        tone_sentiment: 'neutral',
        buying_intent_score: 0,
        priority: 'medium',
      },
      {
        id: '2',
        from_email: 'user@example.com',
        from_name: 'User',
        subject: 'New email',
        received_at: '2024-03-01T00:00:00Z',
        status: 'pending',
        tone_sentiment: 'positive',
        buying_intent_score: 50,
        priority: 'high',
      },
    ]
    setupChainResult(emails)

    const req = makeRequest('http://localhost/api/customers')
    const res = await GET(req)
    const body = await res.json()
    expect(body.customers[0].lastContact).toBe('2024-03-01T00:00:00Z')
  })

  it('handles emails with no sentiment gracefully', async () => {
    const emails = [
      {
        id: '1',
        from_email: 'nosent@example.com',
        from_name: null,
        subject: 'No sentiment',
        received_at: '2024-01-01T00:00:00Z',
        status: 'pending',
        tone_sentiment: null,
        buying_intent_score: null,
        priority: 'medium',
      },
    ]
    setupChainResult(emails)

    const req = makeRequest('http://localhost/api/customers')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.customers[0].dominantSentiment).toBe('neutral')
    expect(body.customers[0].avgBuyingIntent).toBe(0)
    // name falls back to email when from_name is null
    expect(body.customers[0].name).toBe('nosent@example.com')
  })
})
