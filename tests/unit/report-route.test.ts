import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/report with the server pieces mocked: what is limited, what is stored, what comes back.
const state = vi.hoisted(() => ({
  limit: null as Response | null,
  limitAt: -1,
  limitCalls: [] as { name: string; limit: number; windowSeconds: number }[],
  saved: [] as { topicId: string; reason: string; note: string }[],
  saveOk: true,
}));

vi.mock('@/server/ratelimit', () => ({
  ratelimit: async (_request: Request, rule: { name: string; limit: number; windowSeconds: number }) => {
    state.limitCalls.push(rule);
    return state.limitAt === state.limitCalls.length - 1 ? state.limit : null;
  },
}));
vi.mock('@/server/reports', () => ({
  saveReport: async (input: { topicId: string; reason: string; note: string }) => {
    state.saved.push(input);
    return state.saveOk;
  },
}));

import { POST } from '../../src/app/api/report/route';

const send = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('https://site.test/api/report', {
      method: 'POST',
      headers: { origin: 'https://site.test', 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
const good = { topicId: 'geo-cone-volume', reason: 'wrong-math', note: 'The volume is off' };

beforeEach(() => {
  state.limit = null;
  state.limitAt = -1;
  state.limitCalls = [];
  state.saved = [];
  state.saveOk = true;
});

describe('a report that is stored', () => {
  it('is 204 with no body and no cache, and stores the topic id, the reason and the cleaned note only', async () => {
    const res = await send({ ...good, note: '  The‮ volume\n is   off ' });
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
    expect(state.saved).toEqual([{ topicId: 'geo-cone-volume', reason: 'wrong-math', note: 'The volume is off' }]);
  });
  it('is limited twice, overall first and then for the topic, before anything is stored', async () => {
    await send(good);
    expect(state.limitCalls).toEqual([
      { name: 'report', limit: 6, windowSeconds: 600 },
      { name: expect.stringMatching(/^report-[0-9a-f]{24}$/), limit: 2, windowSeconds: 600 },
    ]);
  });
  it('two long topic ids with the same start do not share a limit; the same id always does', async () => {
    const long = (tail: string) => `${'a'.repeat(60)}${tail}`;
    await send({ ...good, topicId: long('xxxx') });
    await send({ ...good, topicId: long('yyyy') });
    await send({ ...good, topicId: long('xxxx') });
    const names = state.limitCalls.filter((c) => c.name !== 'report').map((c) => c.name);
    expect(names[0]).not.toBe(names[1]);
    expect(names[0]).toBe(names[2]);
  });
  it('an empty note is fine for a reason that is not "something else"', async () => {
    expect((await send({ ...good, reason: 'unclear', note: '' })).status).toBe(204);
    expect(state.saved[0]!.note).toBe('');
  });
  it('junk characters do not count toward the 500: 500 good characters among them are accepted, 501 are not', async () => {
    const noisy = (n: number) => Array.from({ length: n }, () => 'a​').join('');
    expect((await send({ ...good, note: noisy(500) })).status).toBe(204);
    expect(state.saved[0]!.note).toHaveLength(500);
    const over = await send({ ...good, note: noisy(501) });
    expect(over.status).toBe(400);
    expect((await over.json()).error.code).toBe('note_too_long');
  });
  it('the same report twice goes to the store both times: the database groups it, the sender sees the thanks', async () => {
    expect((await send(good)).status).toBe(204);
    expect((await send(good)).status).toBe(204);
    expect(state.saved).toHaveLength(2);
  });
});

describe('a report that is refused', () => {
  it('too many sends: the limiter answer is returned as it is and nothing is stored', async () => {
    state.limit = Response.json({ error: { code: 'rate_limited' } }, { status: 429, headers: { 'Retry-After': '30' } });
    state.limitAt = 0;
    const res = await send(good);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(state.saved).toEqual([]);
    expect(state.limitCalls).toHaveLength(1); // the body is not even read
  });
  it('a refused note does not use up the per-topic quota: it is checked before that limit', async () => {
    await send({ ...good, note: 'a'.repeat(501) });
    await send({ ...good, reason: 'other', note: '' });
    expect(state.limitCalls.filter((c) => c.name !== 'report')).toEqual([]);
  });
  it('too many sends for one topic', async () => {
    state.limit = Response.json({ error: { code: 'rate_limited' } }, { status: 429 });
    state.limitAt = 1;
    expect((await send(good)).status).toBe(429);
    expect(state.saved).toEqual([]);
  });
  it('a note over 500 characters is 400 with a short message', async () => {
    const res = await send({ ...good, note: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'note_too_long', message: 'The note is too long.' } });
    expect(state.saved).toEqual([]);
  });
  it('"something else" needs a note; spaces and junk alone are not a note', async () => {
    for (const note of ['', '   ', '‮​']) {
      const res = await send({ ...good, reason: 'other', note });
      expect(res.status, JSON.stringify(note)).toBe(400);
      expect((await res.json()).error.code).toBe('note_required');
    }
    expect(state.saved).toEqual([]);
  });
  it.each([
    ['an extra key', { ...good, email: 'a@b.c' }],
    ['no reason', { topicId: good.topicId, note: 'x' }],
    ['an unknown reason', { ...good, reason: 'spam' }],
    ['a topic id with capitals', { ...good, topicId: 'Geo-Cone' }],
    ['a topic id that is a path', { ...good, topicId: '../etc/passwd' }],
    ['a note that is not text', { ...good, note: 5 }],
    ['a raw note over 2000', { ...good, note: 'a'.repeat(2001) }],
    ['an array', [good]],
  ])('%s is 400 and stores nothing', async (_name, body) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_body');
    expect(state.saved).toEqual([]);
  });
  it('not JSON is 400, a wrong content type is 415, a foreign or missing origin is 403, a huge body is 413', async () => {
    expect((await send('not json')).status).toBe(400);
    expect((await send(good, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await send(good, { origin: 'https://evil.test' })).status).toBe(403);
    const noOrigin = await POST(new Request('https://site.test/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(good) }));
    expect(noOrigin.status).toBe(403);
    expect((await send({ ...good, note: 'a'.repeat(9000) })).status).toBe(413);
    expect(state.saved).toEqual([]);
  });
  it('the store failing is 503 with nothing about why; the note is not echoed', async () => {
    state.saveOk = false;
    const res = await send({ ...good, note: 'my secret words' });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'unavailable', message: 'Try again shortly.' } });
    expect(text).not.toContain('secret');
  });
  it('an exception inside is 500 with a request id and no detail', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.limitAt = -1;
    const original = state.saved.push.bind(state.saved);
    state.saved.push = () => {
      throw new Error('connection string postgres://user:pw@host');
    };
    const res = await send(good);
    state.saved.push = original;
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('postgres');
  });
});
