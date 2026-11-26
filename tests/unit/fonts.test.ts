import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Urdu font (NFR-1.6)', () => {
  it('the subset stays inside the 150 KB budget', () => {
    expect(statSync('public/fonts/NotoNastaliqUrdu-400.woff2').size).toBeLessThanOrEqual(150 * 1024);
  });
  it('is a WOFF2 file', () => {
    expect(readFileSync('public/fonts/NotoNastaliqUrdu-400.woff2').subarray(0, 4).toString('latin1')).toBe('wOF2');
  });
  it('ships the licence beside it', () => {
    expect(readFileSync('public/fonts/OFL-NotoNastaliqUrdu.txt', 'utf8')).toMatch(/SIL Open Font License/);
  });
  it('fonts.css swaps and ships no synthetic bold', () => {
    const css = readFileSync('src/styles/fonts.css', 'utf8');
    expect(css).toMatch(/font-display:\s*swap/);
    expect(css).toMatch(/font-synthesis:\s*none/);
  });
});
