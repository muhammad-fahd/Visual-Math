import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

// The migration runs on a real Postgres (PGlite) with Supabase's roles stubbed.
const SQL = readFileSync('supabase/migrations/0001_admin_and_audit.sql', 'utf8');
const ADMIN = '11111111-1111-1111-1111-111111111111';
const KEY = 'k'.repeat(64);

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    grant usage on schema public to anon, authenticated, service_role;
    insert into auth.users values ('${ADMIN}');
    -- Supabase grants everything to these roles on new objects by default; the migration must undo it.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  await db.exec(SQL);
  await db.exec(`insert into public.admin_user (user_id) values ('${ADMIN}')`);
});

async function as(role: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

describe('audit_log is append-only (FR-9.13, NFR-2.6)', () => {
  it('record_audit adds exactly one row with who, action, target and time', async () => {
    const before = (await db.query<{ n: string }>('select count(*) as n from public.audit_log')).rows[0]!.n;
    const id = (await as('service_role', 'select public.record_audit($1, $2, $3) as id', [ADMIN, 'topic.publish', 'trig-radians'])).rows[0] as { id: string };
    const after = (await db.query<{ n: string }>('select count(*) as n from public.audit_log')).rows[0]!.n;
    expect(Number(after) - Number(before)).toBe(1);
    const row = (await db.query<{ admin_id: string; action: string; target: string; at: Date }>('select * from public.audit_log where id = $1', [id.id])).rows[0]!;
    expect(row).toMatchObject({ admin_id: ADMIN, action: 'topic.publish', target: 'trig-radians' });
    expect(row.at).toBeInstanceOf(Date);
  });

  for (const role of ['service_role', 'anon', 'authenticated', 'postgres']) {
    for (const stmt of ['update public.audit_log set target = $1', 'delete from public.audit_log', 'truncate public.audit_log']) {
      it(`${role} cannot ${stmt.split(' ')[0]}`, async () => {
        const params = stmt.startsWith('update') ? ['x'] : [];
        const run = role === 'postgres' ? db.query(stmt, params) : as(role, stmt, params);
        await expect(run).rejects.toThrow();
        expect((await db.query<{ n: string }>('select count(*) as n from public.audit_log')).rows[0]!.n).not.toBe('0');
      });
    }
  }

  it('a malformed action or an over-long target is refused', async () => {
    await expect(as('service_role', 'select public.record_audit($1, $2, $3)', [ADMIN, 'Bad Action', 't'])).rejects.toThrow();
    await expect(as('service_role', 'select public.record_audit($1, $2, $3)', [ADMIN, 'ok', 'x'.repeat(201)])).rejects.toThrow();
  });
});

describe('the browser roles reach nothing (AD-8)', () => {
  const tables = ['admin_user', 'audit_log', 'login_throttle', 'admin_recovery_code'];
  it('every table has row level security', async () => {
    const rows = (await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'",
    )).rows;
    expect(rows.map((r) => r.relname).sort()).toEqual([...tables].sort());
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });
  for (const role of ['anon', 'authenticated']) {
    it(`${role} cannot read, write or call anything`, async () => {
      for (const t of tables) {
        await expect(as(role, `select * from public.${t}`)).rejects.toThrow();
        await expect(as(role, `insert into public.${t} default values`)).rejects.toThrow();
      }
      await expect(as(role, 'select public.record_audit($1, $2, $3)', [ADMIN, 'x', 'y'])).rejects.toThrow();
      await expect(as(role, 'select public.login_status($1)', [KEY])).rejects.toThrow();
      await expect(as(role, 'select public.consume_recovery_code($1, $2)', [ADMIN, 'h'.repeat(64)])).rejects.toThrow();
      await expect(as(role, 'select public.restore_recovery_code($1, $2)', [ADMIN, 'h'.repeat(64)])).rejects.toThrow();
    });
  }
  it('no table or function grants anything to anon or authenticated', async () => {
    const t = await db.query("select grantee from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')");
    expect(t.rows).toEqual([]);
    const f = await db.query(
      "select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))",
    );
    expect(f.rows).toEqual([]);
  });
  it('the service role can read the admin list', async () => {
    expect((await as('service_role', 'select user_id from public.admin_user')).rows).toHaveLength(1);
  });
});

describe('login throttle (NFR-2.8)', () => {
  const fail = async (key = KEY) => (await as('service_role', 'select public.login_failure($1, 5, 900, 900) as l', [key])).rows[0] as { l: Date | null };
  const status = async (key = KEY) => ((await as('service_role', 'select public.login_status($1) as l', [key])).rows[0] as { l: Date | null }).l;

  it('four failures leave it open, the fifth locks for about 15 minutes', async () => {
    for (let i = 0; i < 4; i++) expect((await fail()).l).toBeNull();
    expect(await status()).toBeNull();
    const locked = (await fail()).l!;
    const secs = (locked.getTime() - Date.now()) / 1000;
    expect(secs).toBeGreaterThan(890);
    expect(secs).toBeLessThanOrEqual(900);
    expect(await status()).not.toBeNull();
  });
  it('a failure during a lock does not extend it', async () => {
    const first = await status();
    const again = (await fail()).l!;
    expect(again.getTime()).toBe(first!.getTime());
  });
  it('success clears the count', async () => {
    await as('service_role', 'select public.login_clear($1)', [KEY]);
    expect(await status()).toBeNull();
    for (let i = 0; i < 4; i++) await fail();
    expect(await status()).toBeNull();
  });
  it('an old window starts over and another key is independent', async () => {
    const k2 = 'z'.repeat(64);
    for (let i = 0; i < 4; i++) await fail(k2);
    await db.query("update public.login_throttle set window_start = now() - interval '20 minutes' where key = $1", [k2]);
    expect((await fail(k2)).l).toBeNull();
    expect(await status(k2)).toBeNull();
  });
  it('an expired lock starts a fresh count', async () => {
    const k3 = 'y'.repeat(64);
    for (let i = 0; i < 5; i++) await fail(k3);
    await db.query("update public.login_throttle set locked_until = now() - interval '1 second' where key = $1", [k3]);
    expect(await status(k3)).toBeNull();
    expect((await fail(k3)).l).toBeNull();
    const row = (await db.query<{ failures: number }>('select failures from public.login_throttle where key = $1', [k3])).rows[0]!;
    expect(row.failures).toBe(1);
  });
  it('short keys are refused (the key is a hash, never an email)', async () => {
    await expect(as('service_role', 'select public.login_failure($1, 5, 900, 900)', ['a@b.c'])).rejects.toThrow();
  });
});

describe('recovery codes', () => {
  const h = (c: string) => c.repeat(64).slice(0, 64);
  it('each code works once and use is audited; replacing keeps used ones used', async () => {
    await as('service_role', 'select public.replace_recovery_codes($1, $2)', [ADMIN, [h('a'), h('b')]]);
    const use = async (c: string) => ((await as('service_role', 'select public.consume_recovery_code($1, $2) as ok', [ADMIN, c])).rows[0] as { ok: boolean }).ok;
    expect(await use(h('a'))).toBe(true);
    expect(await use(h('a'))).toBe(false);
    expect(await use(h('c'))).toBe(false);
    const audited = await db.query("select action from public.audit_log where action in ('recovery_code.used','recovery_codes.issued')");
    expect(audited.rows.map((r) => (r as { action: string }).action).sort()).toEqual(['recovery_code.used', 'recovery_codes.issued']);
    await as('service_role', 'select public.replace_recovery_codes($1, $2)', [ADMIN, [h('d')]]);
    expect(await use(h('a'))).toBe(false);
    expect(await use(h('b'))).toBe(false);
    expect(await use(h('d'))).toBe(true);
  });
  it('a consumed code can be restored, once', async () => {
    await as('service_role', 'select public.replace_recovery_codes($1, $2)', [ADMIN, [h('r')]]);
    const use = async () => ((await as('service_role', 'select public.consume_recovery_code($1, $2) as ok', [ADMIN, h('r')])).rows[0] as { ok: boolean }).ok;
    expect(await use()).toBe(true);
    await as('service_role', 'select public.restore_recovery_code($1, $2)', [ADMIN, h('r')]);
    expect(await use()).toBe(true);
    expect(await use()).toBe(false);
  });
  it('a code hash must be 64 characters', async () => {
    await expect(as('service_role', 'select public.replace_recovery_codes($1, $2)', [ADMIN, ['short']])).rejects.toThrow();
  });
});
