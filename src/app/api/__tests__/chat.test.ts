import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
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
  generateChatResponse: vi.fn(() => Promise.resolve('AI response about the topic')),
}))

vi.mock('@/lib/ai/prompts', () => ({
  CHAT_SYSTEM_PROMPT: 'You are a helpful assistant.',
  buildChatPrompt: vi.fn((msg: string, chunks: string[]) => `${msg}\n\nContext: ${chunks.join('\n')}`),
}))

import { POST } from '@/app/api/chat/route'

function resetMocks() {
  vi.clearAllMocks()
  Object.keys(mockChain).forEach((key) => {
    ;(mockChain as Record<string, unknown>)[key] = vi.fn().mockReturnThis()
  })
  mockSupabase.from.mockReturnValue(mockChain)
}

describe('POST /api/chat', () => {
  beforeEach(resetMocks)

  it('returns AI response with sources', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { id: 'c1', content: 'Chunk content', source_title: 'FAQ', source_type: 'faq', similarity: 0.85 },
      ],
      error: null,
    })

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'What courses do you offer?' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.response).toBe('AI response about the topic')
    expect(body.sources).toEqual([{ title: 'FAQ', type: 'faq' }])
  })

  it('returns 400 when message is missing', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('handles no matching chunks gracefully', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Random question' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.response).toBeDefined()
    expect(body.sources).toEqual([])
  })

  it('handles search error gracefully', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Test' }),
    })
    const res = await POST(req)
    // Should still succeed with empty context
    expect(res.status).toBe(200)
  })

  it('stores messages when conversationId is provided', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
    // Make insert resolve
    ;(mockChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: null })
      return Promise.resolve({ data: null, error: null })
    }

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', conversationId: 'conv-1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    // Should have called insert twice (user + assistant message)
    expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages')
  })
})
