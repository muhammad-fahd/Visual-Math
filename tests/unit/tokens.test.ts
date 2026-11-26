import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate, OUT_DIR, readDesign, splitColors, validate } from '../../scripts/build-tokens.mjs';

const norm = (s: string) => s.replace(/\r\n/g, '\n');

describe('generated tokens match DESIGN.md (AD-11)', () => {
  const { fm } = readDesign();
  const out = generate(fm) as { css: string; ts: string; tailwind: string };

  it('tokens.css is up to date', () => {
    expect(norm(readFileSync(join(OUT_DIR, 'tokens.css'), 'utf8')), 'run `npm run tokens`').toBe(norm(out.css));
  });
  it('tokens.ts is up to date', () => {
    expect(norm(readFileSync(join(OUT_DIR, 'tokens.ts'), 'utf8')), 'run `npm run tokens`').toBe(norm(out.ts));
  });
  it('tailwind-theme.css is up to date', () => {
    expect(norm(readFileSync(join(OUT_DIR, 'tailwind-theme.css'), 'utf8')), 'run `npm run tokens`').toBe(norm(out.tailwind));
  });
  it('every color has a light and a dark value', () => {
    const { light, dark } = splitColors(fm.colors);
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
  it('dark values come only from the dark block', () => {
    expect(out.css).toMatch(/:root\[data-theme="dark"\] \{[^}]*--vm-color-bg: #12161C;/);
    expect(out.css).toMatch(/:root:not\(\[data-theme\]\) \{[^}]*--vm-color-bg: #12161C;/);
  });
  it('defines the variables that hand-written CSS relies on', () => {
    for (const v of ['--vm-type-urdu-body-size', '--vm-type-urdu-body-line', '--vm-type-body-font', '--vm-color-focus', '--vm-color-surface']) {
      expect(out.css, v).toContain(v + ':');
    }
  });
  it('never emits undefined or null', () => {
    for (const text of [out.css, out.ts, out.tailwind]) expect(text).not.toMatch(/\b(undefined|null)\b/);
  });
  it('validate() rejects bad input', () => {
    const t = { fontFamily: 'x', fontSize: '1px', fontWeight: 400, lineHeight: '1px' };
    const ok = { colors: { a: '#112233' }, typography: { body: t, 'urdu-body': t }, spacing: {}, rounded: {} };
    expect(() => validate(ok)).not.toThrow();
    expect(() => validate({ ...ok, colors: { a: null } })).toThrow(/colors\.a/);
    expect(() => validate({ ...ok, colors: { a: 'red' } })).toThrow(/colors\.a/);
    expect(() => validate({ ...ok, typography: { body: t } })).toThrow(/urdu-body/);
    expect(() => validate({ ...ok, typography: { ...ok.typography, body: { fontFamily: 'x' } } })).toThrow(/fontSize/);
    expect(() => validate({ ...ok, spacing: undefined })).toThrow(/spacing/);
  });
  it('a missing dark twin is an error', () => {
    expect(() => splitColors({ bg: '#fff', surface: '#eee', 'surface-dark': '#111' })).toThrow(/missing dark/);
  });
});
