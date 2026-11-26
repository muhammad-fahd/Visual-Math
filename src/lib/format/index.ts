// Numbers, dates and percentages for the visitor's language (NFR-7.2).
// Western digits by default, also in Urdu; an Eastern-digit option is a display preference added later.

const FALLBACK = 'en';
const DASH = '—';

function safe(locale: string, make: (l: string) => string): string {
  try {
    return make(locale);
  } catch {
    try {
      return make(FALLBACK); // an invalid language tag must not break a page
    } catch {
      return DASH; // nor an invalid option value
    }
  }
}

export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
  if (!Number.isFinite(value)) return DASH;
  return safe(locale, (l) => new Intl.NumberFormat(l, { numberingSystem: 'latn', ...options }).format(value));
}

/** `fraction` is 0..1: 0.256 -> "25.6%". */
export function formatPercent(fraction: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
  return formatNumber(fraction, locale, { style: 'percent', maximumFractionDigits: 1, ...options });
}

export function formatDate(date: Date | number, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return DASH;
  return safe(locale, (l) => new Intl.DateTimeFormat(l, { numberingSystem: 'latn', timeZone: 'UTC', ...options }).format(d));
}
