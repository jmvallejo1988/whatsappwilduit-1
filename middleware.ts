import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'wilduit-jwt-secret-please-change-in-production'
)

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET)
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow webhook and auth API
  if (pathname.startsWith('/api/webhook') || pathname === '/api/auth') {
    return NextResponse.next()
  }

  const token = request.cookies.get('auth-token')?.value
  const authenticated = token ? await verifyToken(token) : false

  // Login page: redirect to /chat if already authenticated
  if (pathname === '/') {
    if (authenticated) return NextResponse.redirect(new URL('/chat', request.url))
    return NextResponse.next()
  }

  // All other matched routes require auth
  if (!authenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/chat/:path*',
    '/citas/:path*',
    '/configuraciones/:path*',
    '/api/messages/:path*',
    '/api/conversations/:path*',
    '/api/appointments/:path*',
    '/api/templates/:path*',
    '/api/users/:path*',
    '/api/bot/:path*',
    '/api/bot-debug/:path*',
    '/api/labels/:path*',
    '/api/send/:path*',
  ],
}
