import { test, expect, type Page } from '@playwright/test';
import { PREPAINT_SCRIPT } from '../../src/lib/theme/prepaint';

// Story 1.6: the production build is served by `npm run start`, so these see the real headers.
// Policy (owner decision 2026-11-26): script-src is 'self' 'unsafe-inline', so instead of a hash per
// inline script we assert WHICH inline scripts exist: ours, or Next's framework scripts.

const PAGES = ['/en', '/ur', '/fr', '/admin', '/admin/sign-in'];

const NEXT_INLINE = [
  /^\(self\.__next_f\s*=\s*self\.__next_f\s*\|\|\s*\[\]\)\.push\(/,
  /^\(globalThis\["TURBOPACK"\]\s*\|\|\s*\(globalThis\["TURBOPACK"\]\s*=\s*\[\]\)\)\.push\(/,
];

/** Next's flight data is `self.__next_f.push([...])` with a JSON argument: parse it, so only data passes. */
function isNextFramework(script: string): boolean {
  const text = script.trim();
  const push = /^self\.__next_f\.push\((\[[\s\S]*\])\)$/.exec(text);
  if (push) {
    try {
      return Array.isArray(JSON.parse(push[1]!));
    } catch {
      return false;
    }
  }
  return NEXT_INLINE.some((re) => re.test(text));
}

async function watch(page: Page, baseURL: string) {
  const external: string[] = [];
  const consoleCsp: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== new URL(baseURL).origin) external.push(r.url());
  });
  page.on('console', (m) => {
    if (/content security policy|refused to (load|execute|apply|connect)/i.test(m.text())) consoleCsp.push(m.text());
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return { external, consoleCsp };
}

for (const path of PAGES) {
  test.describe(`security of ${path}`, () => {
    test('no third-party request and no CSP violation', async ({ page, baseURL }) => {
      const seen = await watch(page, baseURL!);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(seen.external, 'third-party requests').toEqual([]);
      expect(seen.consoleCsp, 'CSP messages in the console').toEqual([]);
      expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), 'securitypolicyviolation events').toEqual([]);
    });

    test('every inline script is the pre-paint script or a Next framework script', async ({ page }) => {
      await page.goto(path);
      const scripts = await page.evaluate(() => [...document.scripts].filter((s) => !s.src).map((s) => s.textContent ?? ''));
      expect(scripts.length).toBeGreaterThan(0);
      const unknown = scripts.filter((s) => s !== PREPAINT_SCRIPT && !isNextFramework(s));
      expect(unknown.map((s) => s.slice(0, 80))).toEqual([]);
    });
  });
}

test.describe('headers (AD-17)', () => {
  for (const path of PAGES) {
    test(`${path} sends the CSP and the other security headers`, async ({ request }) => {
      const res = await request.get(path);
      const h = res.headers();
      const csp = h['content-security-policy'] ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).not.toMatch(/'nonce-|'sha\d+-|unsafe-eval|\*/);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(h['permissions-policy']).toContain('camera=()');
    });
  }
  test('only the admin area may load data: images', async ({ request }) => {
    expect((await request.get('/admin/sign-in')).headers()['content-security-policy']).toMatch(/img-src 'self' data:/);
    for (const path of ['/en', '/ur', '/fr']) expect((await request.get(path)).headers()['content-security-policy']).not.toContain('data:');
  });
  test('a path that only starts with admin gets the visitor policy', async ({ request }) => {
    const csp = (await request.get('/administrators')).headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/img-src 'self'(?: https:\/\/[^;\s]+)?;/);
    expect(csp).not.toContain('data:');
  });
  test('API responses carry the headers too', async ({ request }) => {
    expect((await request.get('/api/health')).headers()['content-security-policy']).toContain("default-src 'self'");
  });
});

test.describe('the CSP is live: foreign scripts and form posts are blocked', () => {
  test('a script from another origin does not run', async ({ page }) => {
    await page.goto('/en');
    const ran = await page.evaluate(async () => {
      const s = document.createElement('script');
      s.src = 'https://example.com/x.js';
      const result = new Promise<string>((resolve) => {
        s.onerror = () => resolve('blocked');
        s.onload = () => resolve('ran');
      });
      document.head.append(s);
      return result;
    });
    expect(ran).toBe('blocked');
  });
  test('a form cannot post to another origin and a frame cannot embed the site', async ({ page, request }) => {
    await page.goto('/en');
    const blocked = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          document.addEventListener('securitypolicyviolation', (e) => resolve(e.violatedDirective));
          const f = document.createElement('form');
          f.action = 'https://example.com/steal';
          f.method = 'post';
          document.body.append(f);
          f.submit();
          setTimeout(() => resolve('none'), 2000);
        }),
    );
    expect(blocked).toBe('form-action');
    expect((await request.get('/en')).headers()['x-frame-options']).toBe('DENY');
  });
});

test.describe('/api/health (AD-26)', () => {
  test('a monitor can read it: 200, JSON, never cached, nothing sensitive', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toBe('no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['db', 'status']);
    expect(body.status).toBe('ok');
    expect(JSON.stringify(body)).not.toMatch(/supabase|postgres|key|version/i);
  });
  test('only GET is allowed', async ({ request, baseURL }) => {
    expect((await request.post('/api/health', { headers: { origin: baseURL! }, data: {} })).status()).toBe(405);
  });
});

test.describe('/api/log (AD-26)', () => {
  const headers = (baseURL: string) => ({ origin: baseURL, 'content-type': 'application/json' });
  test('accepts a scrubbed error with 204 and an empty body', async ({ request, baseURL }) => {
    const res = await request.post('/api/log', { headers: headers(baseURL!), data: { message: 'boom', path: '/en/topic/a' } });
    expect(res.status()).toBe(204);
    expect(await res.text()).toBe('');
  });
  test('refuses another origin, bad JSON, extra fields and oversize bodies', async ({ request, baseURL }) => {
    expect((await request.post('/api/log', { headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, data: { message: 'x' } })).status()).toBe(403);
    expect((await request.post('/api/log', { headers: headers(baseURL!), data: { message: 'x', ip: '1.1.1.1' } })).status()).toBe(400);
    expect((await request.post('/api/log', { headers: headers(baseURL!), data: { message: 'a b '.repeat(20000) } })).status()).toBe(413);
  });
  test('the error envelope never carries database or stack text', async ({ request, baseURL }) => {
    const res = await request.post('/api/log', { headers: headers(baseURL!), data: { nope: 1 } });
    expect(JSON.stringify(await res.json())).not.toMatch(/postgres|supabase|at .*\(.*:\d+:\d+\)/i);
  });
});
