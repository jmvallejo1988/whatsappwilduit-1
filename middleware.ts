import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PUBLIC_PATHS = ['/', '/api/webhook', '/api/auth'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/webhook');
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get('auth-token')?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/api/messages/:path*', '/api/conversations/:path*'],
};
