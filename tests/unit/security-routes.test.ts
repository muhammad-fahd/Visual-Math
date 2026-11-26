import { beforeEach, describe, expect, it, vi } from 'vitest';

// /api/health and /api/log with the server pieces mocked: what is stored, what is returned, what is limited.
const state = vi.hoisted(() => ({
  limited: null as Response | null,
  health: { status: 200, body: { status: 'ok', db: 'ok' } } as { status: number; body: unknown },
  recorded: [] as unknown[],
  storeOk: true,
  limitCalls: [] as unknown[],
}));

vi.mock('@/server/ratelimit', () => ({
  ratelimit: async (_request: Request, rule: unknown) => {
    state.limitCalls.push(rule);
    return state.limited;
  },
}));
vi.mock('@/server/health', () => ({ checkHealth: async () => state.health }));
vi.mock('@/server/errorlog', () => ({
  recordError: async (input: unknown) => {
    state.recorded.push(input);
    return state.storeOk;
  },
}));

import { GET as healthGet } from '../../src/app/api/health/route';
import { POST as logPost } from '../../src/app/api/log/route';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://site.test/api/log', {
    method: 'POST',
    headers: { origin: 'https://site.test', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  state.limited = null;
  state.health = { status: 200, body: { status: 'ok', db: 'ok' } };
  state.recorded = [];
  state.storeOk = true;
  state.limitCalls = [];
});

describe('GET /api/health', () => {
  it('is readable by a monitor: 200, no-store, only status and db', async () => {
    const res = await healthGet(new Request('https://site.test/api/health'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
  });
  it('database down is 503 so the monitor alerts; the body stays private', async () => {
    state.health = { status: 503, body: { status: 'down', db: 'down' } };
    const res = await healthGet(new Request('https://site.test/api/health'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'down', db: 'down' });
  });
  it('is rate limited, and the limit is returned as is', async () => {
    state.limited = Response.json({ error: { code: 'rate_limited' } }, { status: 429 });
    expect((await healthGet(new Request('https://site.test/api/health'))).status).toBe(429);
    expect(state.limitCalls).toEqual([{ name: 'health', limit: 60, windowSeconds: 60 }]);
  });
});

describe('POST /api/log (AD-26)', () => {
  it('stores one entry and answers 204 with an empty body', async () => {
    const res = await logPost(post({ message: 'boom', path: '/en/topic/a?x=1', detail: 'at f (a.js:1:1)' }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0]).toMatchObject({ kind: 'client', message: 'boom', path: '/en/topic/a?x=1' });
    expect((state.recorded[0] as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('passes only the fields it declares: nothing from headers (IP, cookie, user agent) reaches the store', async () => {
    await logPost(post({ message: 'boom' }, { 'x-real-ip': '203.0.113.9', cookie: 'vm-locale=ur; sb-x=secret', 'user-agent': 'Mozilla/5.0 Secret' }));
    const dump = JSON.stringify(state.recorded);
    expect(dump).not.toMatch(/203\.0\.113|secret|Mozilla|vm-locale/i);
    expect(Object.keys(state.recorded[0] as object).sort()).toEqual(['detail', 'kind', 'message', 'path', 'requestId']);
  });
  it('refuses a body with unknown fields, wrong types, or no message', async () => {
    for (const bad of [{ message: 'x', ip: '1.1.1.1' }, { message: 1 }, {}, { path: '/x' }, '{', 'null']) {
      expect((await logPost(post(bad as never))).status, JSON.stringify(bad)).toBe(400);
    }
    expect(state.recorded).toHaveLength(0);
  });
  it('refuses cross-origin and non-JSON posts, and bodies that are too large', async () => {
    expect((await logPost(post({ message: 'x' }, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await logPost(post({ message: 'x' }, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await logPost(post({ message: 'a b '.repeat(20000) }))).status).toBe(413);
    expect(state.recorded).toHaveLength(0);
  });
  it('is rate limited before anything is read or stored', async () => {
    state.limited = Response.json({ error: { code: 'rate_limited' } }, { status: 429 });
    expect((await logPost(post({ message: 'x' }))).status).toBe(429);
    expect(state.recorded).toHaveLength(0);
    expect(state.limitCalls).toEqual([{ name: 'log', limit: 20, windowSeconds: 60 }]);
  });
  it('a failing store is 503, not a silent success', async () => {
    state.storeOk = false;
    expect((await logPost(post({ message: 'x' }))).status).toBe(503);
  });
});
