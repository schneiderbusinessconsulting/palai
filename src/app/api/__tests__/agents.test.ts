import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

import { GET, POST, PATCH } from '@/app/api/agents/route'

function setupChainResult(data: unknown, error: unknown = null) {
  ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve({ data, error })
    return Promise.resolve({ data, error })
  }
  mockSupabase.from.mockReturnValue(mockChain)
}

describe('GET /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('returns list of active agents', async () => {
    const agents = [
      { id: '1', name: 'Agent A', email: 'a@test.com', role: 'L1', specializations: [], is_active: true, max_open_tickets: 20 },
    ]
    setupChainResult(agents)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agents).toEqual(agents)
  })

  it('returns empty agents on table not found (42P01)', async () => {
    setupChainResult(null, { code: '42P01' })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agents).toEqual([])
  })

  it('returns 500 on other database error', async () => {
    setupChainResult(null, { code: 'XXXXX', message: 'Unexpected error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('creates agent with required fields', async () => {
    const newAgent = { id: '1', name: 'Test Agent', email: 'test@test.com', role: 'L1' }
    setupChainResult(newAgent)

    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Agent', email: 'test@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent).toEqual(newAgent)
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert error', async () => {
    setupChainResult(null, { message: 'Insert failed' })

    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', email: 'test@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    mockSupabase.from.mockReturnValue(mockChain)
  })

  it('updates agent fields', async () => {
    const updated = { id: '1', name: 'Updated Agent', role: 'L2' }
    setupChainResult(updated)

    const req = new NextRequest('http://localhost/api/agents', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', name: 'Updated Agent', role: 'L2' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent).toEqual(updated)
  })

  it('returns 500 on update error', async () => {
    setupChainResult(null, { message: 'Update failed' })

    const req = new NextRequest('http://localhost/api/agents', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', name: 'Test' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
  })
})
