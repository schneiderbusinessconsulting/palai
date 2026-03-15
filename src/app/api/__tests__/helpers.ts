import { vi } from 'vitest'

export function createMockSupabase() {
  const mockChain = {
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
    rpc: vi.fn().mockReturnThis(),
    then: vi.fn(),
    data: null,
    error: null,
  }
  return {
    from: vi.fn(() => mockChain),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    _chain: mockChain,
  }
}

/**
 * Creates a mock Supabase chain that resolves with the given result
 * when awaited. This is the standard pattern for route tests where
 * the route does `const { data, error } = await supabase.from(...)...`
 */
export function createResolvingChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'not', 'in', 'or', 'is', 'contains', 'order', 'limit', 'range', 'single', 'maybeSingle']

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnThis()
  }

  // Make the chain thenable (promise-like) so `await chain` resolves with result
  ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
    resolve(result)
    return Promise.resolve(result)
  }

  return chain
}

/**
 * Creates a NextRequest-like object for testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {}
) {
  const { method = 'GET', body, headers = {} } = options
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import('next/server').NextRequest
}
