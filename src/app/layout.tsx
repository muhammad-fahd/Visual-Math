import type { ReactNode } from 'react';
import { PREPAINT_SCRIPT } from '../lib/theme/prepaint';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script sets data-theme before React hydrates (AD-11).
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
