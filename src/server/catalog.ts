import 'server-only';
import { adminClient } from '../db/admin';
import { buildCatalog, type BuildResult, type CatalogRows, type TopicRow, type TreeRow } from '../lib/topic-schema/catalog';

// `rebuildCatalog()` (Story 5.1, AD-20): reads every row the catalog needs through a port and builds the catalog
// whole, never patching an old one. Story 7.3 calls it from the publish and unpublish saga and writes the result
// to Storage; the pages of Epic 5 read it through `getCatalog` (`catalog-source.ts`).

/** Where the rows come from: the database in production, the fixtures in the harness, anything in a test. */
export interface CatalogPort {
  read(): Promise<CatalogRows>;
}

export async function rebuildCatalog(port: CatalogPort, now: Date = new Date()): Promise<BuildResult> {
  return buildCatalog(await port.read(), now);
}

// The shapes below are the contract with `catalog_rows()` in migration 0006: a renamed key would empty the site.
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, what: string): string => {
  if (typeof v !== 'string') throw new Error(`catalog_rows: ${what} is not text`);
  return v;
};
const num = (v: unknown, what: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`catalog_rows: ${what} is not a number`);
  return v;
};
const list = (v: unknown, what: string): Record<string, unknown>[] => {
  if (!Array.isArray(v) || !v.every(isRecord)) throw new Error(`catalog_rows: ${what} is not a list`);
  return v;
};

function treeRows(v: unknown, what: string): TreeRow[] {
  return list(v, what).map((r) => ({
    id: str(r['id'], `${what}.id`),
    parent: r['parent'] === undefined || r['parent'] === null ? null : str(r['parent'], `${what}.parent`),
    nameEn: str(r['nameEn'], `${what}.nameEn`),
    nameUr: str(r['nameUr'], `${what}.nameUr`),
    position: num(r['position'], `${what}.position`),
  }));
}

/** The JSON of `catalog_rows()` as rows, refusing anything of another shape instead of guessing. */
export function parseCatalogRows(data: unknown): CatalogRows {
  if (!isRecord(data)) throw new Error('catalog_rows: not an object');
  const topics: TopicRow[] = list(data['topics'], 'topics').map((r) => ({
    id: str(r['id'], 'topics.id'),
    chapter: str(r['chapter'], 'topics.chapter'),
    level: str(r['level'], 'topics.level'),
    chapterOrder: num(r['chapterOrder'], 'topics.chapterOrder'),
    publishedHash: r['publishedHash'] === null || r['publishedHash'] === undefined ? null : str(r['publishedHash'], 'topics.publishedHash'),
    deleted: r['deleted'] === true,
    everPublished: r['everPublished'] === true,
    meta: isRecord(r['meta']) ? r['meta'] : null,
  }));
  return { categories: treeRows(data['categories'], 'categories'), subcategories: treeRows(data['subcategories'], 'subcategories'), chapters: treeRows(data['chapters'], 'chapters'), topics };
}

/** The port over the database: one call to `catalog_rows()`, so the whole catalog is one snapshot. Null when no database is configured. */
export function databasePort(): CatalogPort | null {
  const client = adminClient();
  if (!client) return null;
  return {
    async read() {
      const { data, error } = await client.rpc('catalog_rows');
      if (error) throw new Error('catalog_rows failed');
      return parseCatalogRows(data);
    },
  };
}
