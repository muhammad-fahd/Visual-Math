import { beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, readMigrations } from '../../scripts/check-migrations.mjs';
import type { PGlite } from '@electric-sql/pglite';

// Migrations 0001 to 0003 on a real Postgres with Supabase's roles and default grants.
let db: PGlite;
beforeAll(async () => {
  db = await applyMigrations(readMigrations());
});

const h = (c: string) => `sha256:${c.repeat(64).slice(0, 64)}`;
/** A chapter to hang topics on, and helpers; each test uses its own ids. */
async function chapter() {
  await db.query("insert into public.subcategory (id, category_id, name_en, name_ur, position) values ($1, 'algebra', 'S', 'ایس', 1) on conflict do nothing", ['sub']);
  await db.query("insert into public.chapter (id, subcategory_id, name_en, name_ur, position) values ($1, 'sub', 'C', 'سی', 1) on conflict do nothing", ['chap']);
  return 'chap';
}
async function topic(id: string) {
  await db.query("insert into public.topic (id, chapter_id, level, chapter_order, wave) values ($1, $2, 'foundation', 1, 1)", [id, await chapter()]);
}
async function version(topicId: string, c: string, seq: number) {
  await db.query('insert into public.topic_version (topic_id, content_hash, seq, doc) values ($1, $2, $3, $4)', [topicId, h(c), seq, { a: 1 }]);
}
const as = async (role: string, sql: string) => {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
};

describe('seed (SRS 5.2)', () => {
  it('the twelve categories, in order, with names in both languages', async () => {
    const rows = (await db.query<{ id: string; name_en: string; name_ur: string; position: number }>('select * from public.category order by position')).rows;
    expect(rows.map((r) => r.name_en)).toEqual([
      'Arithmetic and Numbers', 'Algebra', 'Geometry', 'Trigonometry', 'Coordinate Geometry', 'Functions and Graphs',
      'Vectors', 'Complex Numbers', 'Calculus', 'Series and Discrete Maths', 'Statistics and Probability', 'Linear Algebra',
    ]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const r of rows) {
      expect(r.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(r.name_ur).toMatch(/[؀-ۿ]/);
    }
  });
  it('no subcategory or chapter is seeded', async () => {
    const fresh = await applyMigrations(readMigrations());
    expect(Number((await fresh.query<{ n: string }>('select (select count(*) from public.subcategory) + (select count(*) from public.chapter) as n')).rows[0]!.n)).toBe(0);
    await fresh.close();
  });
  it('running the seed again keeps an admin rename and adds no duplicate', async () => {
    const fresh = await applyMigrations(readMigrations());
    await fresh.query("update public.category set name_en = 'Maths of Shapes' where id = 'geometry'");
    const seed = readMigrations().find((m: { name: string }) => m.name.startsWith('0003'))!.sql;
    await fresh.exec(seed);
    expect((await fresh.query<{ name_en: string }>("select name_en from public.category where id = 'geometry'")).rows[0]!.name_en).toBe('Maths of Shapes');
    expect(Number((await fresh.query<{ n: string }>('select count(*) as n from public.category')).rows[0]!.n)).toBe(12);
    await fresh.close();
  });
});

describe('one published version per topic (AD-19)', () => {
  it('publishing names a version of the same topic; unpublished is null', async () => {
    await topic('t-one');
    await version('t-one', 'a', 1);
    await version('t-one', 'b', 2);
    await db.query('update public.topic set latest_hash = $2, published_hash = $2 where id = $1', ['t-one', h('a')]);
    await db.query('update public.topic set published_hash = $2 where id = $1', ['t-one', h('b')]); // moves, never two
    const row = (await db.query<{ published_hash: string }>("select published_hash from public.topic where id = 't-one'")).rows[0]!;
    expect(row.published_hash).toBe(h('b'));
    await db.query("update public.topic set published_hash = null where id = 't-one'");
  });
  it('a hash of another topic, or a missing hash, is refused', async () => {
    await topic('t-two');
    await topic('t-three');
    await version('t-three', 'c', 1);
    await expect(db.query('update public.topic set published_hash = $2 where id = $1', ['t-two', h('c')])).rejects.toThrow();
    await expect(db.query('update public.topic set published_hash = $2 where id = $1', ['t-two', h('f')])).rejects.toThrow();
    await expect(db.query('update public.topic set latest_hash = $2 where id = $1', ['t-two', h('c')])).rejects.toThrow();
  });
  it('a published version cannot be deleted from under its topic', async () => {
    await topic('t-four');
    await version('t-four', 'd', 1);
    await db.query('update public.topic set published_hash = $2 where id = $1', ['t-four', h('d')]);
    await expect(db.query('delete from public.topic_version where topic_id = $1', ['t-four'])).rejects.toThrow();
  });
  it('the same version identity twice is refused', async () => {
    await topic('t-five');
    await version('t-five', 'e', 1);
    await expect(version('t-five', 'e', 2)).rejects.toThrow(); // same hash
    await expect(version('t-five', 'f', 1)).rejects.toThrow(); // same seq
  });
  it('a stored version is immutable except published_at', async () => {
    await topic('t-six');
    await version('t-six', '1', 1);
    for (const set of ["doc = '{\"a\":2}'", 'seq = 9', 'cost = 5', "content_hash = '" + h('2') + "'"]) {
      await expect(db.query(`update public.topic_version set ${set} where topic_id = 't-six'`), set).rejects.toThrow();
    }
    await db.query("update public.topic_version set published_at = now() where topic_id = 't-six'");
  });
});

describe('deletion and slugs (AD-19)', () => {
  it('a published topic cannot be marked deleted; an unpublished one can', async () => {
    await topic('t-seven');
    await version('t-seven', '3', 1);
    await db.query('update public.topic set published_hash = $2 where id = $1', ['t-seven', h('3')]);
    await expect(db.query("update public.topic set deleted_at = now() where id = 't-seven'")).rejects.toThrow();
    await db.query("update public.topic set published_hash = null where id = 't-seven'");
    await db.query("update public.topic set deleted_at = now() where id = 't-seven'");
  });
  it('a slug stays reserved after a hard delete', async () => {
    await topic('t-eight');
    await db.query("delete from public.topic where id = 't-eight'");
    await expect(topic('t-eight')).rejects.toThrow();
  });
  it('a topic id never changes', async () => {
    await topic('t-nine');
    await expect(db.query("update public.topic set id = 't-ten' where id = 't-nine'")).rejects.toThrow();
  });
  it('the slug reservation is append-only for the service role', async () => {
    await topic('t-slug');
    await expect(as('service_role', "delete from public.topic_slug where slug = 't-slug'")).rejects.toThrow(/permission denied/);
    await expect(as('service_role', "update public.topic_slug set slug = 'x' where slug = 't-slug'")).rejects.toThrow(/permission denied/);
    expect((await as('service_role', "select slug from public.topic_slug where slug = 't-slug'")).rows).toHaveLength(1);
  });
});

describe('bad values are refused', () => {
  beforeAll(async () => {
    await topic('t-one-bad'); // the rows the cases below point at, created here so each case fails for its own reason
  });
  it.each([
    ['capital slug', "insert into public.category (id, name_en, name_ur, position) values ('Bad', 'a', 'ب', 1)"],
    ['slug with underscore', "insert into public.category (id, name_en, name_ur, position) values ('a_b', 'a', 'ب', 1)"],
    ['empty English name', "insert into public.category (id, name_en, name_ur, position) values ('ok-1', '  ', 'ب', 1)"],
    ['empty Urdu name', "insert into public.category (id, name_en, name_ur, position) values ('ok-2', 'a', '', 1)"],
    ['negative position', "insert into public.category (id, name_en, name_ur, position) values ('ok-3', 'a', 'ب', -1)"],
    ['unknown parent', "insert into public.subcategory (id, category_id, name_en, name_ur, position) values ('x1', 'nope', 'a', 'ب', 1)"],
    ['level outside the three', "insert into public.topic (id, chapter_id, level, chapter_order, wave) values ('lvl', 'chap', 'expert', 1, 1)"],
    ['wave zero', "insert into public.topic (id, chapter_id, level, chapter_order, wave) values ('wv', 'chap', 'advanced', 1, 0)"],
    ['hash without the prefix', "insert into public.topic_version (topic_id, content_hash, seq, doc) values ('t-one-bad', 'abc', 9, '{}')"],
    ['hash with capitals', "insert into public.topic_version (topic_id, content_hash, seq, doc) values ('t-one-bad', 'sha256:" + 'A'.repeat(64) + "', 9, '{}')"],
    ['version of a missing topic', "insert into public.topic_version (topic_id, content_hash, seq, doc) values ('ghost', '" + h('9') + "', 1, '{}')"],
  ])('%s', async (_name, sql) => {
    await expect(db.query(sql)).rejects.toThrow();
  });
  it('a category with subcategories cannot be deleted', async () => {
    await chapter();
    await expect(db.query("delete from public.category where id = 'algebra'")).rejects.toThrow();
  });
});

describe('the browser roles reach nothing (AD-8)', () => {
  const tables = ['category', 'subcategory', 'chapter', 'topic', 'topic_version', 'topic_slug'];
  it.each(['anon', 'authenticated'])('%s cannot read or write the new tables', async (role) => {
    for (const t of tables) {
      await expect(as(role, `select * from public.${t}`)).rejects.toThrow(/permission denied/);
      await expect(as(role, `insert into public.${t} default values`)).rejects.toThrow(/permission denied/);
    }
  });
  it('the service role cannot truncate (which would skip the immutability triggers), and cannot edit admin accounts', async () => {
    for (const t of ['topic_version', 'topic', 'category']) {
      await expect(as('service_role', `truncate public.${t} cascade`)).rejects.toThrow(/permission denied/);
    }
    await expect(as('service_role', 'update public.admin_user set created_at = now()')).rejects.toThrow(/permission denied/);
    await expect(as('service_role', 'insert into public.admin_user (user_id) values (gen_random_uuid())')).rejects.toThrow(/permission denied/);
    await expect(as('service_role', 'select * from public.login_throttle')).rejects.toThrow(/permission denied/);
  });
  it('the service role reads the seed and edits the tree', async () => {
    expect((await as('service_role', 'select id from public.category')).rows).toHaveLength(12);
    await as('service_role', "update public.category set position = position where id = 'algebra'");
  });
});
