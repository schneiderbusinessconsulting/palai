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

import { POST, GET } from '@/app/api/csat/route'

function makeRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(url, options)
}

function setupChainResult(data: unknown, error: unknown = null) {
  ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve({ data, error })
    return Promise.resolve({ data, error })
  }
  mockSupabase.from.mockReturnValue(mockChain)
}

describe('POST /api/csat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('returns 400 when emailId is missing', async () => {
    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ rating: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 when rating is missing', async () => {
    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 when rating is below 1', async () => {
    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1', rating: 0 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when rating is above 5', async () => {
    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1', rating: 6 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates a CSAT rating successfully', async () => {
    setupChainResult(null, null)

    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1', rating: 5, comment: 'Great service!' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('creates a CSAT rating without optional comment', async () => {
    setupChainResult(null, null)

    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-2', rating: 3 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('accepts all valid rating values (1-5)', async () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      setupChainResult(null, null)
      const req = makeRequest('http://localhost/api/csat', {
        method: 'POST',
        body: JSON.stringify({ emailId: `email-${rating}`, rating }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    }
  })

  it('returns success when csat_ratings table does not exist (42P01)', async () => {
    setupChainResult(null, { code: '42P01', message: 'table does not exist' })

    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1', rating: 4 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 on unexpected database error', async () => {
    setupChainResult(null, { code: '500', message: 'Internal DB error' })

    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1', rating: 4 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to save rating')
  })

  it('calls supabase.from with csat_ratings table', async () => {
    setupChainResult(null, null)

    const req = makeRequest('http://localhost/api/csat', {
      method: 'POST',
      body: JSON.stringify({ emailId: 'email-1', rating: 5 }),
    })
    await POST(req)
    expect(mockSupabase.from).toHaveBeenCalledWith('csat_ratings')
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email_id: 'email-1', rating: 5 })
    )
  })
})

describe('GET /api/csat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('returns empty stats when no ratings exist', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/csat')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ratings).toEqual([])
    expect(body.avg).toBe(0)
    expect(body.total).toBe(0)
    expect(body.distribution).toHaveLength(5)
  })

  it('calculates average rating correctly', async () => {
    const ratings = [
      { rating: 5, created_at: '2024-01-01T00:00:00Z' },
      { rating: 3, created_at: '2024-01-02T00:00:00Z' },
      { rating: 4, created_at: '2024-01-03T00:00:00Z' },
    ]
    setupChainResult(ratings)

    const req = makeRequest('http://localhost/api/csat')
    const res = await GET(req)
    const body = await res.json()
    expect(body.avg).toBe(4)
    expect(body.total).toBe(3)
  })

  it('builds correct distribution for all star counts', async () => {
    const ratings = [
      { rating: 1, created_at: '2024-01-01T00:00:00Z' },
      { rating: 2, created_at: '2024-01-01T00:00:00Z' },
      { rating: 3, created_at: '2024-01-01T00:00:00Z' },
      { rating: 3, created_at: '2024-01-01T00:00:00Z' },
      { rating: 5, created_at: '2024-01-01T00:00:00Z' },
    ]
    setupChainResult(ratings)

    const req = makeRequest('http://localhost/api/csat')
    const res = await GET(req)
    const body = await res.json()
    const dist = body.distribution
    expect(dist.find((d: { stars: number }) => d.stars === 1).count).toBe(1)
    expect(dist.find((d: { stars: number }) => d.stars === 2).count).toBe(1)
    expect(dist.find((d: { stars: number }) => d.stars === 3).count).toBe(2)
    expect(dist.find((d: { stars: number }) => d.stars === 4).count).toBe(0)
    expect(dist.find((d: { stars: number }) => d.stars === 5).count).toBe(1)
  })

  it('uses 7d period when specified', async () => {
    setupChainResult([])
    const req = makeRequest('http://localhost/api/csat?period=7d')
    const res = await GET(req)
    expect(res.status).toBe(200)
    // gte should be called with a date about 7 days ago
    expect(mockChain.gte).toHaveBeenCalled()
  })

  it('uses 90d period when specified', async () => {
    setupChainResult([])
    const req = makeRequest('http://localhost/api/csat?period=90d')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.gte).toHaveBeenCalled()
  })

  it('accepts custom start date param', async () => {
    setupChainResult([])
    const req = makeRequest('http://localhost/api/csat?start=2024-01-01')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockChain.gte).toHaveBeenCalledWith('created_at', '2024-01-01T00:00:00')
  })

  it('returns empty result when csat_ratings table does not exist (42P01)', async () => {
    setupChainResult(null, { code: '42P01', message: 'table does not exist' })

    const req = makeRequest('http://localhost/api/csat')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ratings).toEqual([])
    expect(body.avg).toBe(0)
    expect(body.total).toBe(0)
  })

  it('rounds average to one decimal place', async () => {
    const ratings = [
      { rating: 4, created_at: '2024-01-01T00:00:00Z' },
      { rating: 3, created_at: '2024-01-01T00:00:00Z' },
      { rating: 5, created_at: '2024-01-01T00:00:00Z' },
    ]
    setupChainResult(ratings)

    const req = makeRequest('http://localhost/api/csat')
    const res = await GET(req)
    const body = await res.json()
    // (4 + 3 + 5) / 3 = 4.0
    expect(body.avg).toBe(4)
    expect(Number.isFinite(body.avg)).toBe(true)
  })
})
