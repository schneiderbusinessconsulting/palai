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
  limit: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET, POST, PATCH, DELETE } from '@/app/api/templates/route'

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

describe('GET /api/templates', () => {
  beforeEach(resetMocks)

  it('returns templates list', async () => {
    const templates = [
      { id: '1', title: 'Welcome', content: 'Hello {{name}}', category: 'Allgemein' },
    ]
    setupChainResult(templates)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toEqual(templates)
  })

  it('returns empty list on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toEqual([])
  })

  it('returns 500 on other database error', async () => {
    setupChainResult(null, { code: 'XXXXX', message: 'Error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/templates', () => {
  beforeEach(resetMocks)

  it('creates template with title and content', async () => {
    const template = { id: '1', title: 'New', content: 'Hello', category: 'Allgemein' }
    setupChainResult(template)

    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ title: 'New', content: 'Hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.template).toEqual(template)
  })

  it('returns 400 when title is missing', async () => {
    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when content is missing', async () => {
    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty strings', async () => {
    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ title: '   ', content: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/templates', () => {
  beforeEach(resetMocks)

  it('updates template', async () => {
    const updated = { id: '1', title: 'Updated', content: 'New content' }
    setupChainResult(updated)

    const req = new NextRequest('http://localhost/api/templates', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', title: 'Updated', content: 'New content' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.template).toEqual(updated)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/templates', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/templates', () => {
  beforeEach(resetMocks)

  it('deletes template by id', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/templates', {
      method: 'DELETE',
      body: JSON.stringify({ id: '1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/templates', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
