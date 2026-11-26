import { describe, expect, it } from 'vitest';
import { readDesign, splitColors } from '../../scripts/build-tokens.mjs';

// The contrast table in DESIGN.md is part of the design contract: every row must still hold with the real tokens.
function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('ratio()', () => {
  it('matches known values', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(ratio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});

describe('DESIGN.md contrast table', () => {
  const { fm, body } = readDesign();
  const { light, dark } = splitColors(fm.colors) as { light: Record<string, string>; dark: Record<string, string> };
  const parts = body.split('### Contrast table');
  if (parts.length < 2) throw new Error('DESIGN.md has no "### Contrast table" heading');
  const section = parts[1]!.split('## Typography')[0]!;
  const rows = section
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Pair'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

  it('parses every row into four numeric-ready cells', () => {
    expect(rows.length).toBeGreaterThanOrEqual(26);
    for (const r of rows) {
      expect(r, r.join(' | ')).toHaveLength(4);
      for (const n of r.slice(1)) expect(Number.isFinite(Number(n)), `not a number: ${n}`).toBe(true);
    }
  });

  for (const [pair, listedLight, listedDark, need] of rows as [string, string, string, string][]) {
    it(`${pair}`, () => {
      const m = /^(.+?) on (\S+)/.exec(pair);
      expect(m, `cannot read pair "${pair}"`).not.toBeNull();
      const fg = m![1]!.replace(/ ring$/, '');
      const bg = m![2]!;
      for (const [theme, set, listed] of [['light', light, listedLight], ['dark', dark, listedDark]] as const) {
        expect(set[fg], `${theme}: no color "${fg}"`).toBeDefined();
        expect(set[bg], `${theme}: no color "${bg}"`).toBeDefined();
        const r = ratio(set[fg]!, set[bg]!);
        expect(r, `${theme} ${pair} is ${r.toFixed(2)}, needs ${need}`).toBeGreaterThanOrEqual(Number(need));
        expect(Math.abs(r - Number(listed)), `${theme} ${pair}: table says ${listed}, tokens give ${r.toFixed(2)}`).toBeLessThanOrEqual(0.05);
      }
    });
  }
});

describe('pairs the controls use that the table does not list', () => {
  const { fm } = readDesign();
  const { light, dark } = splitColors(fm.colors) as { light: Record<string, string>; dark: Record<string, string> };
  const extra: [string, string, number][] = [
    ['primary', 'bg', 3], // selected toggle border on the page
    ['primary', 'selected', 3], // pressed toggle border against its tint
    ['text', 'selected', 4.5],
    ['border-strong', 'bg', 3],
  ];
  for (const [fg, bg, need] of extra) {
    it(`${fg} on ${bg} >= ${need}`, () => {
      for (const [theme, set] of [['light', light], ['dark', dark]] as const) {
        expect(ratio(set[fg]!, set[bg]!), theme).toBeGreaterThanOrEqual(need);
      }
    });
  }
});
