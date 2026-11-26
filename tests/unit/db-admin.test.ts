import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// adminClient must hand the configured schema to Supabase: that is what keeps a preview deployment
// off the production schema (AD-24).
const created = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    created.calls.push(args);
    return { fake: true };
  },
}));

import { adminClient } from '../../src/db/admin';

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(30),
  SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(30),
};

beforeEach(() => {
  created.calls = [];
  vi.unstubAllEnvs();
  for (const k of ['APP_ENV', 'SUPABASE_DB_SCHEMA', 'VERCEL_ENV']) vi.stubEnv(k, '');
});
afterEach(() => vi.unstubAllEnvs());

function setEnv(extra: Record<string, string>) {
  for (const [k, v] of Object.entries({ ...BASE, ...extra })) vi.stubEnv(k, v);
}
const schemaOf = () => (created.calls[0]![2] as { db: { schema: string } }).db.schema;

describe('adminClient (AD-24)', () => {
  it('development and production use public', () => {
    setEnv({});
    adminClient();
    expect(schemaOf()).toBe('public');
    created.calls = [];
    setEnv({ APP_ENV: 'production' });
    adminClient();
    expect(schemaOf()).toBe('public');
  });
  it('preview uses its preview schema', () => {
    setEnv({ APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_pr12' });
    adminClient();
    expect(schemaOf()).toBe('preview_pr12');
  });
  it('an inconsistent environment creates no client at all', () => {
    setEnv({ APP_ENV: 'preview' }); // preview on public
    expect(adminClient()).toBeNull();
    setEnv({ APP_ENV: 'production', SUPABASE_DB_SCHEMA: 'preview_pr12' });
    expect(adminClient()).toBeNull();
    expect(created.calls).toHaveLength(0);
  });
  it('no environment, no client; the session is never persisted', () => {
    expect(adminClient()).toBeNull();
    setEnv({});
    adminClient();
    expect((created.calls[0]![2] as { auth: { persistSession: boolean } }).auth.persistSession).toBe(false);
  });
});
