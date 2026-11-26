// Fails if a visitor page that must be static has become dynamic (AD-10). Run after `next build`.
// Every locale's pages listed below must be in the prerender manifest. As visitor routes are added, list them in PAGES.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST = join('.next', 'prerender-manifest.json');
export const PAGES = ['']; // '' is the locale home; later stories add 'topics', 'search', ...

/** The locale list is read from the single source of truth, src/i18n/locales.ts, so a new language is checked too. */
export function readLocales(source = readFileSync(join('src', 'i18n', 'locales.ts'), 'utf8')) {
  const m = /export const LOCALES = \[([^\]]*)\]/.exec(source);
  if (!m) throw new Error('cannot find LOCALES in src/i18n/locales.ts');
  const list = [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
  if (list.length === 0) throw new Error('LOCALES is empty');
  return list;
}

export function missingRoutes(prerendered, locales, pages = PAGES) {
  const have = new Set(prerendered);
  return locales.flatMap((l) => pages.map((p) => `/${l}${p ? `/${p}` : ''}`)).filter((r) => !have.has(r));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(MANIFEST)) {
    console.error(`${MANIFEST} not found: run \`next build\` first`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const missing = missingRoutes(Object.keys(manifest.routes ?? {}), readLocales());
  if (missing.length) {
    console.error(`Not statically prerendered (must be static, AD-10): ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('static routes ok');
}
