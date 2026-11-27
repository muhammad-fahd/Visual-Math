import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES } from '../../src/i18n/locales';
import { MESSAGE_LOCALES, merge, messagesFor, type Tree } from '../../src/i18n/messages';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { i18n } from '../../src/i18n/support';
import { createLocaleSupport } from '../../src/lib/i18n/locale-support';
import { negotiateLocale, parseAcceptLanguage } from '../../src/lib/i18n/negotiate';
import { PAGES, missingRoutes, readLocales } from '../../scripts/check-static-routes.mjs';

const pick = (h: string | null | undefined) => negotiateLocale(h, LOCALES, DEFAULT_LOCALE);

describe('Accept-Language negotiation (FR-6.3)', () => {
  it('Urdu browser -> ur', () => expect(pick('ur-PK,en;q=0.5')).toBe('ur'));
  it('plain ur and uppercase tags', () => {
    expect(pick('ur')).toBe('ur');
    expect(pick('UR-pk')).toBe('ur');
  });
  it('unsupported or missing -> English', () => {
    expect(pick('fr-FR')).toBe('en');
    expect(pick('')).toBe('en');
    expect(pick(null)).toBe('en');
    expect(pick(undefined)).toBe('en');
  });
  it('quality values decide, not order', () => expect(pick('en;q=0.4, ur;q=0.9')).toBe('ur'));
  it('q=0 means not acceptable', () => expect(pick('ur;q=0, en')).toBe('en'));
  it('first of equal quality wins', () => expect(pick('ur, en')).toBe('ur'));
  it('wildcard alone falls back to the default', () => expect(pick('*')).toBe('en'));
  it('malformed input never throws and falls back', () => {
    for (const h of [';;;', 'ur;q=abc', 'ur;q=9', ',,,', '\u0000', 'x'.repeat(5000), 'ur;q=-1']) {
      expect(() => pick(h), h.slice(0, 10)).not.toThrow();
    }
    expect(pick('ur;q=9')).toBe('en');
    expect(pick('x'.repeat(5000))).toBe('en');
  });
  it('a long header is cut, not ignored: an early ur still wins', () => {
    expect(pick('ur,' + 'x-'.repeat(2000))).toBe('ur');
  });
  it('parses ranges in quality order', () => {
    expect(parseAcceptLanguage('en;q=0.1, ur;q=0.8').map((r) => r.tag)).toEqual(['ur', 'en']);
  });
});

describe('locale support', () => {
  it('knows the two launch locales and their direction', () => {
    expect([...i18n.locales]).toEqual(['en', 'ur']);
    expect(i18n.direction('ur')).toBe('rtl');
    expect(i18n.direction('en')).toBe('ltr');
    expect(i18n.direction('ur-PK')).toBe('rtl');
  });
  it('a valid cookie beats Accept-Language; an invalid cookie is ignored', () => {
    expect(i18n.resolveLocale({ cookie: 'ur', acceptLanguage: 'en' })).toBe('ur');
    expect(i18n.resolveLocale({ cookie: 'en', acceptLanguage: 'ur' })).toBe('en');
    expect(i18n.resolveLocale({ cookie: 'xx', acceptLanguage: 'ur' })).toBe('ur');
    expect(i18n.resolveLocale({ cookie: undefined, acceptLanguage: undefined })).toBe('en');
  });
  it('swaps the locale in any path and keeps the rest', () => {
    expect(i18n.swapLocale('/en', 'ur')).toBe('/ur');
    expect(i18n.swapLocale('/en/', 'ur')).toBe('/ur/');
    expect(i18n.swapLocale('/en/topic/abc', 'ur')).toBe('/ur/topic/abc');
    expect(i18n.swapLocale('/ur/search', 'en')).toBe('/en/search');
    expect(i18n.swapLocale('/', 'ur')).toBe('/ur');
    expect(i18n.swapLocale('/about', 'ur')).toBe('/ur/about');
    expect(i18n.swapLocale('/english/x', 'ur')).toBe('/ur/english/x'); // not a locale prefix
  });
  it('reads the locale of a path', () => {
    expect(i18n.localeFromPath('/ur/x')).toBe('ur');
    expect(i18n.localeFromPath('/fr/x')).toBeNull();
    expect(i18n.localeFromPath('/')).toBeNull();
  });
});

describe('a new language needs only the list and a message file (NFR-7.4)', () => {
  const fake = createLocaleSupport(['en', 'ur', 'xx'] as const, 'en');
  it('is negotiated, routed and resolved with no other code', () => {
    expect(negotiateLocale('xx-YY', fake.locales, 'en')).toBe('xx');
    expect(fake.isLocale('xx')).toBe(true);
    expect(fake.swapLocale('/en/a', 'xx')).toBe('/xx/a');
    expect(fake.resolveLocale({ cookie: 'xx' })).toBe('xx');
  });
  it('known right-to-left languages mirror without new code', () => {
    expect(createLocaleSupport(['en', 'fa'] as const, 'en').direction('fa')).toBe('rtl');
  });
  it('a locale without a message file falls back to English', () => {
    expect(messagesFor('xx')).toEqual(en);
  });
});

describe('message files (FR-6.5): every Urdu string exists for every English one', () => {
  const keys = (o: unknown, prefix = ''): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  const flat = (o: unknown, prefix = ''): Record<string, string> =>
    Object.fromEntries(
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null ? Object.entries(flat(v, `${prefix}${k}.`)) : [[`${prefix}${k}`, String(v)]],
      ),
    );
  it('every English key exists in Urdu and vice versa (the failure names the keys)', () => {
    const e = new Set(keys(en));
    const u = new Set(keys(ur));
    expect([...e].filter((k) => !u.has(k)), 'missing in Urdu').toEqual([]);
    expect([...u].filter((k) => !e.has(k)), 'only in Urdu').toEqual([]);
  });
  it('placeholders such as {count} match between English and Urdu', () => {
    const tokens = (t: string) => [...t.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
    const fe = flat(en);
    const fu = flat(ur);
    for (const k of Object.keys(fe)) expect(tokens(fu[k] ?? ''), k).toEqual(tokens(fe[k]!));
  });
  it('no empty strings', () => {
    for (const [k, v] of [...Object.entries(flat(en)), ...Object.entries(flat(ur))]) expect(v.trim(), k).not.toBe('');
  });
  it('every configured locale has a message file', () => {
    for (const l of LOCALES) expect(MESSAGE_LOCALES).toContain(l);
  });
  it('language names are shown in their own language in both files', () => {
    expect(en.language.en).toBe('English');
    expect(en.language.ur).toBe('اردو');
    expect(ur.language.en).toBe('English');
    expect(ur.language.ur).toBe('اردو');
  });
});

describe('English fallback for a missing key (matrix row)', () => {
  const base: Tree = { theme: { label: 'Theme', light: 'Light' }, site: { name: 'Visual Math' } };
  it('keeps the English value where the override lacks a key, and takes the override where present', () => {
    const merged = merge(base, { theme: { label: 'X' } }) as { theme: { label: string; light: string }; site: { name: string } };
    expect(merged.theme.label).toBe('X');
    expect(merged.theme.light).toBe('Light');
    expect(merged.site.name).toBe('Visual Math');
  });
  it('does not mutate the base and ignores __proto__ and arrays', () => {
    const over = JSON.parse('{"__proto__": {"polluted": "yes"}, "theme": ["not", "a", "tree"]}') as Tree;
    const merged = merge(base, over);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(merged.theme).toEqual(base.theme);
    expect(base.theme).toEqual({ label: 'Theme', light: 'Light' });
  });
  it('messagesFor returns a full tree for each configured locale', () => {
    for (const l of LOCALES) expect(Object.keys(messagesFor(l))).toEqual(Object.keys(en));
  });
});

describe('static route guard (AD-10)', () => {
  it('reads the locale list from src/i18n/locales.ts, the single source', () => {
    expect(readLocales()).toEqual([...LOCALES]);
  });
  it('picks up a new locale from the list text', () => {
    expect(readLocales("export const LOCALES = ['en', 'ur', 'xx'] as const;")).toEqual(['en', 'ur', 'xx']);
  });
  it('passes when every locale home is prerendered', () => {
    expect(missingRoutes(['/en', '/ur', '/_not-found'], ['en', 'ur'])).toEqual([]);
  });
  it('names a route that went dynamic', () => {
    expect(missingRoutes(['/en'], ['en', 'ur'])).toEqual(['/ur']);
  });
  it('checks listed pages per locale', () => {
    expect(missingRoutes(['/en', '/ur', '/en/topics'], ['en', 'ur'], ['', 'topics'])).toEqual(['/ur/topics']);
  });
  it('PAGES includes the locale home', () => expect(PAGES).toContain(''));

  describe('the script itself exits correctly', () => {
    const script = resolve('scripts/check-static-routes.mjs');
    const run = (routes: string[] | null) => {
      const dir = mkdtempSync(join(tmpdir(), 'vm-static-'));
      mkdirSync(join(dir, 'src', 'i18n'), { recursive: true });
      writeFileSync(join(dir, 'src', 'i18n', 'locales.ts'), "export const LOCALES = ['en', 'ur'] as const;\n");
      if (routes) {
        mkdirSync(join(dir, '.next'), { recursive: true });
        writeFileSync(join(dir, '.next', 'prerender-manifest.json'), JSON.stringify({ routes: Object.fromEntries(routes.map((r) => [r, {}])) }));
      }
      return spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8', env: { ...process.env, NEXT_DIST_DIR: '' } });
    };
    it('exit 0 when both locales are static', () => {
      const r = run(['/en', '/ur']);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/static routes ok/);
    });
    it('exit 1 and names the route when one is missing', () => {
      const r = run(['/en']);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/\/ur/);
    });
    it('exit 1 when there is no build', () => {
      expect(run(null).status).toBe(1);
    });
  });
});
