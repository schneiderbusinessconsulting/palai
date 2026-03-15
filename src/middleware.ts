import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

const SITE_PASSWORD = process.env.SITE_PASSWORD || ''
const AUTH_COOKIE_NAME = 'palai_auth'

// Help Center domain - only shows /helpcenter routes
const HELP_CENTER_DOMAINS = ['help.palacios-institut.ch', 'help.palacios-institut.com']

// Timing-safe string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

// Generate a deterministic session token from the password (so we don't store the raw password in cookies)
function getSessionToken(): string {
  return crypto.createHash('sha256').update(`palai_session:${SITE_PASSWORD}`).digest('hex')
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Check if this is the Help Center domain — use exact match to prevent spoofing
  const isHelpCenterDomain = HELP_CENTER_DOMAINS.some(domain =>
    hostname === domain || hostname === `${domain}:${request.nextUrl.port}`
  ) || (hostname.startsWith('help.') && HELP_CENTER_DOMAINS.some(d => hostname.endsWith(d.replace('help.', ''))))

  // HELP CENTER DOMAIN ROUTING
  if (isHelpCenterDomain) {
    // Allow static files
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')
    ) {
      return NextResponse.next()
    }

    // Rewrite root to /helpcenter (URL stays as /)
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/helpcenter', request.url))
    }

    // Rewrite /artikel/... to /helpcenter/... (cleaner URLs)
    if (pathname.startsWith('/artikel/')) {
      const slug = pathname.replace('/artikel/', '')
      return NextResponse.rewrite(new URL(`/helpcenter/${slug}`, request.url))
    }

    // Allow /helpcenter routes and API
    if (pathname.startsWith('/helpcenter') || pathname.startsWith('/api/helpcenter')) {
      return NextResponse.next()
    }

    // Block all other routes - rewrite to /helpcenter
    return NextResponse.rewrite(new URL('/helpcenter', request.url))
  }

  // DASHBOARD DOMAIN ROUTING (ai.palacios-institut.com)
  // If no password is set, allow all access (dev only — log warning)
  if (!SITE_PASSWORD) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[SECURITY] SITE_PASSWORD not set — all routes are unprotected!')
    }
    return NextResponse.next()
  }

  const sessionToken = getSessionToken()

  // Allow static files, public pages, and webhook endpoints (unauthenticated)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/helpcenter') || // Public help center also accessible on dashboard
    pathname === '/auth' ||
    pathname === '/api/auth' || // Auth endpoint for POST login
    pathname.startsWith('/api/webhooks') || // Public webhooks (e.g. HubSpot inbound)
    pathname.startsWith('/api/helpcenter')  // Public help center API
  ) {
    return NextResponse.next()
  }

  // Protect API routes with the session token cookie
  if (pathname.startsWith('/api')) {
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
    if (!authCookie || !safeCompare(authCookie.value, sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Support legacy query param login (redirect to POST-based auth)
  const pwParam = searchParams.get('pw')
  if (pwParam && safeCompare(pwParam, SITE_PASSWORD)) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('pw')
    const response = NextResponse.redirect(url)
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return response
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
  if (authCookie && safeCompare(authCookie.value, sessionToken)) {
    return NextResponse.next()
  }

  // Not authenticated - redirect to auth page
  const authUrl = new URL('/auth', request.url)
  return NextResponse.redirect(authUrl)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next (static files)
     * - favicon
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
