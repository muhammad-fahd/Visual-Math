import { describe, expect, it } from 'vitest';
import { applyRateLimit, clientAddress, rateKey, type RateStore } from '../../src/server/ratelimit/core';

const rule = { name: 'log', limit: 3, windowSeconds: 60 };
const req = (headers: Record<string, string> = {}) => new Request('https://site.test/api/log', { method: 'POST', headers });

/** An in-memory store with the same semantics as rate_limit_hit(). */
function memoryStore(now: () => number) {
  const rows = new Map<string, { start: number; count: number }>();
  const keys: string[] = [];
  const store: RateStore = {
    async hit(key, limit, windowSeconds) {
      keys.push(key);
      let r = rows.get(key) ?? { start: now(), count: 0 };
      if (r.start <= now() - windowSeconds * 1000) r = { start: now(), count: 0 };
      const allowed = r.count < limit;
      if (allowed) r.count += 1;
      rows.set(key, r);
      return { allowed, retryAfter: allowed ? 0 : Math.ceil((r.start + windowSeconds * 1000 - now()) / 1000) };
    },
  };
  return { store, keys };
}

describe('clientAddress', () => {
  it('prefers the headers Vercel sets, then the first forwarded entry, then unknown', () => {
    expect(clientAddress(req({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' }))).toBe('1.1.1.1');
    expect(clientAddress(req({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' }))).toBe('2.2.2.2');
    expect(clientAddress(req({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toBe('3.3.3.3');
    expect(clientAddress(req())).toBe('unknown');
  });
});

describe('rateKey', () => {
  it('is a 64-hex hash that hides the address and rotates by day, route and secret', () => {
    const k = rateKey('secret', '2026-01-01', 'log', '203.0.113.9');
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain('203');
    expect(rateKey('secret', '2026-01-02', 'log', '203.0.113.9')).not.toBe(k);
    expect(rateKey('secret', '2026-01-01', 'health', '203.0.113.9')).not.toBe(k);
    expect(rateKey('other', '2026-01-01', 'log', '203.0.113.9')).not.toBe(k);
    expect(rateKey('secret', '2026-01-01', 'log', '203.0.113.10')).not.toBe(k);
    expect(rateKey('secret', '2026-01-01', 'log', '203.0.113.9')).toBe(k);
  });
});

describe('applyRateLimit (NFR-2.8)', () => {
  it('allows up to the limit, then answers 429 with the wait; another address is unaffected', async () => {
    const t = 1_000_000;
    const { store } = memoryStore(() => t);
    const deps = { store, secret: 's', now: () => new Date(t) };
    for (let i = 0; i < 3; i++) expect(await applyRateLimit(deps, req({ 'x-real-ip': '1.1.1.1' }), rule)).toBeNull();
    const blocked = (await applyRateLimit(deps, req({ 'x-real-ip': '1.1.1.1' }), rule))!;
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
    expect(blocked.headers.get('cache-control')).toBe('no-store');
    expect(await blocked.json()).toEqual({ error: { code: 'rate_limited', message: 'Too many requests.', details: { retryAfterSeconds: 60 } } });
    expect(await applyRateLimit(deps, req({ 'x-real-ip': '2.2.2.2' }), rule)).toBeNull();
  });
  it('the window resets', async () => {
    let t = 1_000_000;
    const { store } = memoryStore(() => t);
    const deps = { store, secret: 's', now: () => new Date(t) };
    for (let i = 0; i < 3; i++) await applyRateLimit(deps, req(), rule);
    expect((await applyRateLimit(deps, req(), rule))?.status).toBe(429);
    t += 61_000;
    expect(await applyRateLimit(deps, req(), rule)).toBeNull();
  });
  it('each route has its own bucket', async () => {
    const t = 1_000_000;
    const { store } = memoryStore(() => t);
    const deps = { store, secret: 's' };
    for (let i = 0; i < 3; i++) await applyRateLimit(deps, req(), rule);
    expect((await applyRateLimit(deps, req(), rule))?.status).toBe(429);
    expect(await applyRateLimit(deps, req(), { ...rule, name: 'health' })).toBeNull();
  });
  it('the store only ever sees the hashed key, never the address', async () => {
    const { store, keys } = memoryStore(() => 1);
    await applyRateLimit({ store, secret: 's' }, req({ 'x-real-ip': '203.0.113.9' }), rule);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
  });
  it('when the store fails the request does not go through (503), and never leaks the error', async () => {
    const store: RateStore = { hit: async () => { throw new Error('connection refused to db.internal:5432'); } };
    const res = (await applyRateLimit({ store, secret: 's' }, req(), rule))!;
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/db\.internal|refused/);
  });
  it('on a deployment a missing store or secret stops the request instead of letting it through', async () => {
    expect((await applyRateLimit({ store: null, secret: null, requireStore: true }, req(), rule))?.status).toBe(503);
    expect((await applyRateLimit({ store: memoryStore(() => 1).store, secret: null, requireStore: true }, req(), rule))?.status).toBe(503);
    expect(await applyRateLimit({ store: memoryStore(() => 1).store, secret: 's', requireStore: true }, req(), rule)).toBeNull();
  });
  it('with no database configured nothing is limited (there is nothing to protect yet)', async () => {
    expect(await applyRateLimit({ store: null, secret: null }, req(), rule)).toBeNull();
    expect(await applyRateLimit({ store: memoryStore(() => 1).store, secret: null }, req(), rule)).toBeNull();
  });
  it('a retry-after below one second still says 1', async () => {
    const store: RateStore = { hit: async () => ({ allowed: false, retryAfter: 0.2 }) };
    expect((await applyRateLimit({ store, secret: 's' }, req(), rule))?.headers.get('retry-after')).toBe('1');
  });
});
