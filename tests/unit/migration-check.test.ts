import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkMigrations, forSchema, previewSql, readMigrations } from '../../scripts/check-migrations.mjs';

// The CI check must fail on the mistakes it exists to catch. Each fixture is a migration directory.
function fixture(...sql: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'vm-mig-'));
  sql.forEach((s, i) => writeFileSync(join(dir, `${String(i + 1).padStart(4, '0')}_test.sql`), s));
  return dir;
}
const GOOD = `
  alter default privileges in schema public revoke all on tables from anon, authenticated;
  create table public.thing (id int primary key);
  alter table public.thing enable row level security;
  revoke all on public.thing from public, anon, authenticated;
`;
const only = (dir: string) => checkMigrations(dir, ['public']);

describe('migration check (AD-8, AD-24)', () => {
  it('the repository migrations are sound, in public and in a preview schema', async () => {
    expect(await checkMigrations()).toEqual([]);
    expect(readMigrations().length).toBeGreaterThanOrEqual(3);
  });
  it('a sound fixture passes', async () => {
    expect(await only(fixture(GOOD))).toEqual([]);
  });
  it('a table without row level security fails and is named', async () => {
    const problems = await only(fixture(GOOD + 'create table public.leaky (id int);\nrevoke all on public.leaky from anon, authenticated;'));
    expect(problems).toEqual(['table public.leaky has no row level security']);
  });
  it('a grant to anon or authenticated fails (default grants are not revoked)', async () => {
    const problems = await only(fixture('create table public.open (id int);\nalter table public.open enable row level security;'));
    expect(problems.some((p) => /anon holds .* on public\.open/.test(p))).toBe(true);
    expect(problems.some((p) => /authenticated holds .* on public\.open/.test(p))).toBe(true);
  });
  it('a policy for a browser role fails', async () => {
    const problems = await only(fixture(GOOD + 'create policy p on public.thing for select to anon using (true);'));
    expect(problems.some((p) => /policy p on public\.thing/.test(p))).toBe(true);
  });
  it('a function executable by anon fails', async () => {
    const problems = await only(fixture(GOOD + 'create function public.f() returns int language sql as $$ select 1 $$;'));
    expect(problems).toContain('anon can execute public.f()');
  });
  it('a sequence usable by anon fails', async () => {
    const problems = await only(fixture(GOOD + 'create sequence public.s;'));
    expect(problems).toContain('anon holds a privilege on sequence public.s');
  });
  it('a view that is not security_invoker fails', async () => {
    const problems = await only(fixture(GOOD + 'create view public.v as select id from public.thing;\nrevoke all on public.v from anon, authenticated;'));
    expect(problems).toContain('view public.v is not security_invoker');
    expect(await only(fixture(GOOD + 'create view public.v with (security_invoker = true) as select id from public.thing;\nrevoke all on public.v from anon, authenticated;'))).toEqual([]);
  });
  it('a security definer function without a fixed search_path fails', async () => {
    const problems = await only(fixture(GOOD + "create function public.f() returns int language sql security definer as $$ select 1 $$;\nrevoke all on function public.f() from public, anon, authenticated;"));
    expect(problems).toEqual(['security definer function public.f() has no fixed search_path']);
  });
  it('a misnamed or duplicate-numbered migration file is refused, not skipped', () => {
    const bad = mkdtempSync(join(tmpdir(), 'vm-mig-'));
    writeFileSync(join(bad, '001_short.sql'), 'select 1;');
    expect(() => readMigrations(bad)).toThrow(/0004_name\.sql: 001_short\.sql/);
    const upper = mkdtempSync(join(tmpdir(), 'vm-mig-'));
    writeFileSync(join(upper, '0001_Mixed.sql'), 'select 1;');
    expect(() => readMigrations(upper)).toThrow(/0001_Mixed\.sql/);
    const dup = mkdtempSync(join(tmpdir(), 'vm-mig-'));
    writeFileSync(join(dup, '0001_a.sql'), 'select 1;');
    writeFileSync(join(dup, '0001_b.sql'), 'select 1;');
    expect(() => readMigrations(dup)).toThrow(/share the number 0001/);
  });
  it('a SQL error names the migration file', async () => {
    await expect(only(fixture('create table broken (')))
      .rejects.toThrow(/^0001_test\.sql:/);
  });
  it('no migrations at all is a failure', async () => {
    expect(await only(mkdtempSync(join(tmpdir(), 'vm-empty-')))).toEqual(['no migrations found']);
  });
  it('forSchema retargets a migration and rejects a bad schema name', () => {
    expect(forSchema('create table public.a (); alter default privileges in schema public revoke all on tables from anon;', 'preview_x')).toBe(
      'create table preview_x.a (); alter default privileges in schema preview_x revoke all on tables from anon;',
    );
    expect(forSchema('x public.y', 'public')).toBe('x public.y');
    // Only real qualified names move: not a longer identifier, a quoted one, or the PUBLIC pseudo-role.
    expect(forSchema("select 'mypublic.x', \"public\".t; revoke all on a from public, anon; grant usage on schema public to b;", 'preview_x')).toBe(
      "select 'mypublic.x', \"public\".t; revoke all on a from public, anon; grant usage on schema preview_x to b;",
    );
    expect(() => forSchema('x', 'a; drop table b')).toThrow();
  });

  it('previewSql emits the schema, its grant and the retargeted migrations, and refuses other names', () => {
    const out = previewSql('preview_pr12');
    expect(out).toMatch(/^create schema preview_pr12;\ngrant usage on schema preview_pr12 to service_role;/);
    expect(out).toContain('create table preview_pr12.category');
    expect(out).not.toMatch(/\bpublic\.(category|topic)\b/);
    expect(() => previewSql('public')).toThrow();
    expect(() => previewSql('preview_x; drop schema public')).toThrow();
  });

  describe('the script exits correctly', () => {
    it('--emit prints SQL for a preview schema and exits 1 for a bad name', () => {
      const ok = spawnSync(process.execPath, [resolve('scripts/check-migrations.mjs'), '--emit', 'preview_pr1'], { encoding: 'utf8' });
      expect(ok.status).toBe(0);
      expect(ok.stdout).toContain('create schema preview_pr1;');
      expect(spawnSync(process.execPath, [resolve('scripts/check-migrations.mjs'), '--emit', 'public'], { encoding: 'utf8' }).status).toBe(1);
    });
    const script = resolve('scripts/check-migrations.mjs');
    const run = (dir: string) => spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
    it('exit 0 on a sound directory', () => {
      const r = run(fixture(GOOD));
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/migrations ok/);
    });
    it('exit 1 and the table name on a leaky one', () => {
      const dir = fixture('create table public.leaky (id int);');
      const r = run(dir);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/public\.leaky/);
    });
  });
});
