import { beforeEach, describe, expect, it, vi } from 'vitest';

// The glue between the rate_limit_hit RPC and applyRateLimit: what the real ratelimit() does with
// what the database returns. A wrong column name or shape here would switch the limiter off or on.
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  client: true,
  env: true,
}));

vi.mock('../../src/db/admin', () => ({ adminClient: () => (state.client ? { rpc: state.rpc } : null) }));
vi.mock('../../src/db/env', () => ({
  dbEnv: () => (state.env ? { SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(30) } : null),
}));

import { ratelimit } from '../../src/server/ratelimit';

const rule = { name: 'sign-in', limit: 10, windowSeconds: 900 };
const req = (headers: Record<string, string> = {}) => new Request('https://site.test/api/x', { method: 'POST', headers });

beforeEach(() => {
  state.rpc = vi.fn();
  state.client = true;
  state.env = true;
  vi.unstubAllEnvs();
  vi.stubEnv('VERCEL_ENV', '');
});

describe('ratelimit() against the rate_limit_hit RPC', () => {
  it('calls the function with a hashed key and the rule, and lets an allowed request through', async () => {
    state.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });
    expect(await ratelimit(req({ 'x-real-ip': '203.0.113.9' }), rule)).toBeNull();
    const [fn, args] = state.rpc.mock.calls[0]!;
    expect(fn).toBe('rate_limit_hit');
    expect(args).toMatchObject({ p_limit: 10, p_window_seconds: 900 });
    expect(args.p_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain('203.0.113.9');
  });
  it('a refused row is a 429 with the wait from retry_after', async () => {
    state.rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 7 }], error: null });
    const res = (await ratelimit(req(), rule))!;
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('7');
  });
  it.each([
    ['an RPC error', { data: null, error: { message: 'boom' } }],
    ['no rows', { data: [], error: null }],
    ['a non-array answer', { data: { allowed: true }, error: null }],
    ['a row without a boolean', { data: [{ allowed: 'yes' }], error: null }],
    ['a null answer', { data: null, error: null }],
  ])('%s is a 503, never a pass-through', async (_name, answer) => {
    state.rpc.mockResolvedValue(answer);
    expect((await ratelimit(req(), rule))?.status).toBe(503);
  });
  it('a thrown RPC is a 503 too', async () => {
    state.rpc.mockRejectedValue(new Error('network'));
    expect((await ratelimit(req(), rule))?.status).toBe(503);
  });
  it('locally, with no database configured, nothing is limited', async () => {
    state.client = false;
    state.env = false;
    expect(await ratelimit(req(), rule)).toBeNull();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('on a deployment (VERCEL_ENV set) no database configuration stops the request', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    state.client = false;
    state.env = false;
    expect((await ratelimit(req(), rule))?.status).toBe(503);
    state.client = true;
    state.env = false; // a client but no secret
    expect((await ratelimit(req(), rule))?.status).toBe(503);
  });
});
