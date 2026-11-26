import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber, formatPercent } from '../../src/lib/format';

describe('formatNumber (NFR-7.2)', () => {
  it('uses locale grouping with Western digits, also in Urdu', () => {
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
    expect(formatNumber(1234567.5, 'ur')).toMatch(/^1[,٬]234[,٬]567[.٫]5$/);
    expect(formatNumber(1234567.5, 'ur')).not.toMatch(/[٠-٩۰-۹]/);
  });
  it('German grouping differs, proving the locale is used', () => {
    expect(formatNumber(1234.5, 'de')).toBe('1.234,5');
  });
  it('non-finite values render an em dash', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(formatNumber(v, 'en')).toBe('—');
  });
  it('an invalid locale tag falls back to English instead of throwing', () => {
    expect(formatNumber(1234.5, 'not a locale!!')).toBe('1,234.5');
  });
  it('an invalid option value does not throw', () => {
    expect(formatNumber(1, 'en', { maximumFractionDigits: 200 })).toBe('\u2014');
  });
  it('passes options through', () => {
    expect(formatNumber(3.14159, 'en', { maximumFractionDigits: 2 })).toBe('3.14');
  });
});

describe('formatPercent', () => {
  it('formats a 0..1 fraction', () => {
    expect(formatPercent(0.256, 'en')).toBe('25.6%');
    expect(formatPercent(1, 'en')).toBe('100%');
  });
});

describe('formatDate', () => {
  const d = new Date(Date.UTC(2026, 10, 26, 12));
  it('formats in the locale, with Western digits', () => {
    expect(formatDate(d, 'en')).toBe('Nov 26, 2026');
    expect(formatDate(d, 'ur')).toBe(new Intl.DateTimeFormat('ur', { dateStyle: 'medium', numberingSystem: 'latn', timeZone: 'UTC' }).format(d));
    expect(formatDate(d, 'ur')).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    expect(formatDate(d, 'ur')).toContain('نومبر');
  });
  it('is stable across time zones (UTC)', () => {
    expect(formatDate(new Date(Date.UTC(2026, 10, 26, 23, 30)), 'en')).toBe('Nov 26, 2026');
  });
  it('an invalid date renders an em dash', () => {
    expect(formatDate(new Date('nope'), 'en')).toBe('—');
  });
});
