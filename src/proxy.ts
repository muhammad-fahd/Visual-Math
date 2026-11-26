import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE } from './i18n/locales';
import { i18n } from './i18n/support';
import { refreshAdminSession } from './server/admin/session-refresh';

// Two jobs, and only on the paths below (visitor pages never reach this code, AD-10):
//  1. `/` redirects to the visitor's language (FR-6.3): the vm-locale cookie, then Accept-Language, then English.
//  2. `/admin/*` refreshes the admin session cookies, which Server Components cannot do.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')) {
    return refreshAdminSession(request);
  }
  const locale = i18n.resolveLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}`;
  const response = NextResponse.redirect(url, 307);
  // The answer depends on these headers, so no shared cache may reuse it for another visitor.
  response.headers.set('Vary', 'Accept-Language, Cookie');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/', '/admin/:path*'] };
