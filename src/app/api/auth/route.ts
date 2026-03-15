import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SITE_PASSWORD = process.env.SITE_PASSWORD || ''
const AUTH_COOKIE_NAME = 'palai_auth'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

function getSessionToken(): string {
  return crypto.createHash('sha256').update(`palai_session:${SITE_PASSWORD}`).digest('hex')
}

export async function POST(request: Request) {
  if (!SITE_PASSWORD) {
    return NextResponse.json({ success: true })
  }

  try {
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 })
    }

    if (!safeCompare(password, SITE_PASSWORD)) {
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 })
    }

    const sessionToken = getSessionToken()
    const response = NextResponse.json({ success: true })
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
}
