import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, readMigrations } from '../../scripts/check-migrations.mjs';
import type { PGlite } from '@electric-sql/pglite';

// Story 5.1: the server side of the catalog. `catalog_rows()` (migration 0006) is run on a real Postgres with
// Supabase's roles; its answer goes through the same parser and builder the server uses.
const state = vi.hoisted(() => ({ rpc: vi.fn(), client: true }));
vi.mock('../../src/db/admin', () => ({ adminClient: () => (state.client ? { rpc: state.rpc } : null) }));

import { databasePort, parseCatalogRows, rebuildCatalog } from '../../src/server/catalog';
import { fixtureRows, fixturePort } from '../../src/server/fixture-catalog';
import { emptyCatalog, getCatalog } from '../../src/server/catalog-source';

let db: PGlite;
beforeAll(async () => {
  db = await applyMigrations(readMigrations());
});
beforeEach(() => {
  state.rpc = vi.fn();
  state.client = true;
  vi.unstubAllEnvs();
});

const h = (c: string) => `sha256:${c.repeat(64).slice(0, 64)}`;
const doc = (title: string, extra: Record<string, unknown> = {}) => ({ title: { en: title, ur: `${title}-ur` }, summary: { en: `About ${title}`, ur: 'خلاصہ' }, tags: { en: ['t'], ur: ['ٹ'] }, estimatedMinutes: 9, ...extra, heavy: 'x'.repeat(200) });

async function seed() {
  await db.query("insert into public.subcategory (id, category_id, name_en, name_ur, position) values ('cat-sub', 'algebra', 'Sub', 'ذیلی', 1)");
  await db.query("insert into public.chapter (id, subcategory_id, name_en, name_ur, position) values ('cat-chap', 'cat-sub', 'Chap', 'باب', 1)");
  const add = async (id: string, extra = '') => db.query(`insert into public.topic (id, chapter_id, level, chapter_order, wave) values ($1, 'cat-chap', 'intermediate', 2, 1)${extra}`, [id]);
  const ver = (id: string, c: string, seq: number, published: boolean, d: object) =>
    db.query('insert into public.topic_version (topic_id, content_hash, seq, doc, published_at) values ($1, $2, $3, $4, $5)', [id, h(c), seq, d, published ? new Date('2026-01-01') : null]);
  // published, with a newer unpublished version after it: the catalog carries the published one
  await add('cat-pub');
  await ver('cat-pub', 'a', 1, true, doc('First', { prerequisites: ['cat-pre'], next: ['cat-nxt'] }));
  await ver('cat-pub', 'b', 2, false, doc('Second draft'));
  await db.query("update public.topic set published_hash = $1, latest_hash = $2 where id = 'cat-pub'", [h('a'), h('b')]);
  // published once, now unpublished
  await add('cat-unpub');
  await ver('cat-unpub', 'c', 1, true, doc('Withdrawn'));
  // published once, now deleted
  await add('cat-gone');
  await ver('cat-gone', 'd', 1, true, doc('Deleted'));
  await db.query("update public.topic set deleted_at = now() where id = 'cat-gone'");
  // never published
  await add('cat-draft');
  await ver('cat-draft', 'e', 1, false, doc('Draft'));
}

describe('catalog_rows() on a real Postgres', () => {
  it('returns the tree and every topic in one document, with the published version’s fields only', async () => {
    await seed();
    const raw = (await db.query<{ catalog_rows: unknown }>('select public.catalog_rows()')).rows[0]!.catalog_rows;
    const rows = parseCatalogRows(raw);
    expect(rows.categories).toHaveLength(12);
    expect(rows.categories[0]).toMatchObject({ id: 'arithmetic-and-numbers', parent: null, nameEn: 'Arithmetic and Numbers', position: 1 });
    expect(rows.subcategories).toEqual([{ id: 'cat-sub', parent: 'algebra', nameEn: 'Sub', nameUr: 'ذیلی', position: 1 }]);
    expect(rows.chapters[0]).toMatchObject({ id: 'cat-chap', parent: 'cat-sub' });
    const byId = Object.fromEntries(rows.topics.map((t) => [t.id, t]));
    expect(byId['cat-pub']).toMatchObject({ publishedHash: h('a'), deleted: false, everPublished: true, level: 'intermediate', chapterOrder: 2 });
    expect(byId['cat-pub']!.meta).toMatchObject({ title: { en: 'First' }, estimatedMinutes: 9, prerequisites: ['cat-pre'], next: ['cat-nxt'] });
    expect(JSON.stringify(raw)).not.toContain('heavy'); // never the whole document
    expect(JSON.stringify(raw)).not.toContain('Second draft'); // the published version, not the latest
    expect(byId['cat-unpub']).toMatchObject({ publishedHash: null, everPublished: true, meta: null });
    expect(byId['cat-gone']).toMatchObject({ deleted: true, everPublished: true, meta: null });
    expect(byId['cat-draft']).toMatchObject({ publishedHash: null, everPublished: false, meta: null });
  });

  it('rebuildCatalog over it: the published topic only, counts up the tree, the others tombstoned or absent', async () => {
    const raw = (await db.query<{ catalog_rows: unknown }>('select public.catalog_rows()')).rows[0]!.catalog_rows;
    const { catalog, skipped } = await rebuildCatalog({ read: async () => parseCatalogRows(raw) }, new Date('2026-11-28T00:00:00Z'));
    expect(skipped).toEqual([]);
    expect(catalog.topics.map((t) => t.id)).toEqual(['cat-pub']);
    expect(catalog.topics[0]!.path).toEqual({ category: 'algebra', subcategory: 'cat-sub', chapter: 'cat-chap' });
    expect(catalog.tombstones).toEqual([{ id: 'cat-gone' }, { id: 'cat-unpub' }]);
    expect(catalog.tree.find((n) => n.category === 'algebra' && n.subcategory === null)!.count).toBe(1);
    expect(catalog.tree.filter((n) => n.subcategory === null)).toHaveLength(12);
  });

  it('only the service role may call it', async () => {
    await db.exec('set role anon');
    await expect(db.query('select public.catalog_rows()')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await db.exec('set role authenticated');
    await expect(db.query('select public.catalog_rows()')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await db.exec('set role service_role');
    expect((await db.query('select public.catalog_rows()')).rows).toHaveLength(1);
    await db.exec('reset role');
  });

  it('an empty database gives empty lists, not nulls', async () => {
    const fresh = await applyMigrations(readMigrations());
    const raw = (await fresh.query<{ catalog_rows: Record<string, unknown[]> }>('select public.catalog_rows()')).rows[0]!.catalog_rows;
    expect(raw['subcategories']).toEqual([]);
    expect(raw['topics']).toEqual([]);
    await fresh.close();
  });
});

describe('parseCatalogRows refuses a document of another shape', () => {
  const good = { categories: [], subcategories: [], chapters: [], topics: [] };
  it('accepts the empty document', () => expect(parseCatalogRows(good)).toEqual({ categories: [], subcategories: [], chapters: [], topics: [] }));
  it.each([
    ['null', null],
    ['a list', []],
    ['no topics', { ...good, topics: undefined }],
    ['a topic without an id', { ...good, topics: [{ chapter: 'c', level: 'foundation', chapterOrder: 1 }] }],
    ['a tree row without a name', { ...good, categories: [{ id: 'a', position: 1, nameUr: 'x' }] }],
    ['a position that is text', { ...good, chapters: [{ id: 'a', parent: 'b', nameEn: 'a', nameUr: 'a', position: '1' }] }],
  ])('%s', (_name, value) => expect(() => parseCatalogRows(value)).toThrow(/catalog_rows/));
});

describe('databasePort and getCatalog', () => {
  it('calls the function by its SQL name with no arguments', async () => {
    state.rpc = vi.fn(async () => ({ data: { categories: [], subcategories: [], chapters: [], topics: [] }, error: null }));
    const port = databasePort()!;
    await port.read();
    expect(state.rpc).toHaveBeenCalledWith('catalog_rows');
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('supabase/migrations/0006_catalog_rows.sql', 'utf8')).toMatch(/create function public\.catalog_rows\(\) returns jsonb/);
  });
  it('a database error throws, without the database’s message', async () => {
    state.rpc = vi.fn(async () => ({ data: null, error: { message: 'connection refused at postgres://u:p@h' } }));
    await expect(databasePort()!.read()).rejects.toThrow('catalog_rows failed');
  });
  it('no database configured: no port', () => {
    state.client = false;
    expect(databasePort()).toBeNull();
  });
  it('the empty catalog has no tree and no topics', () => {
    const c = emptyCatalog();
    expect(c.tree).toEqual([]);
    expect(c.topics).toEqual([]);
  });
});

describe('the fixture rows of the harness', () => {
  it('place every fixture topic in a real chapter, with one unpublished and one deleted', async () => {
    const rows = fixtureRows();
    const chapterIds = new Set(rows.chapters.map((c) => c.id));
    for (const t of rows.topics) expect(chapterIds.has(t.chapter)).toBe(true);
    const { catalog, skipped } = await rebuildCatalog(fixturePort);
    expect(skipped).toEqual([]);
    expect(catalog.topics).toHaveLength(11);
    expect(catalog.tombstones.map((t) => t.id).sort()).toEqual(['stats-dice', 'trig-right-triangle']);
    expect(catalog.topics.map((t) => t.id)).not.toContain('stats-dice');
    expect(catalog.tree.filter((n) => n.subcategory === null)).toHaveLength(12);
  });
  it('getCatalog uses them only under VM_HARNESS=1', async () => {
    vi.stubEnv('VM_HARNESS', '1');
    expect((await getCatalog()).topics.length).toBeGreaterThan(0);
  });
  it('and otherwise reads the database, or is empty with none', async () => {
    vi.stubEnv('VM_HARNESS', '');
    // `cache` memoizes only within one request; outside a request each call runs again
    state.client = false;
    expect((await getCatalog()).tree).toEqual([]);
    state.client = true;
    state.rpc = vi.fn(async () => ({ data: { categories: [{ id: 'c', parent: null, nameEn: 'C', nameUr: 'سی', position: 1 }], subcategories: [], chapters: [], topics: [] }, error: null }));
    expect((await getCatalog()).tree.map((n) => n.category)).toEqual(['c']);
  });
});
