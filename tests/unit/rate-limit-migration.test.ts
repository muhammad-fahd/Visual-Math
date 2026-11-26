import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigrations, findProblems, readMigrations } from '../../scripts/check-migrations.mjs';

// Migration 0004 on a real Postgres with Supabase's roles and default grants.
let db: PGlite;
beforeAll(async () => {
  db = await applyMigrations(readMigrations());
});

const as = async (role: string, sql: string, params: unknown[] = []) => {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
};
const hit = async (key: string, limit = 3, window = 60) =>
  (await as('service_role', 'select * from public.rate_limit_hit($1, $2, $3)', [key, limit, window])).rows[0] as { allowed: boolean; retry_after: number };
const K = (c: string) => c.repeat(64);

describe('rate_limit_hit (NFR-2.8, AD-28)', () => {
  it('allows up to the limit, then refuses with the seconds left', async () => {
    for (let i = 0; i < 3; i++) expect((await hit(K('a'))).allowed).toBe(true);
    const blocked = await hit(K('a'));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after).toBeGreaterThan(55);
    expect(blocked.retry_after).toBeLessThanOrEqual(60);
  });
  it('refused calls do not extend the window', async () => {
    const first = await hit(K('a'));
    const second = await hit(K('a'));
    expect(second.allowed).toBe(false);
    expect(second.retry_after).toBeLessThanOrEqual(first.retry_after);
    const row = (await db.query<{ window_start: Date }>('select window_start from public.rate_limit where key = $1', [K('a')])).rows[0]!;
    expect(Date.now() - row.window_start.getTime()).toBeLessThan(60_000); // still the first window, not restarted
  });
  it('the service role has no direct access to the counters', async () => {
    await expect(as('service_role', 'select * from public.rate_limit')).rejects.toThrow(/permission denied/);
    await expect(as('service_role', "update public.rate_limit set count = 0")).rejects.toThrow(/permission denied/);
  });
  it('keys are independent', async () => {
    expect((await hit(K('b'))).allowed).toBe(true);
  });
  it('the window starts over once it has passed', async () => {
    await db.query("update public.rate_limit set window_start = now() - interval '2 minutes' where key = $1", [K('a')]);
    expect((await hit(K('a'))).allowed).toBe(true);
    expect(Number((await db.query<{ count: number }>('select count from public.rate_limit where key = $1', [K('a')])).rows[0]!.count)).toBe(1);
  });
  it('a limit of 1 allows exactly one call per window', async () => {
    expect((await hit(K('c'), 1)).allowed).toBe(true);
    expect((await hit(K('c'), 1)).allowed).toBe(false);
  });
  it('a bad limit or window is an error, and a short key is refused (never an address)', async () => {
    await expect(hit(K('d'), 0)).rejects.toThrow();
    await expect(hit(K('d'), 1, 0)).rejects.toThrow();
    await expect(hit(K('d'), 1, 3601)).rejects.toThrow(); // longer than the sweeper keeps rows
    expect((await hit(K('d'), 1, 3600)).allowed).toBe(true);
    await expect(hit('1.2.3.4')).rejects.toThrow();
  });
  it('the sweeper removes keys older than an hour and keeps the rest', async () => {
    await db.query("update public.rate_limit set window_start = now() - interval '2 hours' where key = $1", [K('b')]);
    const swept = (await as('service_role', 'select public.rate_limit_sweep() as n')).rows[0] as { n: number };
    expect(swept.n).toBeGreaterThanOrEqual(1);
    expect((await db.query('select 1 from public.rate_limit where key = $1', [K('b')])).rows).toHaveLength(0);
    expect((await db.query('select 1 from public.rate_limit where key = $1', [K('c')])).rows).toHaveLength(1);
  });
});

describe('error_log (AD-26): scrubbed, no IP, kept 30 days', () => {
  it('log_error stores one row; the table has no column for an address, cookie or user agent', async () => {
    await as('service_role', 'select public.log_error($1, $2, $3, $4, $5)', ['req-12345678', 'client', '/en/topic/a', 'boom', null]);
    const rows = (await db.query<{ request_id: string; kind: string; path: string; message: string; detail: string | null }>('select * from public.error_log')).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ request_id: 'req-12345678', kind: 'client', path: '/en/topic/a', message: 'boom', detail: null });
    const columns = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'error_log'")).rows.map((r) => r.column_name);
    expect(columns.sort()).toEqual(['at', 'detail', 'id', 'kind', 'message', 'path', 'request_id']);
  });
  it('the length limits and kinds are enforced by the table', async () => {
    const log = (kind: string, path: string, message: string, detail: string | null = null) =>
      as('service_role', 'select public.log_error($1, $2, $3, $4, $5)', ['req-12345678', kind, path, message, detail]);
    await expect(log('other', '/', 'm')).rejects.toThrow();
    await expect(log('client', '/' + 'a'.repeat(200), 'm')).rejects.toThrow();
    await expect(log('client', '/', 'm'.repeat(501))).rejects.toThrow();
    await expect(log('client', '/', 'm', 'd'.repeat(2001))).rejects.toThrow();
    await expect(as('service_role', 'select public.log_error($1, $2, $3, $4, $5)', ['short', 'client', '/', 'm', null])).rejects.toThrow();
  });
  it('the purge removes entries older than 30 days only', async () => {
    await db.query("update public.error_log set at = now() - interval '31 days'");
    await as('service_role', 'select public.log_error($1, $2, $3, $4, $5)', ['req-87654321', 'server', '/', 'fresh', null]);
    const purged = (await as('service_role', 'select public.error_log_purge() as n')).rows[0] as { n: number };
    expect(purged.n).toBe(1);
    const left = (await db.query<{ message: string }>('select message from public.error_log')).rows;
    expect(left.map((r) => r.message)).toEqual(['fresh']);
  });
  it('the service role cannot edit or delete log rows directly', async () => {
    await expect(as('service_role', "delete from public.error_log")).rejects.toThrow(/permission denied/);
    await expect(as('service_role', "update public.error_log set message = 'x'")).rejects.toThrow(/permission denied/);
  });
});

describe('the browser roles reach nothing', () => {
  it.each(['anon', 'authenticated'])('%s cannot touch the tables or call the functions', async (role) => {
    for (const t of ['rate_limit', 'error_log']) {
      await expect(as(role, `select * from public.${t}`)).rejects.toThrow(/permission denied/);
      await expect(as(role, `insert into public.${t} default values`)).rejects.toThrow(/permission denied/);
    }
    await expect(as(role, 'select * from public.rate_limit_hit($1, 1, 1)', [K('z')])).rejects.toThrow(/permission denied/);
    await expect(as(role, "select public.log_error('req-12345678', 'client', '/', 'm', null)")).rejects.toThrow(/permission denied/);
    await expect(as(role, 'select public.rate_limit_sweep()')).rejects.toThrow(/permission denied/);
    await expect(as(role, 'select public.error_log_purge()')).rejects.toThrow(/permission denied/);
  });
  it('the whole schema, with all four migrations, passes the CI check', async () => {
    expect(await findProblems(db)).toEqual([]);
  });
});
