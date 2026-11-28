import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES, LOCALE_COOKIE } from './i18n/locales';
import { i18n } from './i18n/support';
import { refreshAdminSession } from './server/admin/session-refresh';

// Three jobs, and only on the paths below (a page in a supported language never reaches this code, AD-10):
//  1. `/` redirects to the visitor's language (FR-6.3): the vm-locale cookie, then Accept-Language, then English.
//  2. `/admin/*` refreshes the admin session cookies, which Server Components cannot do.
//  3. An address in a language that does not exist (/fr, /fr/geometry) is sent to a path that matches no route, so the
//     global 404 answers. The locale layout cannot do it with `dynamicParams = false`: that would 404 every tree address
//     added after the build (Story 5.1).
// Deeper than any page: `/[locale]` matches every one-segment path, so a shorter target would render the home page.
const UNSUPPORTED = '/__unsupported-locale/a/b/c/d/e';
const SUPPORTED_PREFIX = new RegExp(`^/(${LOCALES.join('|')})(/|$)`);
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/admin' || path.startsWith('/admin/')) {
    return refreshAdminSession(request);
  }
  if (path !== '/') {
    if (SUPPORTED_PREFIX.test(path)) return NextResponse.next(); // only reached if the matcher is widened: never block a real page
    return NextResponse.rewrite(new URL(UNSUPPORTED, request.url));
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

// Everything except the supported languages (`en`, `ur`: the unit test keeps this list equal to LOCALES), the admin
// area, the API, the build output, `fonts` and any file with an extension.
export const config = { matcher: ['/', '/admin/:path*', '/((?!(?:en|ur)(?:/|$)|admin(?:/|$)|api(?:/|$)|_next/|fonts/|.*\\..*).+)'] };
