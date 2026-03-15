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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/ai/openai', () => ({
  createEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
}))

import { GET, POST, PATCH, DELETE } from '@/app/api/courses/route'

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

describe('GET /api/courses', () => {
  beforeEach(resetMocks)

  it('returns courses list', async () => {
    const courses = [
      { id: '1', name: 'Hypnose Ausbildung', price: 4500, status: 'active' },
    ]
    setupChainResult(courses)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courses).toEqual(courses)
  })

  it('returns 500 on error', async () => {
    setupChainResult(null, { message: 'Error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/courses', () => {
  beforeEach(resetMocks)

  it('creates a new course', async () => {
    const course = { id: '1', name: 'New Course', status: 'active', learning_goals: [] }
    setupChainResult(course)

    const req = new NextRequest('http://localhost/api/courses', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Course' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.course).toEqual(course)
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/courses', {
      method: 'POST',
      body: JSON.stringify({ description: 'No name' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty name', async () => {
    const req = new NextRequest('http://localhost/api/courses', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert error', async () => {
    setupChainResult(null, { message: 'Insert failed', code: 'XXXXX' })

    const req = new NextRequest('http://localhost/api/courses', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Course' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/courses', () => {
  beforeEach(resetMocks)

  it('updates a course', async () => {
    const course = { id: '1', name: 'Updated', price: 5000 }
    setupChainResult(course)

    const req = new NextRequest('http://localhost/api/courses', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', name: 'Updated', price: 5000 }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.course).toEqual(course)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/courses', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/courses', () => {
  beforeEach(resetMocks)

  it('deletes a course and its knowledge chunks', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/courses?id=1', {
      method: 'DELETE',
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/courses', {
      method: 'DELETE',
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
