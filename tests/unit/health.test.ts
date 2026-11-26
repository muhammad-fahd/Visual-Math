import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../../src/db/admin', () => ({ adminClient: () => state.client }));

import { checkHealth } from '../../src/server/health';

const clientWith = (result: Promise<{ error: unknown }> | (() => Promise<{ error: unknown }>)) => ({
  from: () => ({ select: () => ({ limit: () => (typeof result === 'function' ? result() : result) }) }),
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('VERCEL_ENV', '');
  state.client = null;
});
afterEach(() => vi.useRealTimers());

describe('checkHealth (AD-26)', () => {
  it('ok when the seeded table answers', async () => {
    state.client = clientWith(Promise.resolve({ error: null }));
    expect(await checkHealth()).toEqual({ status: 200, body: { status: 'ok', db: 'ok' } });
  });
  it('down on a database error, a rejection, or no answer within three seconds', async () => {
    state.client = clientWith(Promise.resolve({ error: { message: 'secret detail' } }));
    expect(await checkHealth()).toEqual({ status: 503, body: { status: 'down', db: 'down' } });
    state.client = clientWith(() => Promise.reject(new Error('refused')));
    expect(await checkHealth()).toEqual({ status: 503, body: { status: 'down', db: 'down' } });
    vi.useFakeTimers();
    state.client = clientWith(new Promise(() => undefined)); // never answers
    const pending = checkHealth();
    await vi.advanceTimersByTimeAsync(3001);
    expect(await pending).toEqual({ status: 503, body: { status: 'down', db: 'down' } });
  });
  it('the body never carries the error text', async () => {
    state.client = clientWith(Promise.resolve({ error: { message: 'relation "category" does not exist' } }));
    expect(JSON.stringify(await checkHealth())).not.toContain('relation');
  });
  it('unconfigured is fine locally but down on a deployment', async () => {
    expect(await checkHealth()).toEqual({ status: 200, body: { status: 'ok', db: 'unconfigured' } });
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await checkHealth()).toEqual({ status: 503, body: { status: 'down', db: 'unconfigured' } });
  });
});
