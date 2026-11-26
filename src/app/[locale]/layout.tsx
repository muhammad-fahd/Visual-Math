import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { NextIntlClientProvider } from 'next-intl';
import type { Metadata } from 'next';
import { getMessages, getTranslations } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { DEFAULT_LOCALE, LOCALES } from '../../i18n/locales';
import { i18n } from '../../i18n/support';
import { PREPAINT_SCRIPT } from '../../lib/theme/prepaint';
import '../globals.css';

// Only the supported locales exist; anything else (/fr) is a 404 (global-not-found).
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site');
  return { title: t('name') };
}

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  const raw = await rootLocale();
  const locale = i18n.isLocale(raw) ? raw : DEFAULT_LOCALE;
  const messages = await getMessages();
  // Urdu pages need the Nastaliq file at once; English pages never request it (AD-12). React emits one hint.
  if (locale === 'ur') preload('/fonts/NotoNastaliqUrdu-400.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });

  return (
    // suppressHydrationWarning: the pre-paint script sets data-theme before React hydrates (AD-11).
    <html lang={locale} dir={i18n.direction(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
