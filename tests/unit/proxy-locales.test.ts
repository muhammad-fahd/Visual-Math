import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/server/admin/session-refresh', () => ({ refreshAdminSession: () => new Response(null, { status: 204 }) }));
import { NextRequest } from 'next/server';
import { LOCALES } from '../../src/i18n/locales';
import { config, proxy } from '../../src/proxy';

// Story 5.1: an address in a language that does not exist is answered by the proxy (the locale layout cannot do
// it with `dynamicParams = false`), and the matcher must never catch a supported language or a file.
const catchAll = new RegExp(`^${config.matcher[2]}$`);
const matched = (path: string) => config.matcher.slice(0, 2).some((m) => new RegExp(`^${m.replace(':path*', '.*')}$`).test(path)) || catchAll.test(path);
const run = async (path: string) => (await proxy(new NextRequest(`http://localhost${path}`))) as Response;

describe('the proxy matcher', () => {
  it('names exactly the supported languages', () => {
    const named = /\(\?!\(\?:([a-z|]+)\)/.exec(config.matcher[2]!)![1]!.split('|');
    expect(named.sort()).toEqual([...LOCALES].sort());
  });
  it('catches an unsupported language, at any depth', () => {
    for (const p of ['/fr', '/fr/geometry', '/de/a/b/c', '/english', '/urdu/x']) expect(catchAll.test(p), p).toBe(true);
  });
  it('never catches a supported language, the admin area, the API, build files, fonts or a file', () => {
    for (const p of ['/en', '/ur', '/en/geometry', '/ur/geometry/x/y', '/admin', '/admin/sign-in', '/api/health', '/_next/static/a.js', '/fonts/a.woff2', '/favicon.ico', '/robots.txt']) expect(catchAll.test(p), p).toBe(false);
  });
  it('still catches the root and the admin area for their own jobs', () => {
    expect(matched('/')).toBe(true);
    expect(matched('/admin/x')).toBe(true);
  });
});

describe('the proxy', () => {
  it('the rewrite target is deeper than any page under [locale], so no route can match it', async () => {
    const { readdirSync } = await import('node:fs');
    const depth = (dir: string): number => 1 + Math.max(0, ...readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => depth(`${dir}/${e.name}`)));
    expect(depth('src/app/[locale]')).toBeLessThan(6); // [locale] itself plus its deepest chain; the target has 6 segments
  });
  it('rewrites an unsupported language to a path no route matches', async () => {
    const res = await run('/fr/geometry');
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/__unsupported-locale\/a\/b\/c\/d\/e$/);
  });
  it('lets a supported language through, and still redirects the root', async () => {
    expect((await run('/en/geometry')).headers.get('x-middleware-next')).toBe('1');
    expect((await run('/')).status).toBe(307);
  });
});
