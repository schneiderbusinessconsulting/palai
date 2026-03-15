import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET, POST, PATCH } from '@/app/api/deals/route'

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

describe('GET /api/deals', () => {
  beforeEach(resetMocks)

  it('returns deals list', async () => {
    const deals = [{ id: '1', name: 'Deal 1', stage: 'open', amount: 1000 }]
    setupChainResult(deals)

    const req = new NextRequest('http://localhost/api/deals')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deals).toEqual(deals)
  })

  it('filters by stage', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/deals?stage=won')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('stage', 'won')
  })

  it('does not filter when stage is all', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/deals?stage=all')
    await GET(req)
    expect(mockChain.eq).not.toHaveBeenCalled()
  })

  it('returns 500 on error', async () => {
    setupChainResult(null, { message: 'DB error' })

    const req = new NextRequest('http://localhost/api/deals')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/deals', () => {
  beforeEach(resetMocks)

  it('creates a new deal', async () => {
    const deal = { id: '1', title: 'New Deal', stage: 'lead' }
    setupChainResult(deal)

    const req = new NextRequest('http://localhost/api/deals', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Deal', stage: 'lead' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deal).toEqual(deal)
  })

  it('returns 400 when title is missing', async () => {
    const req = new NextRequest('http://localhost/api/deals', {
      method: 'POST',
      body: JSON.stringify({ stage: 'lead' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert error', async () => {
    setupChainResult(null, { message: 'Insert failed' })

    const req = new NextRequest('http://localhost/api/deals', {
      method: 'POST',
      body: JSON.stringify({ title: 'Deal' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/deals', () => {
  beforeEach(resetMocks)

  it('updates a deal', async () => {
    const deal = { id: '1', name: 'Updated', stage: 'won' }
    setupChainResult(deal)

    const req = new NextRequest('http://localhost/api/deals', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', stage: 'won' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deal).toEqual(deal)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/deals', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'won' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
