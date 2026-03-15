import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
  rpc: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/ai/openai', () => ({
  createEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
  generateChatResponse: vi.fn(() => Promise.resolve('Here is your answer about courses.')),
}))

import { GET } from '@/app/api/helpcenter/route'

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

describe('GET /api/helpcenter', () => {
  beforeEach(resetMocks)

  it('returns published help center articles', async () => {
    const chunks = [
      { id: '1', source_title: 'FAQ 1', source_type: 'faq', content: 'Answer 1', updated_at: '2024-01-01', published: true },
      { id: '2', source_title: 'FAQ 1', source_type: 'faq', content: 'Answer 1 part 2', updated_at: '2024-01-01', published: true },
      { id: '3', source_title: 'Course Info', source_type: 'course_info', content: 'Hypnose Kurs', updated_at: '2024-01-02', published: true },
    ]
    setupChainResult(chunks)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.articles).toHaveLength(2) // Grouped by title
    expect(body.articles[0].title).toBe('FAQ 1')
    // Content from second chunk appended
    expect(body.articles[0].content).toContain('Answer 1 part 2')
  })

  it('returns empty articles when no data', async () => {
    setupChainResult([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.articles).toEqual([])
  })

  it('returns 500 on database error', async () => {
    setupChainResult(null, { message: 'DB error' })

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('filters by published and correct source types', async () => {
    setupChainResult([])

    await GET()
    expect(mockChain.in).toHaveBeenCalledWith('source_type', ['help_article', 'faq', 'course_info'])
    expect(mockChain.eq).toHaveBeenCalledWith('published', true)
  })
})

// Test the ask endpoint
import { POST as askPOST } from '@/app/api/helpcenter/ask/route'

describe('POST /api/helpcenter/ask', () => {
  beforeEach(resetMocks)

  it('returns AI answer with sources', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { id: 'c1', content: 'Hypnose course info', source_title: 'Hypnose Kurs', source_type: 'course_info', similarity: 0.85 },
      ],
      error: null,
    })

    const req = new NextRequest('http://localhost/api/helpcenter/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Was kostet der Hypnose Kurs?' }),
    })
    const res = await askPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.answer).toBeDefined()
    expect(body.hasAnswer).toBe(true)
    expect(body.sources).toHaveLength(1)
  })

  it('returns 400 for short question', async () => {
    const req = new NextRequest('http://localhost/api/helpcenter/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'hi' }),
    })
    const res = await askPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns no answer when no relevant chunks found', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        // Only non-help-center type chunks
        { id: 'c1', content: 'Internal note', source_title: 'Note', source_type: 'email', similarity: 0.7 },
      ],
      error: null,
    })

    const req = new NextRequest('http://localhost/api/helpcenter/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Some random question here' }),
    })
    const res = await askPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hasAnswer).toBe(false)
    expect(body.sources).toEqual([])
  })

  it('returns 500 on search error', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    })

    const req = new NextRequest('http://localhost/api/helpcenter/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Was kostet der Kurs?' }),
    })
    const res = await askPOST(req)
    expect(res.status).toBe(500)
  })
})
