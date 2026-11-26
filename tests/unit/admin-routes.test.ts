import { beforeEach, describe, expect, it, vi } from 'vitest';

// The handlers' only logic is mapping a flow result to HTTP. The flow itself is mocked here.
const flow = vi.hoisted(() => ({ signIn: vi.fn(), enrol: vi.fn(), verifyCode: vi.fn(), recover: vi.fn() }));
const auth = vi.hoisted(() => ({ session: vi.fn(), signOut: vi.fn() }));
const configured = vi.hoisted(() => ({ value: true }));
vi.mock('@/server/admin', () => ({
  adminConfigured: () => configured.value,
  adminDeps: async () => ({ auth, store: {} }),
}));
vi.mock('@/server/admin/auth-flow', () => flow);

import { POST as signInPost } from '../../src/app/api/admin/auth/sign-in/route';
import { POST as verifyPost } from '../../src/app/api/admin/auth/mfa/verify/route';
import { POST as recoverPost } from '../../src/app/api/admin/auth/recover/route';
import { POST as enrollPost } from '../../src/app/api/admin/auth/mfa/enroll/route';
import { POST as signOutPost } from '../../src/app/api/admin/auth/sign-out/route';

const post = (path: string, body: unknown) =>
  new Request(`https://site.test${path}`, { method: 'POST', headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  configured.value = true;
});

type Case = [string, (r: Request) => Promise<Response>, string, unknown, () => ReturnType<typeof vi.fn>, unknown, unknown];
const cases: Case[] = [
  ['sign-in', signInPost, '/api/admin/auth/sign-in', { email: 'a@b.co', password: 'x' }, () => flow.signIn, { status: 'ok', next: 'verify' }, { next: 'verify' }],
  ['verify', verifyPost, '/api/admin/auth/mfa/verify', { code: '123456' }, () => flow.verifyCode, { status: 'ok', recoveryCodes: ['A'] }, { recoveryCodes: ['A'] }],
  ['recover', recoverPost, '/api/admin/auth/recover', { code: 'ABCDE-FGHJK' }, () => flow.recover, { status: 'ok', next: 'enroll' }, { next: 'enroll' }],
];

describe.each(cases)('%s handler maps results to HTTP', (_name, handler, path, body, fn, okResult, okBody) => {
  it('locked is 429 with the wait in the header and the details', async () => {
    fn().mockResolvedValue({ status: 'locked', retryAfterSeconds: 900 });
    const res = await handler(post(path, body));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('900');
    expect(await res.json()).toEqual({ error: { code: 'locked', message: 'Too many attempts.', details: { retryAfterSeconds: 900 } } });
  });
  it('invalid is one generic 401', async () => {
    fn().mockResolvedValue({ status: 'invalid' });
    const res = await handler(post(path, body));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('invalid_credentials');
  });
  it('ok is 200 with the body, never cached', async () => {
    fn().mockResolvedValue(okResult);
    const res = await handler(post(path, body));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual(okBody);
  });
  it('an exception is a 500 with a request id and nothing else', async () => {
    fn().mockRejectedValue(new Error('secret database detail'));
    const res = await handler(post(path, body));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('requestId');
    expect(text).not.toContain('secret database detail');
  });
});

describe('the rest', () => {
  it('verify and recover: denied is 401 unauthorized', async () => {
    flow.verifyCode.mockResolvedValue({ status: 'denied' });
    flow.recover.mockResolvedValue({ status: 'denied' });
    for (const res of [await verifyPost(post('/x', { code: '123456' })), await recoverPost(post('/x', { code: 'x' }))]) {
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe('unauthorized');
    }
  });
  it('verify refuses a code that is not six digits before running anything', async () => {
    expect((await verifyPost(post('/x', { code: 'abcdef' }))).status).toBe(400);
    expect(flow.verifyCode).not.toHaveBeenCalled();
  });
  it('sign-in is 503 when Supabase is not configured and runs nothing', async () => {
    configured.value = false;
    const res = await signInPost(post('/x', { email: 'a@b.co', password: 'x' }));
    expect(res.status).toBe(503);
    expect(flow.signIn).not.toHaveBeenCalled();
  });
  it('enroll: denied is 401, ok returns the enrolment', async () => {
    flow.enrol.mockResolvedValueOnce({ status: 'denied' });
    expect((await enrollPost(post('/x', {}))).status).toBe(401);
    flow.enrol.mockResolvedValueOnce({ status: 'ok', enrolment: { factorId: 'f', qrCode: 'q', secret: 's', uri: 'u' } });
    expect(await (await enrollPost(post('/x', {}))).json()).toEqual({ factorId: 'f', qrCode: 'q', secret: 's', uri: 'u' });
  });
  it('sign-out: no session is 401 and signs nothing out; a session is signed out', async () => {
    auth.session.mockResolvedValueOnce(null);
    expect((await signOutPost(post('/x', {}))).status).toBe(401);
    expect(auth.signOut).not.toHaveBeenCalled();
    auth.session.mockResolvedValueOnce({ userId: 'u' });
    expect((await signOutPost(post('/x', {}))).status).toBe(200);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
