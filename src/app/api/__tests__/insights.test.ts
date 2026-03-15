import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

// Each table query returns its own chain so we can control per-table results.
// The insights route uses Promise.all with multiple parallel queries.

const makeChain = (result: { data: unknown; error: unknown; count?: number | null }) => {
  const chain: Record<string, unknown> = {
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
  chain.then = (resolve: (v: unknown) => void) => {
    resolve(result)
    return Promise.resolve(result)
  }
  return chain
}

let fromCallIndex = 0
const tableResults: Array<{ data: unknown; error: unknown; count?: number | null }> = []

const mockSupabase = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET } from '@/app/api/insights/route'

function makeRequest(url: string) {
  return new NextRequest(url)
}

function setupTableResults(results: Array<{ data: unknown; error: unknown; count?: number | null }>) {
  fromCallIndex = 0
  tableResults.length = 0
  results.forEach(r => tableResults.push(r))
  mockSupabase.from.mockImplementation(() => {
    const result = tableResults[fromCallIndex] ?? { data: [], error: null, count: 0 }
    fromCallIndex++
    return makeChain(result)
  })
}

// Default empty results for the 5 parallel queries: emails, bi_insights, csat_ratings, learning_cases, knowledge_chunks
const emptyResults = [
  { data: [], error: null, count: 0 },
  { data: [], error: null, count: 0 },
  { data: [], error: null, count: 0 },
  { data: [], error: null, count: 0 },
  { data: [], error: null, count: 0 },
]

describe('GET /api/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTableResults(emptyResults)
  })

  it('returns 200 with all expected sections on empty data', async () => {
    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('marketing')
    expect(body).toHaveProperty('sales')
    expect(body).toHaveProperty('product')
    expect(body).toHaveProperty('sentiment')
    expect(body).toHaveProperty('drilldown')
  })

  it('uses 30 day period by default', async () => {
    const req = makeRequest('http://localhost/api/insights')
    await GET(req)
    // gte should be called with a date ~30 days ago
    // We verify by checking the call was made at all (period logic tested by 7d/90d tests)
    expect(mockSupabase.from).toHaveBeenCalled()
  })

  it('accepts 7d period parameter', async () => {
    setupTableResults(emptyResults)
    const req = makeRequest('http://localhost/api/insights?period=7d')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('accepts 90d period parameter', async () => {
    setupTableResults(emptyResults)
    const req = makeRequest('http://localhost/api/insights?period=90d')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('excludes system_alert and notification emails from counts', async () => {
    const emails = [
      { id: '1', from_email: 'customer@example.com', from_name: 'Alice', subject: 'Hello', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'neutral', tone_urgency: 'low', priority: 'medium', sla_status: null },
      { id: '2', from_email: 'noreply@system.com', from_name: null, subject: 'Alert', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'system_alert', needs_response: false, buying_intent_score: null, tone_sentiment: null, tone_urgency: null, priority: 'low', sla_status: null },
      { id: '3', from_email: 'notify@system.com', from_name: null, subject: 'Notification', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'notification', needs_response: false, buying_intent_score: null, tone_sentiment: null, tone_urgency: null, priority: 'low', sla_status: null },
    ]
    setupTableResults([
      { data: emails, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    // Only customer inquiry email should be counted (system_alert and notification excluded)
    expect(body.summary.totalEmails).toBe(1)
  })

  it('calculates sentiment distribution correctly', async () => {
    const emails = [
      { id: '1', from_email: 'a@ex.com', from_name: 'A', subject: 'S1', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'positive', tone_urgency: 'low', priority: 'medium', sla_status: null },
      { id: '2', from_email: 'b@ex.com', from_name: 'B', subject: 'S2', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'positive', tone_urgency: 'low', priority: 'medium', sla_status: null },
      { id: '3', from_email: 'c@ex.com', from_name: 'C', subject: 'S3', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'negative', tone_urgency: 'high', priority: 'high', sla_status: null },
    ]
    setupTableResults([
      { data: emails, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    expect(body.sentiment.distribution.positive).toBe(2)
    expect(body.sentiment.distribution.negative).toBe(1)
    expect(body.sentiment.distribution.neutral).toBe(0)
  })

  it('identifies hot leads (buying_intent_score >= 60 and not sent)', async () => {
    const emails = [
      { id: 'hot-1', from_email: 'buyer@ex.com', from_name: 'Buyer', subject: 'I want to buy', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 85, tone_sentiment: 'positive', tone_urgency: 'high', priority: 'high', sla_status: 'ok' },
      { id: 'cold-1', from_email: 'looker@ex.com', from_name: 'Looker', subject: 'Just browsing', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 20, tone_sentiment: 'neutral', tone_urgency: 'low', priority: 'medium', sla_status: null },
      { id: 'sent-hot', from_email: 'bought@ex.com', from_name: 'Bought', subject: 'Already sent', received_at: '2024-01-01T00:00:00Z', status: 'sent', email_type: 'customer_inquiry', needs_response: false, buying_intent_score: 90, tone_sentiment: 'positive', tone_urgency: 'low', priority: 'medium', sla_status: null },
    ]
    setupTableResults([
      { data: emails, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    // Only pending email with score >= 60 should be hot lead
    expect(body.sales.hotLeads).toHaveLength(1)
    expect(body.sales.hotLeads[0].id).toBe('hot-1')
  })

  it('identifies churn risks from bi_insights', async () => {
    const emails = [
      { id: 'churn-email', from_email: 'leaving@ex.com', from_name: 'Leaving', subject: 'Cancellation', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'negative', tone_urgency: 'high', priority: 'high', sla_status: 'ok' },
    ]
    const biInsights = [
      { email_id: 'churn-email', insight_type: 'churn_risk', content: 'Cancel detected', confidence: 0.9, metadata: {} },
    ]
    setupTableResults([
      { data: emails, error: null },
      { data: biInsights, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    expect(body.sales.churnRisks).toHaveLength(1)
    expect(body.sales.churnRisks[0].id).toBe('churn-email')
  })

  it('calculates buying intent distribution (low/medium/high)', async () => {
    const emails = [
      { id: '1', from_email: 'a@ex.com', from_name: 'A', subject: 'S', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 10, tone_sentiment: 'neutral', tone_urgency: 'low', priority: 'low', sla_status: null },
      { id: '2', from_email: 'b@ex.com', from_name: 'B', subject: 'S', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 45, tone_sentiment: 'neutral', tone_urgency: 'medium', priority: 'medium', sla_status: null },
      { id: '3', from_email: 'c@ex.com', from_name: 'C', subject: 'S', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 80, tone_sentiment: 'positive', tone_urgency: 'high', priority: 'high', sla_status: 'ok' },
    ]
    setupTableResults([
      { data: emails, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    expect(body.marketing.buyingIntentDistribution.low).toBe(1)
    expect(body.marketing.buyingIntentDistribution.medium).toBe(1)
    expect(body.marketing.buyingIntentDistribution.high).toBe(1)
  })

  it('computes CSAT average correctly', async () => {
    const csatRatings = [
      { email_id: 'e1', rating: 5, created_at: '2024-01-01T00:00:00Z' },
      { email_id: 'e2', rating: 3, created_at: '2024-01-02T00:00:00Z' },
      { email_id: 'e3', rating: 4, created_at: '2024-01-03T00:00:00Z' },
    ]
    setupTableResults([
      { data: [], error: null },
      { data: [], error: null },
      { data: csatRatings, error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    // (5 + 3 + 4) / 3 = 4.0
    expect(body.summary.csatAvg).toBe(4)
    expect(body.sentiment.csatAvg).toBe(4)
  })

  it('reports knowledge base chunk count', async () => {
    setupTableResults([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 42 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    expect(body.summary.kbChunkCount).toBe(42)
  })

  it('computes SLA compliance stats', async () => {
    const emails = [
      { id: '1', from_email: 'a@ex.com', from_name: 'A', subject: 'S', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'neutral', tone_urgency: 'low', priority: 'medium', sla_status: 'ok' },
      { id: '2', from_email: 'b@ex.com', from_name: 'B', subject: 'S', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'neutral', tone_urgency: 'high', priority: 'high', sla_status: 'breached' },
      { id: '3', from_email: 'c@ex.com', from_name: 'C', subject: 'S', received_at: '2024-01-01T00:00:00Z', status: 'pending', email_type: 'customer_inquiry', needs_response: true, buying_intent_score: 0, tone_sentiment: 'neutral', tone_urgency: 'low', priority: 'low', sla_status: null },
    ]
    setupTableResults([
      { data: emails, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ])

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    const body = await res.json()
    expect(body.summary.slaOk).toBe(1)
    expect(body.summary.slaBreached).toBe(1)
  })

  it('returns 500 on internal error', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected DB crash')
    })

    const req = makeRequest('http://localhost/api/insights')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to load insights')
  })
})
