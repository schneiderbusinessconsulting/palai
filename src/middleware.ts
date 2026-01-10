import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SITE_PASSWORD = process.env.SITE_PASSWORD || 'palai26'
const AUTH_COOKIE_NAME = 'palai_auth'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Allow API routes and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/auth'
  ) {
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
     * - api routes
     * - _next (static files)
     * - favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
