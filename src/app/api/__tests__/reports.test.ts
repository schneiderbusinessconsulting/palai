import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET } from '@/app/api/reports/export/route'

function setupChainResult(data: unknown, error: unknown = null) {
  ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve({ data, error })
    return Promise.resolve({ data, error })
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

describe('GET /api/reports/export', () => {
  beforeEach(resetMocks)

  it('exports emails as CSV', async () => {
    const emails = [
      { id: '1', from_email: 'test@test.com', subject: 'Test', status: 'pending', received_at: '2024-01-01' },
    ]
    setupChainResult(emails)

    const req = new NextRequest('http://localhost/api/reports/export?type=emails&format=csv')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('id;from_email;subject')
    expect(text).toContain('test@test.com')
    expect(res.headers.get('Content-Type')).toContain('text/csv')
  })

  it('exports emails as JSON', async () => {
    const emails = [
      { id: '1', from_email: 'test@test.com', subject: 'Test', status: 'pending' },
    ]
    setupChainResult(emails)

    const req = new NextRequest('http://localhost/api/reports/export?type=emails&format=json')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = JSON.parse(await res.text())
    expect(data).toHaveLength(1)
    expect(res.headers.get('Content-Disposition')).toContain('.json')
  })

  it('returns text message when no data to export', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/reports/export?type=emails&format=csv')
    const res = await GET(req)
    const text = await res.text()
    expect(text).toContain('Keine Daten')
  })

  it('filters by date range', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/reports/export?type=emails&start_date=2024-01-01&end_date=2024-12-31')
    await GET(req)
    expect(mockChain.gte).toHaveBeenCalledWith('received_at', '2024-01-01')
    expect(mockChain.lte).toHaveBeenCalledWith('received_at', '2024-12-31')
  })

  it('handles CSV special characters (semicolons, quotes)', async () => {
    const emails = [
      { id: '1', from_email: 'test@test.com', subject: 'Test; with "special" chars' },
    ]
    setupChainResult(emails)

    const req = new NextRequest('http://localhost/api/reports/export?type=emails&format=csv')
    const res = await GET(req)
    const text = await res.text()
    // Should be quoted and escaped
    expect(text).toContain('"Test; with ""special"" chars"')
  })

  it('returns 500 on database error', async () => {
    setupChainResult(null, { message: 'DB error' })

    const req = new NextRequest('http://localhost/api/reports/export?type=emails')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
