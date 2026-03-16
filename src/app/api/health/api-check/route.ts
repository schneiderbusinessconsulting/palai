import { NextRequest, NextResponse } from 'next/server'

// QA Watchdog – Testet alle wichtigen API-Routen und meldet Fehler
const ROUTES_TO_CHECK = [
  '/api/emails',
  '/api/insights',
  '/api/agents/performance',
  '/api/csat',
  '/api/analytics?period=30d',
  '/api/customers',
  '/api/templates',
]

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Basis-URL aus dem eingehenden Request ableiten
  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`

  const results: Array<{
    route: string
    status: number
    responseTime: number
    ok: boolean
    error?: string
  }> = []

  for (const route of ROUTES_TO_CHECK) {
    const start = Date.now()
    try {
      const url = `${baseUrl}${route}`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          // Cookie weiterleiten, falls vorhanden
          cookie: request.headers.get('cookie') || '',
        },
        // Kein Cache
        cache: 'no-store',
      })
      const responseTime = Date.now() - start

      results.push({
        route,
        status: res.status,
        responseTime,
        ok: res.ok,
      })
    } catch (err) {
      const responseTime = Date.now() - start
      results.push({
        route,
        status: 0,
        responseTime,
        ok: false,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      })
    }
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      passed,
      failed,
    },
    checkedAt: new Date().toISOString(),
  })
}
