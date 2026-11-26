import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supa = vi.hoisted(() => ({
  created: 0,
  getClaims: vi.fn(),
  setAllOnClaims: null as null | { name: string; value: string }[],
  batches: [] as { name: string; value: string }[][],
  headers: undefined as Record<string, string> | undefined,
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (c: unknown[], h?: Record<string, string>) => void } }) => {
    supa.created += 1;
    return {
      auth: {
        getClaims: async () => {
          if (supa.setAllOnClaims) options.cookies.setAll(supa.setAllOnClaims.map((c) => ({ ...c, options: { path: '/', httpOnly: true } })), supa.headers);
          for (const batch of supa.batches) options.cookies.setAll(batch.map((c) => ({ ...c, options: { path: '/', httpOnly: true } })), supa.headers);
          return supa.getClaims();
        },
      },
    };
  },
}));

import { refreshAdminSession } from '../../src/server/admin/session-refresh';
import { proxy } from '../../src/proxy';

const env = { url: 'https://abc.supabase.co', anonKey: 'a'.repeat(30) };
const req = (path: string, cookie?: string) => new NextRequest(`https://site.test${path}`, { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  supa.created = 0;
  supa.getClaims = vi.fn(async () => ({ data: null, error: null }));
  supa.setAllOnClaims = null;
  supa.batches = [];
  supa.headers = undefined;
});

describe('refreshAdminSession', () => {
  it('passes through without a Supabase session cookie, with no network call', async () => {
    const res = await refreshAdminSession(req('/admin'), env);
    expect(res.status).toBe(200);
    expect(supa.created).toBe(0);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('passes through when Supabase is not configured', async () => {
    await refreshAdminSession(req('/admin', 'sb-x-auth-token=abc'), { url: undefined, anonKey: undefined });
    expect(supa.created).toBe(0);
  });
  it('verifies the claims when a session cookie exists', async () => {
    await refreshAdminSession(req('/admin', 'sb-x-auth-token=abc'), env);
    expect(supa.created).toBe(1);
    expect(supa.getClaims).toHaveBeenCalledOnce();
  });
  it('copies refreshed cookies onto the response and the request, and keeps no-store', async () => {
    supa.setAllOnClaims = [{ name: 'sb-x-auth-token', value: 'NEW' }];
    supa.headers = { 'Cache-Control': 'no-cache' };
    const request = req('/admin', 'sb-x-auth-token=OLD');
    const res = await refreshAdminSession(request, env);
    expect(res.cookies.get('sb-x-auth-token')?.value).toBe('NEW');
    expect(request.cookies.get('sb-x-auth-token')?.value).toBe('NEW');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('keeps the cookies of every setAll call, not only the last', async () => {
    supa.batches = [[{ name: 'sb-x-auth-token.0', value: 'A' }], [{ name: 'sb-x-auth-token.1', value: 'B' }]]; // two separate setAll calls
    const res = await refreshAdminSession(req('/admin', 'sb-x-auth-token.0=OLD'), env);
    expect(res.cookies.get('sb-x-auth-token.0')?.value).toBe('A');
    expect(res.cookies.get('sb-x-auth-token.1')?.value).toBe('B');
  });
  it('an unreachable Auth service does not break the page', async () => {
    supa.getClaims = vi.fn(async () => {
      throw new Error('network down');
    });
    const res = await refreshAdminSession(req('/admin', 'sb-x-auth-token=abc'), env);
    expect(res.status).toBe(200);
  });
});

describe('proxy routing', () => {
  it('/admin and its subpaths refresh the session and never redirect', async () => {
    for (const path of ['/admin', '/admin/sign-in', '/admin/topics/x']) {
      const res = await proxy(req(path));
      expect(res.status, path).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  });
  it('/ still redirects by language, not cacheable', async () => {
    const res = await proxy(new NextRequest('https://site.test/', { headers: { 'accept-language': 'ur' } }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://site.test/ur');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('the matcher covers exactly / and the admin area, so visitor pages never run this code', async () => {
    const { config } = await import('../../src/proxy');
    expect(config.matcher).toEqual(['/', '/admin/:path*']);
  });

});
