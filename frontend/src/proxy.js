import { NextResponse } from 'next/server';

/**
 * Next.js 16 Proxy (renamed from middleware).
 * Layer 1 of route protection — fast, runs on the Edge before any render.
 *
 * Strategy: checks for the `nx_session` cookie (httpOnly, set by the backend
 * on login/refresh, cleared on logout). If present → user has an active session.
 *
 * This is an OPTIMISTIC check — it trusts the cookie existence, not its content.
 * Layer 2 (AuthGuard component) does the real session validation via POST /auth/refresh.
 *
 * Why two layers:
 *   proxy.js  → fast UX redirect (no layout flash before auth check completes)
 *   AuthGuard → real validation (catches expired/revoked sessions)
 */

const PROTECTED_PREFIXES = ['/chat', '/profile', '/settings', '/contacts', '/notifications', '/media', '/call'];
const GUEST_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/verify-otp'];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('nx_token');
  const isLoggedIn = !!session?.value;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isGuestOnly = GUEST_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestOnly && isLoggedIn) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals, static files, and public assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|apple-icon|.*\\.png$|.*\\.svg$).*)'],
};
