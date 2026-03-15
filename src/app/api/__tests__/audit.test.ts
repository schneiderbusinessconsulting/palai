import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET } from '@/app/api/audit/route'

function setupChainResult(data: unknown, error: unknown = null, count: number | null = null) {
  ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve({ data, error, count })
    return Promise.resolve({ data, error, count })
  }
  mockSupabase.from.mockReturnValue(mockChain)
}

function resetMocks() {
  vi.clearAllMocks()
  Object.keys(mockChain).forEach((key) => {
    if (key !== 'then') {
      ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
    }
  })
  mockSupabase.from.mockReturnValue(mockChain)
}

describe('GET /api/audit', () => {
  beforeEach(resetMocks)

  it('returns audit log entries with pagination', async () => {
    const entries = [
      { id: '1', action: 'email_sent', created_at: '2024-01-01T00:00:00Z' },
    ]
    setupChainResult(entries, null, 1)

    const req = new NextRequest('http://localhost/api/audit')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toEqual(entries)
    expect(body.total).toBe(1)
    expect(body.hasMore).toBe(false)
  })

  it('calculates hasMore correctly', async () => {
    setupChainResult([], null, 100)

    const req = new NextRequest('http://localhost/api/audit?limit=50&offset=0')
    const res = await GET(req)
    const body = await res.json()
    expect(body.hasMore).toBe(true)
  })

  it('filters by action', async () => {
    setupChainResult([], null, 0)

    const req = new NextRequest('http://localhost/api/audit?action=email_sent')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('action', 'email_sent')
  })

  it('filters by date range', async () => {
    setupChainResult([], null, 0)

    const req = new NextRequest('http://localhost/api/audit?start_date=2024-01-01&end_date=2024-01-31')
    await GET(req)
    expect(mockChain.gte).toHaveBeenCalledWith('created_at', '2024-01-01')
    expect(mockChain.lte).toHaveBeenCalledWith('created_at', '2024-01-31')
  })

  it('returns empty on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/audit')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toEqual([])
    expect(body.total).toBe(0)
    expect(body.tableExists).toBe(false)
  })

  it('returns 500 on other error', async () => {
    setupChainResult(null, { code: 'XXXXX', message: 'Error' })

    const req = new NextRequest('http://localhost/api/audit')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('respects custom limit and offset', async () => {
    setupChainResult([], null, 0)

    const req = new NextRequest('http://localhost/api/audit?limit=10&offset=20')
    await GET(req)
    expect(mockChain.range).toHaveBeenCalledWith(20, 29)
  })
})
