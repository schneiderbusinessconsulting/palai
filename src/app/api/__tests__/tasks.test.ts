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
  limit: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import { GET, POST, PATCH } from '@/app/api/tasks/route'

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

describe('GET /api/tasks', () => {
  beforeEach(resetMocks)

  it('returns tasks list', async () => {
    const tasks = [{ id: '1', title: 'Task 1', status: 'open' }]
    setupChainResult(tasks)

    const req = new NextRequest('http://localhost/api/tasks')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tasks).toEqual(tasks)
  })

  it('filters by status', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/tasks?status=done')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'done')
  })

  it('does not filter when status is all', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/tasks?status=all')
    await GET(req)
    expect(mockChain.eq).not.toHaveBeenCalledWith('status', expect.anything())
  })

  it('filters by assigned_agent_id', async () => {
    setupChainResult([])

    const req = new NextRequest('http://localhost/api/tasks?assigned_agent_id=agent-1')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('assigned_agent_id', 'agent-1')
  })

  it('returns 500 on error', async () => {
    setupChainResult(null, { message: 'Error' })

    const req = new NextRequest('http://localhost/api/tasks')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/tasks', () => {
  beforeEach(resetMocks)

  it('creates a new task', async () => {
    const task = { id: '1', title: 'New Task', status: 'open' }
    setupChainResult(task)

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Task' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task).toEqual(task)
  })
})

describe('PATCH /api/tasks', () => {
  beforeEach(resetMocks)

  it('updates a task', async () => {
    const task = { id: '1', title: 'Updated', status: 'done' }
    setupChainResult(task)

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ id: '1', status: 'done' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.task).toEqual(task)
  })

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
