import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('HUBSPOT_ACCESS_TOKEN', 'test-hubspot-token')
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')

// Create mock supabase instance
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
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/ai/openai', () => ({
  createEmbedding: vi.fn(() => Promise.resolve(new Array(1536).fill(0))),
  generateEmailDraft: vi.fn(() =>
    Promise.resolve({ response: 'Draft response', confidence: 0.9, detectedFormality: 'formal' })
  ),
  classifyEmail: vi.fn(() =>
    Promise.resolve({ emailType: 'customer_inquiry', needsResponse: true, reason: 'test' })
  ),
}))

vi.mock('@/lib/text-utils', () => ({
  analyzeTone: vi.fn(() => ({ formality: 'formal', sentiment: 'positive', urgency: 'medium' })),
  determinePriority: vi.fn(() => 'medium'),
  calculateHappinessScore: vi.fn(() => 3),
  detectSpam: vi.fn(() => ({ isSpam: false, spamScore: 0 })),
  detectTopicTags: vi.fn(() => []),
}))

// Mock global fetch for HubSpot calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import route handlers after mocks are set up
import { GET, POST, PATCH } from '@/app/api/emails/route'

function makeRequest(url: string, options: RequestInit & { method?: string; body?: string } = {}) {
  return new NextRequest(url, options as never)
}

describe('GET /api/emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(mockChain)
    // Reset chain methods to return this
    Object.keys(mockChain).forEach((key) => {
      if (typeof (mockChain as Record<string, unknown>)[key] === 'function') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('returns 503 when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const req = makeRequest('http://localhost/api/emails')
    const res = await GET(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('Supabase')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  })

  it('returns emails with default parameters', async () => {
    const mockEmails = [
      { id: '1', subject: 'Test email', from_email: 'test@example.com', received_at: '2024-01-01T00:00:00Z', status: 'pending' },
    ]
    // Make the chain resolve with data
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: mockEmails, error: null, count: 1 })
      return Promise.resolve({ data: mockEmails, error: null, count: 1 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('emails')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('hasMore')
  })

  it('filters by status when provided', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: [], error: null, count: 0 })
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?status=pending')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('does not filter when status is "all"', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: [], error: null, count: 0 })
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?status=all')
    const res = await GET(req)
    expect(res.status).toBe(200)
    // eq('status', ...) should NOT be called when status=all
    const statusCalls = mockChain.eq.mock.calls.filter((call: unknown[]) => call[0] === 'status')
    expect(statusCalls).toHaveLength(0)
  })

  it('filters by assigned_agent_id', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: [], error: null, count: 0 })
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?assigned_agent_id=agent-123')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.eq).toHaveBeenCalledWith('assigned_agent_id', 'agent-123')
  })

  it('filters unassigned when assigned_agent_id is "unassigned"', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: [], error: null, count: 0 })
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?assigned_agent_id=unassigned')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.is).toHaveBeenCalledWith('assigned_agent_id', null)
  })

  it('returns 500 when database query fails', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: { message: 'DB error', code: '500', details: 'detail' }, count: 0 })
      return Promise.resolve({ data: null, error: { message: 'DB error', code: '500', details: 'detail' }, count: 0 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch emails')
  })

  it('groups emails by thread when group_by_thread=true', async () => {
    const mockEmails = [
      { id: '1', subject: 'Thread email 1', from_email: 'a@example.com', received_at: '2024-01-02T00:00:00Z', status: 'pending', hubspot_thread_id: 'thread-1', from_name: 'Alice' },
      { id: '2', subject: 'Thread email 2', from_email: 'a@example.com', received_at: '2024-01-01T00:00:00Z', status: 'pending', hubspot_thread_id: 'thread-1', from_name: 'Alice' },
      { id: '3', subject: 'No thread', from_email: 'b@example.com', received_at: '2024-01-03T00:00:00Z', status: 'pending', hubspot_thread_id: null, from_name: 'Bob' },
    ]
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: mockEmails, error: null, count: 3 })
      return Promise.resolve({ data: mockEmails, error: null, count: 3 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?group_by_thread=true')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('threads')
    expect(Array.isArray(body.threads)).toBe(true)
  })

  it('applies pagination with limit and offset', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: [], error: null, count: 100 })
      return Promise.resolve({ data: [], error: null, count: 100 })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?limit=10&offset=20')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.range).toHaveBeenCalledWith(20, 29)
  })
})

describe('POST /api/emails (HubSpot import)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(mockChain)
    Object.keys(mockChain).forEach((key) => {
      if (typeof (mockChain as Record<string, unknown>)[key] === 'function') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('returns 503 when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const req = makeRequest('http://localhost/api/emails', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(503)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  })

  it('returns 503 when HubSpot token is not configured', async () => {
    vi.stubEnv('HUBSPOT_ACCESS_TOKEN', '')
    const req = makeRequest('http://localhost/api/emails', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('HubSpot')
    vi.stubEnv('HUBSPOT_ACCESS_TOKEN', 'test-hubspot-token')
  })

  it('returns 500 when HubSpot API call fails', async () => {
    // Mock HubSpot API to return error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('HubSpot error'),
    })

    // sla_targets and support_agents queries
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: [], error: null })
      return Promise.resolve({ data: [], error: null })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to search HubSpot emails')
  })

  it('imports emails from HubSpot successfully', async () => {
    const hubspotResults = {
      results: [
        {
          id: 'hs-1',
          properties: {
            hs_email_direction: 'INCOMING_EMAIL',
            hs_email_subject: 'Test Subject',
            hs_email_text: 'Test body',
            hs_email_from_email: 'customer@example.com',
            hs_email_from_firstname: 'John',
            hs_email_from_lastname: 'Doe',
            hs_timestamp: String(Date.now()),
            hs_email_thread_id: 'thread-abc',
          },
        },
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(hubspotResults),
    })

    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      const chain = {
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
        then: (resolve: (v: unknown) => void) => {
          // Return not-existing for duplicate check, empty for others
          resolve({ data: null, error: null })
          return Promise.resolve({ data: null, error: null })
        },
      }
      return chain
    })

    const req = makeRequest('http://localhost/api/emails', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('imported')
    expect(body).toHaveProperty('skipped')
    expect(body).toHaveProperty('total')
  })

  it('skips already existing emails', async () => {
    const hubspotResults = {
      results: [
        {
          id: 'hs-existing',
          properties: {
            hs_email_direction: 'INCOMING_EMAIL',
            hs_email_subject: 'Existing',
            hs_email_text: 'body',
            hs_email_from_email: 'existing@example.com',
            hs_timestamp: String(Date.now()),
          },
        },
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(hubspotResults),
    })

    mockSupabase.from.mockImplementation(() => {
      return {
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
        then: (resolve: (v: unknown) => void) => {
          // Return existing email for duplicate check
          resolve({ data: { id: 'existing-db-id' }, error: null })
          return Promise.resolve({ data: { id: 'existing-db-id' }, error: null })
        },
      }
    })

    const req = makeRequest('http://localhost/api/emails', { method: 'POST' })
    const res = await POST(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.skipped).toBe(1)
    expect(body.imported).toBe(0)
  })
})

describe('PATCH /api/emails (reclassify)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(mockChain)
    Object.keys(mockChain).forEach((key) => {
      if (typeof (mockChain as Record<string, unknown>)[key] === 'function') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('runs default classify action on unanalyzed emails', async () => {
    const unanalyzedEmails = [
      { id: 'email-1', from_email: 'user@example.com', subject: 'Help needed', body_text: 'I need help', email_type: null, tone_sentiment: null, buying_intent_score: null },
    ]

    let fromCallIndex = 0
    mockSupabase.from.mockImplementation(() => {
      fromCallIndex++
      return {
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
        then: (resolve: (v: unknown) => void) => {
          if (fromCallIndex <= 2) {
            // sla_targets and incoming_emails
            resolve({ data: unanalyzedEmails, error: null })
            return Promise.resolve({ data: unanalyzedEmails, error: null })
          }
          resolve({ data: [], error: null })
          return Promise.resolve({ data: [], error: null })
        },
      }
    })

    const req = makeRequest('http://localhost/api/emails', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('classified')
    expect(body).toHaveProperty('toneAnalyzed')
  })

  it('handles sync-status action', async () => {
    const pendingEmails = [
      { id: 'email-1', hubspot_thread_id: 'thread-1' },
      { id: 'email-2', hubspot_thread_id: 'thread-1' },
    ]

    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: pendingEmails, error: null })
      return Promise.resolve({ data: pendingEmails, error: null })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    // Mock HubSpot thread status response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'OPEN' }),
    })

    const req = makeRequest('http://localhost/api/emails?action=sync-status', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('checkedThreads')
    expect(body).toHaveProperty('closedEmails')
  })

  it('marks emails as closed when HubSpot thread is CLOSED', async () => {
    const pendingEmails = [
      { id: 'email-1', hubspot_thread_id: 'thread-closed' },
    ]

    let callIdx = 0
    mockSupabase.from.mockImplementation(() => {
      callIdx++
      return {
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
        then: (resolve: (v: unknown) => void) => {
          if (callIdx === 1) {
            resolve({ data: pendingEmails, error: null })
            return Promise.resolve({ data: pendingEmails, error: null })
          }
          resolve({ data: [{ id: 'email-1' }], error: null })
          return Promise.resolve({ data: [{ id: 'email-1' }], error: null })
        },
      }
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'CLOSED' }),
    })

    const req = makeRequest('http://localhost/api/emails?action=sync-status', { method: 'PATCH' })
    const res = await PATCH(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.closedEmails).toBeGreaterThan(0)
  })

  it('returns 500 when fetch of pending emails fails', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: { message: 'DB error' } })
      return Promise.resolve({ data: null, error: { message: 'DB error' } })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = makeRequest('http://localhost/api/emails?action=sync-status', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
  })
})
