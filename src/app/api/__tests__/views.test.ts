import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET, POST, DELETE } from '@/app/api/views/route'

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

describe('GET /api/views', () => {
  beforeEach(resetMocks)

  it('returns saved views', async () => {
    const views = [{ id: '1', name: 'My View', filters: { status: 'pending' } }]
    setupChainResult(views)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.views).toEqual(views)
  })

  it('returns empty on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.views).toEqual([])
  })
})

describe('POST /api/views', () => {
  beforeEach(resetMocks)

  it('creates a new view', async () => {
    const view = { id: '1', name: 'New View', filters: { status: 'pending' } }
    setupChainResult(view)

    const req = new NextRequest('http://localhost/api/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'New View', filters: { status: 'pending' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.view).toEqual(view)
  })

  it('returns 501 on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', filters: {} }),
    })
    const res = await POST(req)
    expect(res.status).toBe(501)
  })
})

describe('DELETE /api/views', () => {
  beforeEach(resetMocks)

  it('deletes a view', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/views', {
      method: 'DELETE',
      body: JSON.stringify({ view_id: '1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns success even on table not found (graceful)', async () => {
    setupChainResult(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/views', {
      method: 'DELETE',
      body: JSON.stringify({ view_id: '1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
  })
})
