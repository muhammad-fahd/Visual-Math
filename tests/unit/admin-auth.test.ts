import { describe, expect, it } from 'vitest';
import { LOCKOUT, minutesToWait, normalizeEmail, secondsUntil } from '../../src/lib/auth/lockout';
import { normalizeRecoveryCode, recoveryCode, recoveryCodes } from '../../src/lib/auth/recovery';
import { enrol, hashRecoveryCode, recover, signIn, throttleKey, verifyCode, type FlowDeps } from '../../src/server/admin/auth-flow';
import { errorResponse, readBody, sameOrigin } from '../../src/server/admin/http';
import type { AdminAuth, AdminSession, AdminStore, AuditEntry, Factor } from '../../src/server/admin/ports';
import { checkAdmin, requireAdminResponse } from '../../src/server/admin/require-admin';
import { AuditEntrySchema, writeAudit } from '../../src/server/audit';
import { z } from 'zod';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'owner@example.com';

/** A small in-memory Supabase: one user, TOTP code 123456, password "correct horse". */
function world(opts: { admin?: boolean; verifiedFactor?: boolean; session?: AdminSession | null } = {}) {
  const w = {
    session: (opts.session === undefined ? null : opts.session) as AdminSession | null,
    factors: (opts.verifiedFactor ? [{ id: 'f1', verified: true }] : []) as Factor[],
    admins: new Set(opts.admin === false ? [] : [ADMIN]),
    failures: new Map<string, { n: number; until: Date | null }>(),
    codes: new Map<string, boolean>(), // hash -> used
    audit: [] as AuditEntry[],
    log: [] as string[],
    now: new Date('2026-01-01T00:00:00Z'),
    userId: ADMIN,
  };
  const auth: AdminAuth = {
    async session() { return w.session; },
    async signInWithPassword(email, password) {
      w.log.push(`pw:${email}`);
      if (normalizeEmail(email) !== EMAIL || password !== 'correct horse') return false;
      w.session = { userId: w.userId, email: EMAIL, aal: 'aal1' };
      return true;
    },
    async listFactors() { return w.factors; },
    async removeUnverifiedFactors() { w.factors = w.factors.filter((f) => f.verified); },
    async enroll() {
      w.factors = [...w.factors, { id: 'f2', verified: false }];
      return { factorId: 'f2', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABCD', uri: 'otpauth://totp/x' };
    },
    async verify(id, code) {
      if (code !== '123456' || !w.factors.some((f) => f.id === id)) return false;
      w.factors = w.factors.map((f) => (f.id === id ? { ...f, verified: true } : f));
      w.session = { ...w.session!, aal: 'aal2' };
      return true;
    },
    async removeAllFactors() { w.factors = []; return true; },
    async signOut() { w.session = null; },
  };
  const store: AdminStore = {
    async isAdmin(id) { return w.admins.has(id); },
    async loginStatus(key) {
      const f = w.failures.get(key);
      return f?.until && f.until > w.now ? f.until : null;
    },
    async loginFailure(key) {
      const f = w.failures.get(key) ?? { n: 0, until: null };
      if (f.until && f.until > w.now) return f.until;
      f.n += 1;
      if (f.n >= LOCKOUT.maxFailures) f.until = new Date(w.now.getTime() + LOCKOUT.lockSeconds * 1000);
      w.failures.set(key, f);
      return f.until;
    },
    async loginClear(key) { w.failures.delete(key); },
    async replaceRecoveryCodes(_id, hashes) { w.codes = new Map(hashes.map((h) => [h, false])); },
    async consumeRecoveryCode(_id, hash) {
      if (w.codes.get(hash) !== false) return false;
      w.codes.set(hash, true);
      return true;
    },
    async restoreRecoveryCode(_id, hash) { w.codes.set(hash, false); },
    async recordAudit(e) { w.audit.push(e); },
  };
  let counter = 1;
  const deps: FlowDeps = { auth, store, now: () => w.now, random: (n) => Uint8Array.from({ length: n }, () => (counter = (counter * 73 + 41) % 251)) };
  return { w, deps, auth, store };
}

describe('requireAdmin (AD-8): aal2 session AND an admin_user row', () => {
  const session = (aal: 'aal1' | 'aal2', id = ADMIN): AdminSession => ({ userId: id, email: EMAIL, aal });
  it('visitor: no session', async () => {
    const { deps } = world();
    expect(await checkAdmin(deps)).toBeNull();
    const r = await requireAdminResponse(deps);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(401);
    expect(await (r as Response).json()).toEqual({ error: { code: 'unauthorized', message: 'Sign-in required.' } });
  });
  it('password only (aal1) is refused', async () => {
    expect(await checkAdmin(world({ session: session('aal1') }).deps)).toBeNull();
  });
  it('aal2 without an admin row is refused', async () => {
    expect(await checkAdmin(world({ admin: false, session: session('aal2') }).deps)).toBeNull();
    expect(await checkAdmin(world({ session: session('aal2', OTHER) }).deps)).toBeNull();
  });
  it('aal2 with an admin row passes', async () => {
    expect(await checkAdmin(world({ session: session('aal2') }).deps)).toEqual({ adminId: ADMIN, email: EMAIL });
  });
  it('fails closed when a dependency throws', async () => {
    const { deps } = world({ session: session('aal2') });
    deps.store.isAdmin = async () => { throw new Error('db down'); };
    expect(await checkAdmin(deps)).toBeNull();
    deps.auth.session = async () => { throw new Error('auth down'); };
    expect(await checkAdmin(deps)).toBeNull();
  });
});

describe('sign-in, second step, recovery', () => {
  it('first sign-in: password, then enrol (QR), then code issues ten recovery codes once and reaches aal2', async () => {
    const { w, deps } = world();
    expect(await signIn(deps, { email: EMAIL, password: 'correct horse' })).toEqual({ status: 'ok', next: 'enroll' });
    expect(await checkAdmin(deps)).toBeNull(); // password only is not enough
    const e = await enrol(deps);
    expect(e.status).toBe('ok');
    const v = await verifyCode(deps, { factorId: 'f2', code: '123456' });
    expect(v.status).toBe('ok');
    const codes = (v as { recoveryCodes?: string[] }).recoveryCodes!;
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(w.codes.size).toBe(10);
    expect([...w.codes.keys()].every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
    expect(codes.some((c) => [...w.codes.keys()].includes(c))).toBe(false); // only hashes are stored
    expect(await checkAdmin(deps)).toEqual({ adminId: ADMIN, email: EMAIL });
    expect(w.audit.map((a) => a.action)).toEqual(['admin.sign_in', 'admin.mfa_enrolled']);
  });
  it('returning admin: password then code, no recovery codes again', async () => {
    const { w, deps } = world({ verifiedFactor: true });
    expect(await signIn(deps, { email: EMAIL, password: 'correct horse' })).toEqual({ status: 'ok', next: 'verify' });
    const v = await verifyCode(deps, { code: '123456' });
    expect(v).toEqual({ status: 'ok' });
    expect(w.audit.map((a) => a.action)).toEqual(['admin.sign_in']);
    expect(w.session?.aal).toBe('aal2');
  });
  it('enrolling is refused when a verified factor already exists (no bypass of the second step)', async () => {
    const { deps } = world({ verifiedFactor: true });
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    expect(await enrol(deps)).toEqual({ status: 'denied' });
  });
  it('the second step needs an aal1 admin session', async () => {
    expect(await enrol(world().deps)).toEqual({ status: 'denied' });
    expect(await verifyCode(world().deps, { code: '123456' })).toEqual({ status: 'denied' });
    expect(await recover(world().deps, { code: 'AAAAA-AAAAA' })).toEqual({ status: 'denied' });
    const aal2 = world({ verifiedFactor: true, session: { userId: ADMIN, email: EMAIL, aal: 'aal2' } });
    expect(await verifyCode(aal2.deps, { code: '123456' })).toEqual({ status: 'denied' });
  });
  it('another account\'s factor id is refused', async () => {
    const { deps } = world({ verifiedFactor: true });
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    expect(await verifyCode(deps, { factorId: 'someone-elses', code: '123456' })).toEqual({ status: 'denied' });
  });

  it('a factor added with the password alone cannot replace the verified one (no aal2 takeover)', async () => {
    const { w, deps } = world({ verifiedFactor: true });
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    w.factors = [...w.factors, { id: 'attacker', verified: false }];
    expect(await verifyCode(deps, { factorId: 'attacker', code: '123456' })).toEqual({ status: 'denied' });
    expect(w.session?.aal).toBe('aal1');
    expect(w.codes.size).toBe(0);
  });
  it('a failed audit write after the code signs the admin out and fails the request', async () => {
    const { w, deps } = world({ verifiedFactor: true });
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    deps.store.recordAudit = async () => { throw new Error('audit down'); };
    await expect(verifyCode(deps, { code: '123456' })).rejects.toThrow();
    expect(w.session).toBeNull();
  });
  it('a recovery code is kept when the factor removal fails', async () => {
    const { w, deps } = world();
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    await enrol(deps);
    const v = (await verifyCode(deps, { factorId: 'f2', code: '123456' })) as { recoveryCodes: string[] };
    w.session = { userId: ADMIN, email: EMAIL, aal: 'aal1' };
    deps.auth.removeAllFactors = async () => false;
    expect(await recover(deps, { code: v.recoveryCodes[0]! })).toEqual({ status: 'denied' });
    expect(w.codes.get(hashRecoveryCode(v.recoveryCodes[0]!))).toBe(false); // still unused
  });

  it('wrong password, unknown user, wrong code and non-admin all look the same', async () => {
    const a = await signIn(world().deps, { email: EMAIL, password: 'nope' });
    const b = await signIn(world().deps, { email: 'ghost@example.com', password: 'correct horse' });
    const nonAdmin = world({ admin: false });
    const c = await signIn(nonAdmin.deps, { email: EMAIL, password: 'correct horse' });
    expect(nonAdmin.w.session).toBeNull(); // the Supabase session of a non-admin is dropped at once
    const d = world({ verifiedFactor: true });
    await signIn(d.deps, { email: EMAIL, password: 'correct horse' });
    const wrongCode = await verifyCode(d.deps, { code: '000000' });
    expect([a, b, c, wrongCode]).toEqual([{ status: 'invalid' }, { status: 'invalid' }, { status: 'invalid' }, { status: 'invalid' }]);
  });

  it('five failures lock for 15 minutes with the wait given; a correct password during the lock fails too', async () => {
    const { w, deps } = world({ verifiedFactor: true });
    for (let i = 0; i < 4; i++) expect(await signIn(deps, { email: EMAIL, password: 'bad' })).toEqual({ status: 'invalid' });
    expect(await signIn(deps, { email: EMAIL, password: 'bad' })).toEqual({ status: 'locked', retryAfterSeconds: 900 });
    expect(await signIn(deps, { email: EMAIL, password: 'correct horse' })).toEqual({ status: 'locked', retryAfterSeconds: 900 });
    expect(w.session).toBeNull();
    w.now = new Date(w.now.getTime() + 899_000);
    expect(await signIn(deps, { email: EMAIL, password: 'correct horse' })).toEqual({ status: 'locked', retryAfterSeconds: 1 });
    w.now = new Date(w.now.getTime() + 2_000);
    expect(await signIn(deps, { email: EMAIL, password: 'correct horse' })).toEqual({ status: 'ok', next: 'verify' });
  });
  it('wrong codes share the counter with wrong passwords, so the second step cannot be brute-forced', async () => {
    const { deps } = world({ verifiedFactor: true });
    await signIn(deps, { email: EMAIL, password: 'bad' });
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    for (let i = 0; i < 3; i++) expect((await verifyCode(deps, { code: '000000' })).status).toBe('invalid');
    expect((await verifyCode(deps, { code: '000000' })).status).toBe('locked');
    expect((await verifyCode(deps, { code: '123456' })).status).toBe('locked'); // right code, still locked
  });
  it('the counter is per address regardless of case and spaces, and never stores the address', async () => {
    expect(throttleKey(' Owner@Example.com ')).toBe(throttleKey(EMAIL));
    expect(throttleKey(EMAIL)).toMatch(/^[0-9a-f]{64}$/);
    expect(throttleKey(EMAIL)).not.toContain('owner');
  });

  it('recovery: a valid code removes the authenticator, is single use, and is audited', async () => {
    const { w, deps } = world();
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    await enrol(deps);
    const v = (await verifyCode(deps, { factorId: 'f2', code: '123456' })) as { recoveryCodes: string[] };
    const code = v.recoveryCodes[0]!;
    w.session = { userId: ADMIN, email: EMAIL, aal: 'aal1' }; // signed in again with the password
    expect(await recover(deps, { code: code.toLowerCase().replace('-', ' ') })).toEqual({ status: 'ok', next: 'enroll' });
    expect(w.factors).toEqual([]);
    expect(w.audit.at(-1)?.action).toBe('admin.mfa_reset');
    expect(await recover(deps, { code })).toEqual({ status: 'invalid' }); // used
    expect(await recover(deps, { code: 'not a code' })).toEqual({ status: 'invalid' });
  });

  it('no password, code or recovery code reaches the audit rows', async () => {
    const { w, deps } = world();
    await signIn(deps, { email: EMAIL, password: 'correct horse' });
    await enrol(deps);
    const v = (await verifyCode(deps, { factorId: 'f2', code: '123456' })) as { recoveryCodes: string[] };
    const dump = JSON.stringify([w.audit, [...w.failures.keys()]]);
    expect(dump).not.toContain('correct horse');
    expect(dump).not.toContain('123456');
    for (const c of v.recoveryCodes) expect(dump).not.toContain(c);
    expect(dump).not.toContain(EMAIL);
  });
});

describe('audit writer', () => {
  it('validates before writing', async () => {
    const { w, store } = world();
    await writeAudit(store, { adminId: ADMIN, action: 'topic.publish', target: 'trig-radians' });
    expect(w.audit).toHaveLength(1);
    for (const bad of [
      { adminId: 'not-a-uuid', action: 'x', target: 't' },
      { adminId: ADMIN, action: 'Bad Action', target: 't' },
      { adminId: ADMIN, action: 'ok', target: '' },
      { adminId: ADMIN, action: 'ok', target: 'x'.repeat(201) },
    ]) {
      await expect(writeAudit(store, bad)).rejects.toThrow();
    }
    expect(w.audit).toHaveLength(1);
    expect(AuditEntrySchema.safeParse({ adminId: ADMIN, action: 'a.b_c', target: 't' }).success).toBe(true);
  });
  it('a failing sink fails the caller (an unlogged action must not look successful)', async () => {
    await expect(writeAudit({ recordAudit: async () => { throw new Error('x'); } }, { adminId: ADMIN, action: 'a', target: 't' })).rejects.toThrow();
  });
});

describe('lib: lockout and recovery codes', () => {
  it('seconds and minutes', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(secondsUntil(new Date(now.getTime() + 61_500), now)).toBe(62);
    expect(secondsUntil(new Date(now.getTime() - 5), now)).toBe(0);
    expect(secondsUntil('garbage', now)).toBe(0);
    expect(minutesToWait(0)).toBe(0);
    expect(minutesToWait(1)).toBe(1);
    expect(minutesToWait(900)).toBe(15);
    expect(minutesToWait(901)).toBe(16);
  });
  const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
  it('codes are readable, distinct and parse back', () => {
    const codes = recoveryCodes(rnd);
    expect(codes).toHaveLength(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
      expect(normalizeRecoveryCode(c)).toBe(c);
    }
  });
  it('bytes in the biased tail are skipped', () => {
    expect(recoveryCode((n) => Uint8Array.from({ length: n }, (_, i) => (i < 6 ? 255 : 0)))).toBe('AAAAA-AAAAA');
  });
  it('a typed code is forgiven for case, spaces and a missing dash; nonsense is not', () => {
    expect(normalizeRecoveryCode('abcde fghjk')).toBe('ABCDE-FGHJK');
    expect(normalizeRecoveryCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(normalizeRecoveryCode('ABCDE-FGHJ')).toBeNull();
    expect(normalizeRecoveryCode('0OIL1-ABCDE')).toBeNull();
  });
  it('hashes are 64 hex and differ per code', () => {
    expect(hashRecoveryCode('ABCDE-FGHJK')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRecoveryCode('ABCDE-FGHJK')).not.toBe(hashRecoveryCode('ABCDE-FGHJM'));
  });
});

describe('handler plumbing', () => {
  const req = (init: { origin?: string | null; type?: string; body?: string } = {}) =>
    new Request('https://site.test/api/admin/auth/sign-in', {
      method: 'POST',
      headers: { ...(init.origin === null ? {} : { origin: init.origin ?? 'https://site.test' }), 'content-type': init.type ?? 'application/json' },
      body: init.body ?? '{}',
    });
  const schema = z.object({ a: z.string() }).strict();
  it('same-origin only', () => {
    expect(sameOrigin(req())).toBe(true);
    expect(sameOrigin(req({ origin: 'https://evil.test' }))).toBe(false);
    expect(sameOrigin(req({ origin: null }))).toBe(false);
    expect(sameOrigin(req({ origin: 'not a url' }))).toBe(false);
  });
  it('rejects bad origin, content type, size, JSON and shape with the envelope', async () => {
    const cases: [Request, number, string][] = [
      [req({ origin: 'https://evil.test', body: '{"a":"x"}' }), 403, 'forbidden'],
      [req({ type: 'text/plain', body: '{"a":"x"}' }), 415, 'unsupported_media_type'],
      [req({ body: '{"a":"' + 'x'.repeat(5000) + '"}' }), 413, 'too_large'],
      [req({ body: '{' }), 400, 'invalid_body'],
      [req({ body: '{"a":"' + '\u00e9'.repeat(2500) + '"}' }), 413, 'too_large'], // under 4096 characters, over 4096 bytes
      [req({ body: '{"a":1}' }), 400, 'invalid_body'],
      [req({ body: '{"a":"x","extra":1}' }), 400, 'invalid_body'],
    ];
    for (const [r, status, code] of cases) {
      const out = await readBody(r, schema);
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.response.status).toBe(status);
        expect((await out.response.json()).error.code).toBe(code);
        expect(out.response.headers.get('cache-control')).toBe('no-store');
      }
    }
  });
  it('a chunked body (no Content-Length) is cut off at the limit, not buffered whole', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(1024)));
        if (pulled > 1000) controller.close();
      },
    });
    const r = new Request('https://site.test/api/admin/auth/sign-in', {
      method: 'POST',
      headers: { origin: 'https://site.test', 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const out = await readBody(r, schema);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.response.status).toBe(413);
    expect(pulled).toBeLessThan(20); // stopped early: it never read the megabyte
  });
  it('multi-byte text under the limit is accepted (the limit is in bytes, not characters)', async () => {
    const urdu = '\u0627'.repeat(1500); // 3000 bytes
    expect(await readBody(req({ body: JSON.stringify({ a: urdu }) }), schema)).toEqual({ ok: true, data: { a: urdu } });
    expect(await readBody(req({ body: JSON.stringify({ a: urdu + urdu }) }), schema)).toMatchObject({ ok: false });
  });
  it('accepts a good body', async () => {
    expect(await readBody(req({ body: '{"a":"x"}' }), schema)).toEqual({ ok: true, data: { a: 'x' } });
  });
  it('the 429 carries the wait as a header', () => {
    expect(errorResponse(429, 'locked', 'x', { retryAfterSeconds: 3 }, { 'Retry-After': '3' }).headers.get('retry-after')).toBe('3');
  });
});
