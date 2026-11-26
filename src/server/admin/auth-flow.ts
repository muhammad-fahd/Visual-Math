import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmail, secondsUntil } from '../../lib/auth/lockout';
import { normalizeRecoveryCode, recoveryCodes } from '../../lib/auth/recovery';
import { AUDIT_ACTIONS, writeAudit } from '../audit';
import type { AdminDeps, AdminSession, Enrolment } from './ports';

// Sign-in as plain functions over ports. Every failure of a credential looks the same ("invalid"),
// so a caller never learns which factor was wrong (NFR-2.8). Nothing here logs a secret.

export type FlowDeps = AdminDeps & { now?: () => Date; random?: (n: number) => Uint8Array };

export type Invalid = { status: 'invalid' };
export type Locked = { status: 'locked'; retryAfterSeconds: number };
export type Denied = { status: 'denied' };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** The throttle key: a hash of the address, never the address. */
export const throttleKey = (email: string) => sha256(`login:${normalizeEmail(email)}`);
export const hashRecoveryCode = (code: string) => sha256(`recovery:${code}`);

function locked(deps: FlowDeps, until: Date): Locked {
  return { status: 'locked', retryAfterSeconds: Math.max(1, secondsUntil(until, deps.now?.())) };
}

async function lockState(deps: FlowDeps, key: string): Promise<Locked | null> {
  const until = await deps.store.loginStatus(key);
  return until ? locked(deps, until) : null;
}

async function fail(deps: FlowDeps, key: string): Promise<Invalid | Locked> {
  const until = await deps.store.loginFailure(key);
  return until ? locked(deps, until) : { status: 'invalid' };
}

/** An aal1 session of an admin: the only state in which the second step may run. */
async function pendingSession(deps: FlowDeps): Promise<AdminSession | null> {
  const s = await deps.auth.session();
  if (!s || s.aal !== 'aal1') return null;
  return (await deps.store.isAdmin(s.userId)) ? s : null;
}

export type SignInResult = { status: 'ok'; next: 'enroll' | 'verify' } | Invalid | Locked;

export async function signIn(deps: FlowDeps, input: { email: string; password: string }): Promise<SignInResult> {
  const key = throttleKey(input.email);
  const lock = await lockState(deps, key);
  if (lock) return lock; // a correct password during a lock fails too
  const accepted = await deps.auth.signInWithPassword(input.email, input.password);
  const session = accepted ? await deps.auth.session() : null;
  // A valid Supabase user who is not an admin looks exactly like a wrong password.
  if (!session || !(await deps.store.isAdmin(session.userId))) {
    if (accepted) await deps.auth.signOut();
    return fail(deps, key);
  }
  const verified = (await deps.auth.listFactors()).some((f) => f.verified);
  return { status: 'ok', next: verified ? 'verify' : 'enroll' };
}

export type EnrolResult = { status: 'ok'; enrolment: Enrolment } | Denied;

export async function enrol(deps: FlowDeps): Promise<EnrolResult> {
  const session = await pendingSession(deps);
  if (!session) return { status: 'denied' };
  // A verified factor means the second step already exists; enrolling another would bypass it.
  if ((await deps.auth.listFactors()).some((f) => f.verified)) return { status: 'denied' };
  await deps.auth.removeUnverifiedFactors();
  const enrolment = await deps.auth.enroll();
  return enrolment ? { status: 'ok', enrolment } : { status: 'denied' };
}

export type VerifyResult = { status: 'ok'; recoveryCodes?: string[] } | Invalid | Locked | Denied;

export async function verifyCode(deps: FlowDeps, input: { factorId?: string; code: string }): Promise<VerifyResult> {
  const session = await pendingSession(deps);
  if (!session) return { status: 'denied' };
  const key = throttleKey(session.email);
  const lock = await lockState(deps, key);
  if (lock) return lock;
  // Once a verified factor exists only that factor can be used: a factor an attacker added with
  // the password alone must never turn aal1 into aal2. Without one, the id must be this user's.
  const factors = await deps.auth.listFactors();
  const existing = factors.find((f) => f.verified);
  const factor = existing
    ? !input.factorId || input.factorId === existing.id ? existing : undefined
    : input.factorId ? factors.find((f) => f.id === input.factorId) : undefined;
  if (!factor) return { status: 'denied' };
  if (!(await deps.auth.verify(factor.id, input.code))) return fail(deps, key);
  try {
    await deps.store.loginClear(key);
    await writeAudit(deps.store, { adminId: session.userId, action: AUDIT_ACTIONS.signIn, target: session.userId });
    if (factor.verified) return { status: 'ok' };
    // First successful code of a new factor: issue the recovery codes, once.
    const codes = recoveryCodes(deps.random ?? ((n) => randomBytes(n)));
    await deps.store.replaceRecoveryCodes(session.userId, codes.map(hashRecoveryCode));
    await writeAudit(deps.store, { adminId: session.userId, action: AUDIT_ACTIONS.mfaEnrolled, target: session.userId });
    return { status: 'ok', recoveryCodes: codes };
  } catch (error) {
    // The session is aal2 already: an unlogged sign-in must not stay signed in.
    await deps.auth.signOut();
    throw error;
  }
}

export type RecoverResult = { status: 'ok'; next: 'enroll' } | Invalid | Locked | Denied;

/** A valid unused recovery code removes the admin's authenticator so they enrol a new one. */
export async function recover(deps: FlowDeps, input: { code: string }): Promise<RecoverResult> {
  const session = await pendingSession(deps);
  if (!session) return { status: 'denied' };
  const key = throttleKey(session.email);
  const lock = await lockState(deps, key);
  if (lock) return lock;
  const code = normalizeRecoveryCode(input.code);
  if (!code || !(await deps.store.consumeRecoveryCode(session.userId, hashRecoveryCode(code)))) return fail(deps, key);
  if (!(await deps.auth.removeAllFactors(session.userId))) {
    await deps.store.restoreRecoveryCode(session.userId, hashRecoveryCode(code)); // the reset did not happen: keep the code
    return { status: 'denied' };
  }
  await deps.store.loginClear(key);
  await writeAudit(deps.store, { adminId: session.userId, action: AUDIT_ACTIONS.mfaReset, target: session.userId });
  return { status: 'ok', next: 'enroll' };
}
