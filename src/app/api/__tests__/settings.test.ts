import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
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

// --- Config ---
import { GET as configGET, PATCH as configPATCH } from '@/app/api/settings/config/route'

describe('GET /api/settings/config', () => {
  beforeEach(resetMocks)

  it('returns config map from rows', async () => {
    const rows = [
      { key: 'rag_match_threshold', value: '0.7', description: 'RAG threshold', updated_at: '2024-01-01' },
    ]
    setupChainResult(rows)

    const req = new NextRequest('http://localhost/api/settings/config')
    const res = await configGET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.rag_match_threshold).toBe('0.7')
    expect(body.rows).toEqual(rows)
  })

  it('returns specific key when requested', async () => {
    setupChainResult({ key: 'rag_match_threshold', value: '0.7', description: 'desc' })

    const req = new NextRequest('http://localhost/api/settings/config?key=rag_match_threshold')
    const res = await configGET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.key).toBe('rag_match_threshold')
  })

  it('returns 404 for unknown key', async () => {
    setupChainResult(null, { message: 'Not found' })

    const req = new NextRequest('http://localhost/api/settings/config?key=nonexistent')
    const res = await configGET(req)
    expect(res.status).toBe(404)
  })

  it('returns empty config on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/settings/config')
    const res = await configGET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config).toEqual({})
  })
})

describe('PATCH /api/settings/config', () => {
  beforeEach(resetMocks)

  it('updates config with key/value', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/settings/config', {
      method: 'PATCH',
      body: JSON.stringify({ key: 'rag_match_threshold', value: '0.8' }),
    })
    const res = await configPATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('updates config with updates object', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/settings/config', {
      method: 'PATCH',
      body: JSON.stringify({ updates: { key1: 'val1', key2: 'val2' } }),
    })
    const res = await configPATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.updated).toBe(2)
  })

  it('handles table not found gracefully', async () => {
    setupChainResult(null, { code: '42P01' })

    const req = new NextRequest('http://localhost/api/settings/config', {
      method: 'PATCH',
      body: JSON.stringify({ key: 'test', value: 'val' }),
    })
    const res = await configPATCH(req)
    expect(res.status).toBe(200)
  })
})

// --- AI Instructions ---
import { GET as aiGET, POST as aiPOST, DELETE as aiDELETE } from '@/app/api/settings/ai-instructions/route'

describe('GET /api/settings/ai-instructions', () => {
  beforeEach(resetMocks)

  it('returns grouped instructions', async () => {
    const data = [
      { id: '1', source_title: 'Tone Rule', content: 'Be formal', created_at: '2024-01-01' },
      { id: '2', source_title: 'Tone Rule', content: 'Use Sie', created_at: '2024-01-01' },
    ]
    setupChainResult(data)

    const res = await aiGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.instructions).toHaveLength(1)
    expect(body.instructions[0].title).toBe('Tone Rule')
    expect(body.instructions[0].ids).toHaveLength(2)
  })

  it('returns empty on table not found', async () => {
    setupChainResult(null, { code: '42P01' })

    const res = await aiGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.instructions).toEqual([])
  })
})

describe('POST /api/settings/ai-instructions', () => {
  beforeEach(resetMocks)

  it('creates new instruction', async () => {
    const instruction = { id: '1', source_title: 'Test', content: 'Be nice' }
    setupChainResult(instruction)

    const req = new NextRequest('http://localhost/api/settings/ai-instructions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Be nice' }),
    })
    const res = await aiPOST(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 when title or content is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai-instructions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    })
    const res = await aiPOST(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/settings/ai-instructions', () => {
  beforeEach(resetMocks)

  it('deletes instruction by title', async () => {
    setupChainResult(null)

    const req = new NextRequest('http://localhost/api/settings/ai-instructions', {
      method: 'DELETE',
      body: JSON.stringify({ title: 'Tone Rule' }),
    })
    const res = await aiDELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 when title is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai-instructions', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })
    const res = await aiDELETE(req)
    expect(res.status).toBe(400)
  })
})
