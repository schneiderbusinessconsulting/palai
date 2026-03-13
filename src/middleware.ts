import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SITE_PASSWORD = process.env.SITE_PASSWORD || ''
const AUTH_COOKIE_NAME = 'palai_auth'

// Help Center domain - only shows /helpcenter routes
const HELP_CENTER_DOMAINS = ['help.palacios-institut.ch', 'help.palacios-institut.com']

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Check if this is the Help Center domain
  const isHelpCenterDomain = HELP_CENTER_DOMAINS.some(domain =>
    hostname.includes(domain) || hostname.startsWith('help.')
  )

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
  // If no password is set, allow all access
  if (!SITE_PASSWORD) {
    return NextResponse.next()
  }

  // Allow static files, public pages, and webhook endpoints (unauthenticated)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/helpcenter') || // Public help center also accessible on dashboard
    pathname === '/auth' ||
    pathname.startsWith('/api/webhooks') || // Public webhooks (e.g. HubSpot inbound)
    pathname.startsWith('/api/helpcenter')  // Public help center API
  ) {
    return NextResponse.next()
  }

  // Protect API routes with the same password cookie
  if (pathname.startsWith('/api')) {
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
    if (!authCookie || authCookie.value !== SITE_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Check for password in query param
  const pwParam = searchParams.get('pw')
  if (pwParam === SITE_PASSWORD) {
    // Set auth cookie and redirect to clean URL
    const url = request.nextUrl.clone()
    url.searchParams.delete('pw')
    const response = NextResponse.redirect(url)
    response.cookies.set(AUTH_COOKIE_NAME, SITE_PASSWORD, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return response
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
  if (authCookie?.value === SITE_PASSWORD) {
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
