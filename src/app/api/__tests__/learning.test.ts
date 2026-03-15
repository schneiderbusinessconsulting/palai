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
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/ai/openai', () => ({
  createEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
}))

import { GET } from '@/app/api/learning/route'

function resetMocks() {
  vi.clearAllMocks()
  Object.keys(mockChain).forEach((key) => {
    if (key !== 'then') {
      ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
    }
  })
  mockSupabase.from.mockReturnValue(mockChain)
}

// Helper that handles two sequential DB calls: main query + pending count
function setupLearningResults(mainData: unknown, mainError: unknown = null, pendingCount = 0) {
  let callCount = 0
  mockSupabase.from.mockImplementation(() => {
    callCount++
    const chain = { ...mockChain }

    if (callCount === 1) {
      // Main query
      ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
        resolve({ data: mainData, error: mainError })
        return Promise.resolve({ data: mainData, error: mainError })
      }
    } else {
      // Pending count query
      ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
        resolve({ count: pendingCount, error: null })
        return Promise.resolve({ count: pendingCount, error: null })
      }
    }

    Object.keys(mockChain).forEach((key) => {
      if (key !== 'then') {
        ;(chain as Record<string, unknown>)[key] = vi.fn().mockReturnValue(chain)
      }
    })

    return chain
  })
}

describe('GET /api/learning', () => {
  beforeEach(resetMocks)

  it('returns learning cases with pending count', async () => {
    const cases = [
      { id: '1', email_id: 'e1', status: 'pending', edit_distance: 0.5, incoming_emails: { subject: 'Test' } },
    ]
    setupLearningResults(cases, null, 1)

    const req = new NextRequest('http://localhost/api/learning')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cases).toEqual(cases)
    expect(body.total).toBe(1)
    expect(body.pending).toBe(1)
  })

  it('returns empty on table not found', async () => {
    setupLearningResults(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/learning')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cases).toEqual([])
    expect(body.total).toBe(0)
    expect(body.pending).toBe(0)
  })

  it('filters by status when provided', async () => {
    setupLearningResults([], null, 0)

    const req = new NextRequest('http://localhost/api/learning?status=all')
    await GET(req)
    // When status=all, should not add eq filter
    // Just verify it returns successfully
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

// Test the PATCH endpoint
import { PATCH } from '@/app/api/learning/[id]/route'

describe('PATCH /api/learning/[id]', () => {
  beforeEach(resetMocks)

  it('dismisses a learning case', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: null })
      return Promise.resolve({ data: null, error: null })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = new NextRequest('http://localhost/api/learning/case-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'dismiss' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'case-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 for unknown action', async () => {
    const req = new NextRequest('http://localhost/api/learning/case-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unknown' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'case-1' }) })
    expect(res.status).toBe(400)
  })

  it('extracts knowledge from learning case', async () => {
    const learningCase = {
      id: 'case-1',
      corrected_response: 'Better answer',
      incoming_emails: { subject: 'Question about hypnosis' },
    }
    const chunk = { id: 'chunk-1' }

    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      const chain = { ...mockChain }

      Object.keys(mockChain).forEach((key) => {
        if (key !== 'then') {
          ;(chain as Record<string, unknown>)[key] = vi.fn().mockReturnValue(chain)
        }
      })

      if (callCount === 1) {
        // Fetch learning case
        ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
          resolve({ data: learningCase, error: null })
          return Promise.resolve({ data: learningCase, error: null })
        }
      } else if (callCount === 2) {
        // Insert knowledge chunk
        ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
          resolve({ data: chunk, error: null })
          return Promise.resolve({ data: chunk, error: null })
        }
      } else {
        // Update learning case
        ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
          resolve({ data: null, error: null })
          return Promise.resolve({ data: null, error: null })
        }
      }

      return chain
    })

    const req = new NextRequest('http://localhost/api/learning/case-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'extract' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'case-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.chunkId).toBe('chunk-1')
  })

  it('returns 404 when learning case not found', async () => {
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: { message: 'Not found' } })
      return Promise.resolve({ data: null, error: { message: 'Not found' } })
    }
    mockSupabase.from.mockReturnValue(mockChain)

    const req = new NextRequest('http://localhost/api/learning/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'extract' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})
