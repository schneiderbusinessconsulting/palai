import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')

// Mock the @supabase/supabase-js createClient (used for admin client in knowledge route)
const adminMockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
}

const adminSupabase = {
  from: vi.fn(() => adminMockChain),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => adminSupabase),
}))

// Also mock server client (used as fallback)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(adminSupabase)),
}))

vi.mock('@/lib/ai/openai', () => ({
  createEmbedding: vi.fn(() => Promise.resolve(new Array(1536).fill(0))),
}))

// Mock pdfjs-dist to avoid worker issues in tests
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn(() =>
        Promise.resolve({
          getTextContent: vi.fn(() =>
            Promise.resolve({ items: [{ str: 'Extracted PDF text' }] })
          ),
        })
      ),
    }),
  })),
}))

import { GET, POST, DELETE } from '@/app/api/knowledge/route'

function makeRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(url, options)
}

function setupChainResult(data: unknown, error: unknown = null) {
  ;(adminMockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve({ data, error })
    return Promise.resolve({ data, error })
  }
  adminSupabase.from.mockReturnValue(adminMockChain)
}

describe('GET /api/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(adminMockChain).forEach((key) => {
      if (key !== 'then') {
        ;(adminMockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    adminSupabase.from.mockReturnValue(adminMockChain)
  })

  it('returns empty items array when no knowledge exists', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/knowledge')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('groups knowledge chunks by source_title', async () => {
    const chunks = [
      { id: '1', source_title: 'FAQ Document', source_type: 'help_article', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', published: true, approved: true, learning_context: null, source_learning_id: null },
      { id: '2', source_title: 'FAQ Document', source_type: 'help_article', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', published: true, approved: true, learning_context: null, source_learning_id: null },
      { id: '3', source_title: 'Product Guide', source_type: 'help_article', created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z', published: true, approved: true, learning_context: null, source_learning_id: null },
    ]
    setupChainResult(chunks)

    const req = makeRequest('http://localhost/api/knowledge')
    const res = await GET(req)
    const body = await res.json()
    expect(body.items).toHaveLength(2)

    const faq = body.items.find((i: { title: string }) => i.title === 'FAQ Document')
    expect(faq.chunks).toBe(2)
    expect(faq.ids).toHaveLength(2)

    const guide = body.items.find((i: { title: string }) => i.title === 'Product Guide')
    expect(guide.chunks).toBe(1)
  })

  it('filters by source_type when provided', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/knowledge?source_type=ai_instructions')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(adminMockChain.eq).toHaveBeenCalledWith('source_type', 'ai_instructions')
  })

  it('does not filter when source_type is "all"', async () => {
    setupChainResult([])

    const req = makeRequest('http://localhost/api/knowledge?source_type=all')
    await GET(req)
    const sourceTypeCalls = adminMockChain.eq.mock.calls.filter(
      (call: unknown[]) => call[0] === 'source_type'
    )
    expect(sourceTypeCalls).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    setupChainResult(null, { message: 'Database connection failed' })

    const req = makeRequest('http://localhost/api/knowledge')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch')
  })

  it('uses source_title as fallback title "Untitled" when missing', async () => {
    const chunks = [
      { id: '1', source_title: null, source_type: 'help_article', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', published: true, approved: true, learning_context: null, source_learning_id: null },
    ]
    setupChainResult(chunks)

    const req = makeRequest('http://localhost/api/knowledge')
    const res = await GET(req)
    const body = await res.json()
    expect(body.items[0].title).toBe('Untitled')
  })
})

describe('POST /api/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(adminMockChain).forEach((key) => {
      if (key !== 'then') {
        ;(adminMockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    adminSupabase.from.mockReturnValue(adminMockChain)
  })

  it('returns 400 when title is missing', async () => {
    const formData = new FormData()
    formData.append('content', 'Some content')
    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Title is required')
  })

  it('returns 400 when no content is provided', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Doc')
    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No content provided')
  })

  it('creates knowledge chunks from text content', async () => {
    const insertedChunk = { id: 'chunk-1', content: 'Hello world', source_title: 'Test Doc' }
    setupChainResult(insertedChunk)
    // Make single() resolve correctly
    ;(adminMockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: insertedChunk, error: null })
      return Promise.resolve({ data: insertedChunk, error: null })
    }

    const formData = new FormData()
    formData.append('title', 'Test Doc')
    formData.append('content', 'Hello world knowledge content for testing purposes.')
    formData.append('source_type', 'help_article')

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.title).toBe('Test Doc')
    expect(body.chunksCreated).toBeGreaterThan(0)
  })

  it('handles text file upload', async () => {
    const insertedChunk = { id: 'chunk-1', content: 'Text file content', source_title: 'Text File' }
    ;(adminMockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: insertedChunk, error: null })
      return Promise.resolve({ data: insertedChunk, error: null })
    }
    adminSupabase.from.mockReturnValue(adminMockChain)

    const textFile = new File(['This is a text file with content.'], 'doc.txt', { type: 'text/plain' })
    const formData = new FormData()
    formData.append('title', 'Text File')
    formData.append('file', textFile)

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('handles markdown file upload', async () => {
    const insertedChunk = { id: 'chunk-1', content: '# Markdown content', source_title: 'MD File' }
    ;(adminMockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: insertedChunk, error: null })
      return Promise.resolve({ data: insertedChunk, error: null })
    }
    adminSupabase.from.mockReturnValue(adminMockChain)

    const mdFile = new File(['# Heading\n\nContent here.'], 'guide.md', { type: 'text/markdown' })
    const formData = new FormData()
    formData.append('title', 'MD File')
    formData.append('file', mdFile)

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 500 when no chunks are stored', async () => {
    // Make insert fail
    ;(adminMockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: { message: 'Insert failed', code: '42501' } })
      return Promise.resolve({ data: null, error: { message: 'Insert failed', code: '42501' } })
    }
    adminSupabase.from.mockReturnValue(adminMockChain)

    const formData = new FormData()
    formData.append('title', 'Failing Doc')
    formData.append('content', 'Some content that will fail to store.')

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Speichern fehlgeschlagen')
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    const formData = new FormData()
    formData.append('title', 'Test')
    formData.append('content', 'Some content')

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    // Should return 500 because getSupabaseAdmin() throws
    expect(res.status).toBe(500)
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })
})

describe('DELETE /api/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(adminMockChain).forEach((key) => {
      if (key !== 'then') {
        ;(adminMockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
      }
    })
    adminSupabase.from.mockReturnValue(adminMockChain)
  })

  it('returns 400 when title is missing', async () => {
    const req = makeRequest('http://localhost/api/knowledge', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Title required')
  })

  it('deletes knowledge chunks by title successfully', async () => {
    setupChainResult(null)

    const req = makeRequest('http://localhost/api/knowledge', {
      method: 'DELETE',
      body: JSON.stringify({ title: 'FAQ Document' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('calls delete with correct title filter', async () => {
    setupChainResult(null)

    const req = makeRequest('http://localhost/api/knowledge', {
      method: 'DELETE',
      body: JSON.stringify({ title: 'My Knowledge Base' }),
    })
    await DELETE(req)
    expect(adminMockChain.delete).toHaveBeenCalled()
    expect(adminMockChain.eq).toHaveBeenCalledWith('source_title', 'My Knowledge Base')
  })

  it('returns 500 on database error', async () => {
    setupChainResult(null, { message: 'Delete failed', code: '500' })

    const req = makeRequest('http://localhost/api/knowledge', {
      method: 'DELETE',
      body: JSON.stringify({ title: 'Bad Document' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to delete')
  })

  it('returns 400 for null title', async () => {
    const req = makeRequest('http://localhost/api/knowledge', {
      method: 'DELETE',
      body: JSON.stringify({ title: null }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
