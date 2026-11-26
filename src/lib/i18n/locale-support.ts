import { negotiateLocale } from './negotiate';

// Languages written right to left. A new RTL locale needs no code change: its code is already here.
const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv']);

export type Direction = 'ltr' | 'rtl';

export type LocaleSupport<L extends string> = {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  isLocale(value: unknown): value is L;
  direction(locale: string): Direction;
  /** Cookie first (the visitor's explicit choice), then Accept-Language, then the default. */
  resolveLocale(input: { cookie?: string | null; acceptLanguage?: string | null }): L;
  /** The locale in the first path segment, or null. */
  localeFromPath(path: string): L | null;
  /** `/en/topic/x` -> `/ur/topic/x`; paths without a locale get one. Query and hash are the caller's. */
  swapLocale(path: string, to: L): string;
};

/** Builds all locale behaviour from one list, so adding a language is a list entry plus a message file. */
export function createLocaleSupport<L extends string>(locales: readonly L[], defaultLocale: L): LocaleSupport<L> {
  const isLocale = (value: unknown): value is L => typeof value === 'string' && (locales as readonly string[]).includes(value);
  const localeFromPath = (path: string): L | null => {
    const first = path.split('/')[1];
    return isLocale(first) ? first : null;
  };
  return {
    locales,
    defaultLocale,
    isLocale,
    direction: (locale) => (RTL.has(locale.split('-')[0]!.toLowerCase()) ? 'rtl' : 'ltr'),
    resolveLocale: ({ cookie, acceptLanguage }) => (isLocale(cookie) ? cookie : negotiateLocale(acceptLanguage, locales, defaultLocale)),
    localeFromPath,
    swapLocale: (path, to) => {
      const clean = path.startsWith('/') ? path : `/${path}`;
      const m = /^\/([^/]+)(\/.*)?$/.exec(clean);
      if (m && isLocale(m[1])) return `/${to}${m[2] ?? ''}`; // keeps a trailing slash
      return `/${to}${clean === '/' ? '' : clean}`;
    },
  };
}
