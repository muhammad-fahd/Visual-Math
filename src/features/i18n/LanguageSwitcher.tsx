'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES, type Locale } from '../../i18n/locales';
import { i18n } from '../../i18n/support';

/** Remembers the explicit choice for the redirect from `/` (decided in Story 1.3; named in the Privacy page). */
function saveChoice(locale: Locale) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

const isModified = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * Plain links, so the switch works without JavaScript (to the bare path; the cookie is saved only with JavaScript).
 * With JavaScript a plain click keeps the visitor's place: query and hash (where viewer state lives, AD-6) are
 * appended at click time. A locale change swaps the root layout, so the browser does a full navigation; nothing is
 * lost because the state is in the URL. Modified clicks (new tab, new window) are left to the browser.
 */
export function LanguageSwitcher() {
  const t = useTranslations('language');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="inline-flex gap-2">
      {LOCALES.map((locale) => {
        const href = i18n.swapLocale(pathname, locale);
        const active = locale === current;
        return (
          <a
            key={locale}
            href={href}
            lang={locale}
            hrefLang={locale}
            dir={i18n.direction(locale)}
            aria-current={active ? 'true' : undefined}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (isModified(event)) return;
              event.preventDefault();
              if (active) return; // already here: nothing to save or navigate
              saveChoice(locale);
              window.location.assign(href + window.location.search + window.location.hash);
            }}
            className={
              'inline-flex min-h-11 items-center rounded-md border-2 px-4 font-semibold ' +
              (active ? 'border-primary bg-selected text-text' : 'border-border-strong bg-surface text-text')
            }
          >
            {t(locale)}
          </a>
        );
      })}
    </nav>
  );
}
