import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { supabaseAuth, supabaseStore } from '../../src/server/admin/supabase-adapters';

const as = (o: unknown) => o as SupabaseClient;

describe('supabaseAuth maps Supabase to the port (spike 6 checks it against a real project)', () => {
  const claims = (c: unknown, error: unknown = null) => as({ auth: { getClaims: async () => ({ data: c ? { claims: c } : null, error }) } });
  it('aal2 only when the verified claim says aal2; anything else is aal1', async () => {
    expect(await supabaseAuth(claims({ sub: 'u', email: 'a@b.co', aal: 'aal2' }), null).session()).toEqual({ userId: 'u', email: 'a@b.co', aal: 'aal2' });
    expect((await supabaseAuth(claims({ sub: 'u', email: 'a@b.co', aal: 'aal1' }), null).session())?.aal).toBe('aal1');
    expect((await supabaseAuth(claims({ sub: 'u', email: 'a@b.co' }), null).session())?.aal).toBe('aal1');
    expect((await supabaseAuth(claims({ sub: 'u', email: 'a@b.co', aal: 'AAL2' }), null).session())?.aal).toBe('aal1');
  });
  it('no session when claims are missing, errored, or lack sub or email; or no client', async () => {
    expect(await supabaseAuth(claims(null), null).session()).toBeNull();
    expect(await supabaseAuth(claims({ sub: 'u', aal: 'aal2' }), null).session()).toBeNull();
    expect(await supabaseAuth(claims({ email: 'a@b.co', aal: 'aal2' }), null).session()).toBeNull();
    expect(await supabaseAuth(claims({ sub: 'u', email: 'a@b.co', aal: 'aal2' }, new Error('bad jwt')), null).session()).toBeNull();
    expect(await supabaseAuth(null, null).session()).toBeNull();
  });
  it('only TOTP factors count, and only status verified is verified', async () => {
    const client = as({
      auth: {
        mfa: {
          listFactors: async () => ({
            data: {
              all: [
                { id: 'a', factor_type: 'totp', status: 'verified' },
                { id: 'b', factor_type: 'totp', status: 'unverified' },
                { id: 'c', factor_type: 'phone', status: 'verified' },
              ],
            },
            error: null,
          }),
        },
      },
    });
    expect(await supabaseAuth(client, null).listFactors()).toEqual([
      { id: 'a', verified: true },
      { id: 'b', verified: false },
    ]);
  });
  it('removeAllFactors deletes each factor through the admin API and reports failure', async () => {
    const deleteFactor = vi.fn(async () => ({ error: null }));
    const admin = as({ auth: { admin: { mfa: { listFactors: async () => ({ data: { factors: [{ id: 'a' }, { id: 'b' }] }, error: null }), deleteFactor } } } });
    expect(await supabaseAuth(null, admin).removeAllFactors('u')).toBe(true);
    expect(deleteFactor).toHaveBeenCalledWith({ id: 'a', userId: 'u' });
    expect(deleteFactor).toHaveBeenCalledWith({ id: 'b', userId: 'u' });
    expect(await supabaseAuth(null, null).removeAllFactors('u')).toBe(false);
    const failing = as({ auth: { admin: { mfa: { listFactors: async () => ({ data: { factors: [{ id: 'a' }] }, error: null }), deleteFactor: async () => ({ error: new Error('x') }) } } } });
    expect(await supabaseAuth(null, failing).removeAllFactors('u')).toBe(false);
  });
});

describe('supabaseStore calls the SQL functions with their exact parameter names', () => {
  const rpcClient = (data: unknown = null, error: unknown = null) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rpc = vi.fn(async (..._args: unknown[]) => ({ data, error }));
    return { rpc, client: as({ rpc }) };
  };
  it('login_failure carries the policy numbers; a timestamp string becomes a Date', async () => {
    const { rpc, client } = rpcClient('2026-01-01T00:15:00Z');
    expect(await supabaseStore(client).loginFailure('k')).toEqual(new Date('2026-01-01T00:15:00Z'));
    expect(rpc).toHaveBeenCalledWith('login_failure', { p_key: 'k', p_max: 5, p_window_seconds: 900, p_lock_seconds: 900 });
  });
  it('null from login_status is no lock', async () => {
    expect(await supabaseStore(rpcClient(null).client).loginStatus('k')).toBeNull();
  });
  it('the other functions', async () => {
    const { rpc, client } = rpcClient(true);
    const s = supabaseStore(client);
    await s.loginClear('k');
    await s.replaceRecoveryCodes('u', ['h']);
    expect(await s.consumeRecoveryCode('u', 'h')).toBe(true);
    await s.restoreRecoveryCode('u', 'h');
    await s.recordAudit({ adminId: 'u', action: 'a.b', target: 't' });
    expect(rpc.mock.calls).toEqual([
      ['login_clear', { p_key: 'k' }],
      ['replace_recovery_codes', { p_admin: 'u', p_hashes: ['h'] }],
      ['consume_recovery_code', { p_admin: 'u', p_hash: 'h' }],
      ['restore_recovery_code', { p_admin: 'u', p_hash: 'h' }],
      ['record_audit', { p_admin: 'u', p_action: 'a.b', p_target: 't' }],
    ]);
  });
  it('an rpc error throws without forwarding the database message', async () => {
    await expect(supabaseStore(rpcClient(null, { message: 'relation "x" does not exist' }).client).loginClear('k')).rejects.toThrow(/^login_clear failed$/);
    await expect(supabaseStore(null).loginClear('k')).rejects.toThrow();
  });
  it('isAdmin: a row means admin, no row means not, a database error throws', async () => {
    const from = (result: { data: unknown; error: unknown }) => as({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) });
    expect(await supabaseStore(from({ data: { user_id: 'u' }, error: null })).isAdmin('u')).toBe(true);
    expect(await supabaseStore(from({ data: null, error: null })).isAdmin('u')).toBe(false);
    await expect(supabaseStore(from({ data: null, error: { message: 'down' } })).isAdmin('u')).rejects.toThrow();
  });
});
