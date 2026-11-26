// CI check (AD-8, AD-24): apply every migration on a real Postgres (PGlite) and fail if any table in
// `public` lacks row level security, if anon or authenticated holds any privilege or policy, or if a
// view is not security_invoker. Part of `npm run check`.
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

export const MIGRATIONS_DIR = 'supabase/migrations';

/** Supabase's roles, and the default grants it gives them, so a migration that forgets to revoke shows up. */
const SETUP = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/** The same migration, targeting another schema (the throwaway preview schema, AD-24). */
export function forSchema(sql, schema) {
  if (!SCHEMA_NAME.test(schema)) throw new Error(`invalid schema name: ${schema}`);
  if (schema === 'public') return sql;
  return sql
    .replace(/(?<![\w"])public\./g, `${schema}.`) // a qualified name; not "mypublic." and not the PUBLIC pseudo-role
    .replace(/\b(in|on) schema public\b/g, `$1 schema ${schema}`);
}

export function readMigrations(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.sql'));
  // A misnamed file would be skipped here yet still be applied in production: refuse it.
  const bad = files.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f));
  if (bad.length > 0) throw new Error(`migration file names must look like 0004_name.sql: ${bad.join(', ')}`);
  const prefixes = files.map((f) => f.slice(0, 4));
  const dup = prefixes.filter((p, i) => prefixes.indexOf(p) !== i);
  if (dup.length > 0) throw new Error(`two migrations share the number ${dup[0]}`);
  return files.sort().map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

/** Applies the migrations in order; returns the database. Throws with the file name on a SQL error. */
export async function applyMigrations(migrations, schema = 'public') {
  const db = new PGlite();
  await db.exec(SETUP);
  if (schema !== 'public') {
    if (!SCHEMA_NAME.test(schema)) throw new Error(`invalid schema name: ${schema}`);
    await db.exec(`create schema ${schema}; grant usage on schema ${schema} to anon, authenticated, service_role;` +
      ['tables', 'sequences', 'functions'].map((k) => ` alter default privileges in schema ${schema} grant all on ${k} to anon, authenticated, service_role;`).join(''));
  }
  for (const m of migrations) {
    try {
      await db.exec(forSchema(m.sql, schema));
    } catch (error) {
      await db.close();
      throw new Error(`${m.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return db;
}

/** Returns a list of problems (empty when the schema is sound). */
export async function findProblems(db, schema = 'public') {
  if (!SCHEMA_NAME.test(schema)) throw new Error(`invalid schema name: ${schema}`);
  const ns = `'${schema}'::regnamespace`;
  const problems = [];
  const q = async (sql) => (await db.query(sql)).rows;

  for (const t of await q(`select relname from pg_class where relnamespace = ${ns} and relkind in ('r','p') and not relrowsecurity`)) {
    problems.push(`table ${schema}.${t.relname} has no row level security`);
  }
  for (const p of await q(`select tablename, policyname from pg_policies where schemaname = '${schema}' and (roles && array['anon','authenticated','public']::name[])`)) {
    problems.push(`policy ${p.policyname} on ${schema}.${p.tablename} applies to a browser role`);
  }
  for (const g of await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = '${schema}' and grantee in ('anon','authenticated','PUBLIC') limit 20`)) {
    problems.push(`${g.grantee} holds ${g.privilege_type} on ${schema}.${g.table_name}`);
  }
  for (const s of await q(`select c.relname, r.rolname from pg_class c cross join pg_roles r where c.relnamespace = ${ns} and c.relkind = 'S' and r.rolname in ('anon','authenticated') and (has_sequence_privilege(r.rolname, c.oid, 'usage') or has_sequence_privilege(r.rolname, c.oid, 'select') or has_sequence_privilege(r.rolname, c.oid, 'update'))`)) {
    problems.push(`${s.rolname} holds a privilege on sequence ${schema}.${s.relname}`);
  }
  for (const f of await q(`select p.proname, r.rolname from pg_proc p cross join pg_roles r where p.pronamespace = ${ns} and r.rolname in ('anon','authenticated') and has_function_privilege(r.rolname, p.oid, 'execute')`)) {
    problems.push(`${f.rolname} can execute ${schema}.${f.proname}()`);
  }
  for (const v of await q(`select relname from pg_class where relnamespace = ${ns} and relkind in ('v','m') and not coalesce((select 'security_invoker=true' = any(reloptions) from pg_class x where x.oid = pg_class.oid), false)`)) {
    problems.push(`view ${schema}.${v.relname} is not security_invoker`);
  }
  for (const f of await q(`select proname from pg_proc where pronamespace = ${ns} and prosecdef and not coalesce(proconfig::text like '%search_path=%', false)`)) {
    problems.push(`security definer function ${schema}.${f.proname}() has no fixed search_path`);
  }
  return problems;
}

/** The SQL to run on Supabase to create a throwaway preview schema (AD-24). */
export function previewSql(schema, migrations = readMigrations()) {
  if (!/^preview_[a-z0-9_]{1,55}$/.test(schema)) throw new Error('a preview schema is named preview_<name>');
  const head = `create schema ${schema};\ngrant usage on schema ${schema} to service_role;\n`;
  return head + migrations.map((x) => `-- ${x.name}\n${forSchema(x.sql, schema)}`).join('\n');
}

export async function checkMigrations(dir = MIGRATIONS_DIR, schemas = ['public', 'preview_ci']) {
  const migrations = readMigrations(dir);
  if (migrations.length === 0) return ['no migrations found'];
  const problems = [];
  for (const schema of schemas) {
    const db = await applyMigrations(migrations, schema);
    try {
      problems.push(...(await findProblems(db, schema)));
    } finally {
      await db.close();
    }
  }
  return problems;
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain && process.argv[2] === '--emit') {
  try {
    console.log(previewSql(process.argv[3] ?? ''));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
} else if (isMain) {
  checkMigrations(process.argv[2] ?? MIGRATIONS_DIR).then(
    (problems) => {
      if (problems.length > 0) {
        console.error('migration check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
        process.exit(1);
      }
      console.log(`migrations ok (${readMigrations(process.argv[2] ?? MIGRATIONS_DIR).length} applied)`);
    },
    (error) => {
      console.error(`migration check failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    },
  );
}
