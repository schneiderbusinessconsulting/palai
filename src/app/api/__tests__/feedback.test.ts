import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
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

vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ items: [], product: 'Test' }) } }],
  })
  class MockOpenAI {
    chat = { completions: { create: mockCreate } }
  }
  return { default: MockOpenAI, __esModule: true }
})

import { GET, POST } from '@/app/api/feedback/route'

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

describe('GET /api/feedback', () => {
  beforeEach(resetMocks)

  it('returns feedback threads', async () => {
    const threads = [
      { id: '1', title: 'Course feedback', department: 'product', status: 'open', feedback_items: [] },
    ]
    setupChainResult(threads)

    const req = new NextRequest('http://localhost/api/feedback')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.threads).toEqual(threads)
  })

  it('filters by department', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/feedback?department=sales')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('department', 'sales')
  })

  it('filters by status (defaults to open)', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/feedback')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'open')
  })

  it('does not filter status when all', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/feedback?status=all')
    await GET(req)
    expect(mockChain.eq).not.toHaveBeenCalledWith('status', expect.anything())
  })

  it('returns 500 on database error', async () => {
    setupChainResult(null, { message: 'DB error' })

    const req = new NextRequest('http://localhost/api/feedback')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/feedback', () => {
  beforeEach(resetMocks)

  it('returns 400 when emailId is missing', async () => {
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ bodyText: 'Some text' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when bodyText is missing', async () => {
    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ emailId: '123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('skips if feedback already extracted', async () => {
    // First query for existing feedback returns data
    setupChainResult([{ id: 'existing' }])

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ emailId: '123', bodyText: 'Great course!' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toBe(true)
  })

  it('returns no feedback found when AI finds nothing', async () => {
    // First query for existing feedback returns empty
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ emailId: '123', bodyText: 'Hello world', subject: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})
