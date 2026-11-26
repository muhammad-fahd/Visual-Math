import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matrixFromBrowserslist } from '../playwright-matrix';

describe('Playwright matrix derives from browserslist', () => {
  it('has one project per browserslist line', () => {
    const text = readFileSync('browserslist', 'utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    expect(matrixFromBrowserslist(text)).toHaveLength(lines.length);
  });
  it('includes a 360 px phone project (SRS NFR-4.2)', () => {
    const m = matrixFromBrowserslist('samsung 22\n');
    expect(m[0]).toMatchObject({ width: 360, mobile: true });
  });
  it('has unique project names', () => {
    const names = matrixFromBrowserslist(readFileSync('browserslist', 'utf8')).map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it('fails loudly on an unmapped entry', () => {
    expect(() => matrixFromBrowserslist('opera 90\n')).toThrow(/no Playwright mapping/);
  });
});
