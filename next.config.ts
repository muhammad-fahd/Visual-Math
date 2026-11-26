import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { safeOrigin, securityHeaders } from './src/lib/security/csp';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A custom 404 for requests that match no route (an unknown locale such as /fr), since the root layout lives in [locale].
  experimental: { globalNotFound: true },
  // The CSP and the other security headers (AD-17). Production only: `next dev` needs eval for React refresh.
  // The admin area is the only place that may show data: images (the authenticator QR code).
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    const storageOrigin = process.env.NEXT_PUBLIC_STORAGE_ORIGIN;
    if (storageOrigin && !safeOrigin(storageOrigin)) {
      // Topic JSON and thumbnails would be blocked by the CSP: say so at build time, not in production.
      console.warn('NEXT_PUBLIC_STORAGE_ORIGIN is set but is not a plain https origin; it is left out of the CSP.');
    }
    return [
      { source: '/admin/:path*', headers: securityHeaders({ storageOrigin, admin: true }) },
      { source: '/((?!admin(?:/|$)).*)', headers: securityHeaders({ storageOrigin }) },
    ];
  },
};

export default withNextIntl(nextConfig);
