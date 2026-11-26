// The Content Security Policy and the other security headers (AD-17). Pure: next.config.ts calls it.
//
// script-src carries 'unsafe-inline' on purpose (owner decision 2026-11-26, spike 3): Next's inline
// data scripts differ per page. Do NOT add a hash or a nonce to it: browsers then ignore
// 'unsafe-inline' and hydration breaks. Everything else is closed.

export interface CspOptions {
  /** The Supabase Storage origin that serves topic JSON and thumbnails, when configured. */
  storageOrigin?: string | undefined;
  /** The admin area additionally allows data: images (the authenticator QR code). */
  admin?: boolean;
}

/** Only a plain https origin is accepted; anything else is ignored rather than trusted. */
export function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp({ storageOrigin, admin = false }: CspOptions = {}): string {
  const storage = safeOrigin(storageOrigin);
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'"]],
    ['style-src', ["'self'", "'unsafe-inline'"]], // KaTeX and React style attributes
    ['img-src', ["'self'", ...(storage ? [storage] : []), ...(admin ? ['data:'] : [])]],
    ['font-src', ["'self'"]],
    ['connect-src', ["'self'", ...(storage ? [storage] : [])]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['upgrade-insecure-requests', []],
  ];
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ');
}

export interface Header {
  key: string;
  value: string;
}

// HSTS without includeSubDomains and with one year: raise both only once every subdomain of the
// final product domain is known to serve HTTPS (docs/environments.md).
export function securityHeaders(options: CspOptions = {}): Header[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(options) },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  ];
}
