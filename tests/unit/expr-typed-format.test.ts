import { describe, expect, it } from 'vitest';
import { format, parseTyped } from '../../src/lib/expr';

const ok = (raw: string) => {
  const r = parseTyped(raw);
  if (!r.ok) throw new Error(`rejected: ${JSON.stringify(raw)}`);
  return r.value;
};

describe('typed value beside a slider (FR-3.7)', () => {
  it('normalizes Eastern Arabic-Indic digits and separators', () => {
    expect(ok('٣٫١٤')).toBe(3.14); // ٣٫١٤
    expect(ok('۱۲')).toBe(12); // ۱۲
    expect(ok('١٬٠٠٠')).toBe(1000); // ١٬٠٠٠
    expect(ok('٠')).toBe(0);
    expect(ok('٩٩٩')).toBe(999);
    expect(ok('۰۱۲۳۴۵۶۷۸۹')).toBe(123456789);
  });
  it('accepts a real minus sign and a plus sign, and mixes digit sets', () => {
    expect(ok('−5')).toBe(-5);
    expect(ok('−٣٫٥')).toBe(-3.5);
    expect(ok('+7')).toBe(7);
    expect(ok('-7')).toBe(-7);
    expect(ok('1۲')).toBe(12);
  });
  it('drops whitespace (an RTL keyboard may add it) and accepts ordinary numbers', () => {
    expect(ok(' 1٬000 ')).toBe(1000);
    expect(ok('1 2')).toBe(12); // whitespace is dropped, as topic-format section 3 says
    expect(ok('\t4\n')).toBe(4);
    expect(ok('42')).toBe(42);
    expect(ok('0.5')).toBe(0.5);
    expect(ok('.5')).toBe(0.5);
    expect(ok('5.')).toBe(5);
    expect(ok('1e3')).toBe(1000);
    expect(ok('2.5E-1')).toBe(0.25);
    expect(ok('-0')).toBe(0);
    expect(Object.is(ok('-0'), 0)).toBe(true); // never -0
    expect(ok('000012')).toBe(12);
  });
  it('rejects anything that is not exactly one finite number', () => {
    for (const raw of [
      '', ' ', 'abc', '1+1', '1-1', '1*2', '(1)', '--1', '+-1', '1..2', '1.2.3', '.', '-', '+', 'e3', '1e', '1e+', '1,5', '1;2', 'NaN', 'Infinity', '-Infinity', '0x10',
      '1_000', 'pi', 'e', '1/2', '50%', '$5', '5 cm', '1e999', '-1e999', '٣٣٣x', '½', '٣ + ٣', '1‎', '١−١',
    ]) {
      expect(parseTyped(raw), JSON.stringify(raw)).toEqual({ ok: false });
    }
  });
  it('rejects non-strings and anything over 40 characters', () => {
    for (const raw of [undefined, null, 5, {}, [], true, Symbol('x')]) expect(parseTyped(raw)).toEqual({ ok: false });
    expect(parseTyped('1'.repeat(40)).ok).toBe(true);
    expect(parseTyped('1'.repeat(41))).toEqual({ ok: false });
    expect(parseTyped('1'.repeat(40) + ' ')).toEqual({ ok: false }); // the raw length counts
  });
  it('digits of other scripts and look-alikes are not numbers', () => {
    expect(parseTyped('१२')).toEqual({ ok: false }); // Devanagari
    expect(parseTyped('１２')).toEqual({ ok: false }); // fullwidth
    expect(parseTyped('²')).toEqual({ ok: false });
    expect(parseTyped('1٪')).toEqual({ ok: false }); // Arabic percent sign
  });
});

describe('format: how a result is shown', () => {
  it.each([
    [94.2478, 1, '94.2'],
    [94.2478, 2, '94.25'],
    [94.2478, 0, '94'],
    [94, 2, '94.00'],
    [0.5, 1, '0.5'],
    [1234567.891, 1, '1234567.9'], // no group separators: a slider range and a worked example stay plain
    [-3, 0, '−3'],
    [-3.14159, 2, '−3.14'],
    [0, 3, '0.000'],
    [-0.001, 1, '0.0'], // rounds to zero: no sign
    [-0, 2, '0.00'],
    [0.005, 2, '0.01'],
    [2.5, 0, '3'],
    [1e-7, 2, '0.00'],
    [1e20, 0, '100000000000000000000'],
  ] as const)('format(%f, %i) = %s', (value, decimals, expected) => expect(format(value, decimals)).toBe(expected));

  it('NaN and infinities are an em dash (undefined), as the topic format says', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(format(v, 2)).toBe('—');
    expect(format(undefined as unknown as number)).toBe('—');
    expect(format('5' as unknown as number)).toBe('—');
  });
  it('uses Western digits and the real minus sign, never a hyphen', () => {
    const out = format(-1234.5, 1);
    expect(out).toBe('−1234.5');
    expect(out).not.toContain('-');
    expect(out).toMatch(/^[−]?[0-9.]+$/);
  });
  it('decimals default to 2 and are clamped to 0..20; a bad count falls back to 2', () => {
    expect(format(1.005)).toBe('1.00'); // 1.005 is 1.00499999999999989... in binary
    expect(format(1.5, -3)).toBe('2');
    expect(format(1.5, 25)).toHaveLength(2 + 20);
    expect(format(1.5, 1.5)).toBe('1.50');
    expect(format(1.5, NaN)).toBe('1.50');
  });
  it('very large values use exponent form instead of a 300-digit string', () => {
    expect(format(1e30, 2)).toMatch(/^1\.00e\+30$/);
    expect(format(-1e30, 1)).toMatch(/^−1\.0e\+30$/);
    expect(format(2.5e299, 1).length).toBeLessThan(12);
  });
  it('a worked example reads right: V = (1/3) x pi x r^2 x h', () => {
    expect(format((1 / 3) * Math.PI * 3 * 3 * 10, 1)).toBe('94.2');
  });
});
