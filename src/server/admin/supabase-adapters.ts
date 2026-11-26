import type { SupabaseClient } from '@supabase/supabase-js';
import { LOCKOUT } from '../../lib/auth/lockout';
import type { AdminAuth, AdminSession, AdminStore, Factor } from './ports';

// Supabase implementations of the ports. Spike 6 (docs/spikes.md section 6) verifies these against
// a real project: the `aal` claim in verified claims, enrol/verify, and the Auth admin factor API.

const ENROL_NAME = 'Authenticator';

/** `auth` is bound to the request's cookies (anon key); `admin` is the service-role client. */
export function supabaseAuth(auth: SupabaseClient | null, admin: SupabaseClient | null): AdminAuth {
  return {
    async session(): Promise<AdminSession | null> {
      if (!auth) return null;
      // getClaims verifies the token; never trust getSession() on the server.
      const { data, error } = await auth.auth.getClaims();
      const claims = data?.claims;
      if (error || !claims?.sub || typeof claims.email !== 'string') return null;
      const aal = (claims as { aal?: string }).aal === 'aal2' ? 'aal2' : 'aal1';
      return { userId: claims.sub, email: claims.email, aal };
    },
    async signInWithPassword(email, password) {
      if (!auth) return false;
      const { error } = await auth.auth.signInWithPassword({ email, password });
      return !error;
    },
    async listFactors(): Promise<Factor[]> {
      if (!auth) return [];
      const { data, error } = await auth.auth.mfa.listFactors();
      if (error || !data) return [];
      return data.all.filter((f) => f.factor_type === 'totp').map((f) => ({ id: f.id, verified: f.status === 'verified' }));
    },
    async removeUnverifiedFactors() {
      if (!auth) return;
      for (const f of await this.listFactors()) if (!f.verified) await auth.auth.mfa.unenroll({ factorId: f.id });
    },
    async enroll() {
      if (!auth) return null;
      const { data, error } = await auth.auth.mfa.enroll({ factorType: 'totp', friendlyName: ENROL_NAME });
      if (error || !data) return null;
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
    },
    async verify(factorId, code) {
      if (!auth) return false;
      const { error } = await auth.auth.mfa.challengeAndVerify({ factorId, code });
      return !error;
    },
    async removeAllFactors(userId) {
      if (!admin) return false;
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
      if (error || !data) return false;
      for (const f of data.factors) {
        const { error: e } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
        if (e) return false;
      }
      return true;
    },
    async signOut() {
      if (auth) await auth.auth.signOut();
    },
  };
}

export function supabaseStore(admin: SupabaseClient | null): AdminStore {
  const db = () => {
    if (!admin) throw new Error('database not configured');
    return admin;
  };
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db().rpc(fn, args);
    if (error) throw new Error(`${fn} failed`); // never forward database messages (AD-9)
    return data as unknown;
  };
  const date = (v: unknown) => (typeof v === 'string' ? new Date(v) : null);
  return {
    async isAdmin(userId) {
      const { data, error } = await db().from('admin_user').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('isAdmin failed'); // an outage is not "not an admin": callers fail closed or report an error
      return data !== null;
    },
    async loginStatus(key) {
      return date(await rpc('login_status', { p_key: key }));
    },
    async loginFailure(key) {
      return date(
        await rpc('login_failure', {
          p_key: key,
          p_max: LOCKOUT.maxFailures,
          p_window_seconds: LOCKOUT.windowSeconds,
          p_lock_seconds: LOCKOUT.lockSeconds,
        }),
      );
    },
    async loginClear(key) {
      await rpc('login_clear', { p_key: key });
    },
    async replaceRecoveryCodes(adminId, hashes) {
      await rpc('replace_recovery_codes', { p_admin: adminId, p_hashes: hashes });
    },
    async consumeRecoveryCode(adminId, hash) {
      return (await rpc('consume_recovery_code', { p_admin: adminId, p_hash: hash })) === true;
    },
    async restoreRecoveryCode(adminId, hash) {
      await rpc('restore_recovery_code', { p_admin: adminId, p_hash: hash });
    },
    async recordAudit(entry) {
      await rpc('record_audit', { p_admin: entry.adminId, p_action: entry.action, p_target: entry.target });
    },
  };
}
