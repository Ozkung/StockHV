import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ONLY = ['/users', '/audit-log'];
const MANAGER_ONLY = ['/approvals'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/login') || pathname.startsWith('/setup') || pathname.startsWith('/backend')) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || Date.now() >= (token.accessTokenExpires ?? 0)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const role = token.role ?? '';
  const denied =
    (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && role !== 'ADMIN') ||
    (MANAGER_ONLY.some((p) => pathname.startsWith(p)) && role === 'STAFF');
  if (pathname === '/' || denied) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
