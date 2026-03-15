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
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET, POST, PATCH, DELETE } from '@/app/api/automation/route'

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

describe('GET /api/automation', () => {
  beforeEach(resetMocks)

  it('returns automation rules', async () => {
    const rules = [{ id: '1', name: 'Auto-assign', trigger: 'new_email', is_active: true }]
    setupChainResult(rules)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rules).toEqual(rules)
  })

  it('returns empty on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rules).toEqual([])
    expect(body.tableExists).toBe(false)
  })

  it('returns 500 on other error', async () => {
    setupChainResult(null, { code: 'XXXXX', message: 'Error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/automation', () => {
  beforeEach(resetMocks)

  it('creates a new automation rule', async () => {
    const rule = { id: '1', name: 'New Rule', trigger: 'new_email' }
    setupChainResult(rule)

    const req = new NextRequest('http://localhost/api/automation', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Rule', trigger: 'new_email' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rule).toEqual(rule)
  })

  it('returns 400 on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/automation', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', trigger: 'new_email' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/automation', () => {
  beforeEach(resetMocks)

  it('updates an automation rule', async () => {
    const rule = { id: '1', name: 'Updated', is_active: false }
    setupChainResult(rule)

    const req = new NextRequest('http://localhost/api/automation', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', name: 'Updated', is_active: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/automation', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/automation', () => {
  beforeEach(resetMocks)

  it('deletes an automation rule', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/automation?id=1', {
      method: 'DELETE',
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/automation', {
      method: 'DELETE',
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
