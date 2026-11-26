import { describe, expect, it } from 'vitest';
import { parseDbEnv } from '../../src/db/env';

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(30),
  SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(30),
};

describe('database environment (AD-24)', () => {
  it('unset APP_ENV is development on the public schema', () => {
    expect(parseDbEnv(BASE)).toMatchObject({ APP_ENV: 'development', SUPABASE_DB_SCHEMA: 'public' });
  });
  it('production uses public', () => {
    expect(parseDbEnv({ ...BASE, APP_ENV: 'production' })?.SUPABASE_DB_SCHEMA).toBe('public');
  });
  it('production or development with a preview schema is invalid', () => {
    expect(parseDbEnv({ ...BASE, APP_ENV: 'production', SUPABASE_DB_SCHEMA: 'preview_pr12' })).toBeNull();
    expect(parseDbEnv({ ...BASE, SUPABASE_DB_SCHEMA: 'preview_pr12' })).toBeNull();
  });
  it('preview needs a preview_* schema and can never use public', () => {
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_pr12' })?.SUPABASE_DB_SCHEMA).toBe('preview_pr12');
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview' })).toBeNull(); // schema defaults to public
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'public' })).toBeNull();
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_' })).toBeNull();
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_A;drop' })).toBeNull();
  });
  it('on Vercel the platform environment must agree with APP_ENV (a preview without APP_ENV fails closed)', () => {
    expect(parseDbEnv({ ...BASE, VERCEL_ENV: 'preview' })).toBeNull(); // APP_ENV defaulted to development
    expect(parseDbEnv({ ...BASE, VERCEL_ENV: 'production', APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_x' })).toBeNull();
    expect(parseDbEnv({ ...BASE, VERCEL_ENV: 'production' })).toBeNull();
    expect(parseDbEnv({ ...BASE, VERCEL_ENV: 'production', APP_ENV: 'production' })).not.toBeNull();
    expect(parseDbEnv({ ...BASE, VERCEL_ENV: 'preview', APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_pr1' })).not.toBeNull();
  });
  it('the preview schema name has a length limit of 63 characters in Postgres', () => {
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_' + 'a'.repeat(55) })).not.toBeNull();
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_' + 'a'.repeat(56) })).toBeNull();
    expect(parseDbEnv({ ...BASE, APP_ENV: 'preview', SUPABASE_DB_SCHEMA: 'preview_Upper' })).toBeNull();
  });
  it('an unknown APP_ENV is invalid', () => {
    expect(parseDbEnv({ ...BASE, APP_ENV: 'staging' })).toBeNull();
  });
  it('missing or short keys mean not configured', () => {
    expect(parseDbEnv({})).toBeNull();
    expect(parseDbEnv({ ...BASE, SUPABASE_SERVICE_ROLE_KEY: 'short' })).toBeNull();
    expect(parseDbEnv({ ...BASE, NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toBeNull();
  });
  it('blank values count as unset, so an empty .env line falls back to the defaults', () => {
    expect(parseDbEnv({ ...BASE, APP_ENV: '', SUPABASE_DB_SCHEMA: '' })).toMatchObject({ APP_ENV: 'development', SUPABASE_DB_SCHEMA: 'public' });
  });
});
