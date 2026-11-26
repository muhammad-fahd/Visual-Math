import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { adminText } from '../../i18n/messages/admin';
import { PREPAINT_SCRIPT } from '../../lib/theme/prepaint';
import '../globals.css';

// The admin area is its own root layout, outside [locale]: one admin, English, never static.
export const metadata: Metadata = { title: adminText.title, robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
