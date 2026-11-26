import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE } from './i18n/locales';
import { i18n } from './i18n/support';

// The one dynamic public route: `/` redirects to the visitor's language (FR-6.3, AD-10).
// Order: the explicit choice in the vm-locale cookie, then Accept-Language, then English.
export function proxy(request: NextRequest) {
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

export const config = { matcher: ['/'] };
