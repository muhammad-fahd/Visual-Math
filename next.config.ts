import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A custom 404 for requests that match no route (an unknown locale such as /fr), since the root layout lives in [locale].
  experimental: { globalNotFound: true },
};

export default withNextIntl(nextConfig);
