import { plainText } from '../text';

// The catalog (Story 5.1, AD-20): everything a visitor page needs to list the tree and its published topics,
// built whole from the database rows, never patched. This file is pure: the rows come in, the catalog comes
// out, the same rows always give the same catalog apart from `generatedAt`. Reading the rows is the server's job
// (`server/catalog.ts`); writing the file to Storage and revalidating pages is Story 7.3.
//
// Only a topic that is published (`publishedHash` set) and not deleted is in `topics`, in a count, or in a
// link (FR-1.9). One that was published once and is not now is a tombstone: the viewer refuses to start it.

export const CATALOG_VERSION = 1;

type Loc = Record<string, string>;
export type Level = 'foundation' | 'intermediate' | 'advanced';

/** One node of the tree. A category has `subcategory` and `chapter` null; a subcategory has `chapter` null. */
export interface TreeNode {
  category: string;
  subcategory: string | null;
  chapter: string | null;
  name: Loc;
  order: number;
  /** Published topics at or below this node. */
  count: number;
}

export interface CatalogTopic {
  id: string;
  hash: string;
  path: { category: string; subcategory: string; chapter: string };
  chapterOrder: number;
  level: Level;
  estimatedMinutes: number;
  title: Loc;
  summary: Loc;
  prerequisites: string[];
  next: string[];
  /** Lowercase words of the title, summary and tags per language; Story 5.3 folds them with `normalizeSearch`. */
  searchTokens: Loc;
  /** `topics/{id}/{hash}.thumb.svg` once Story 7.3 renders it; null until then. */
  thumb: string | null;
}

export interface Catalog {
  version: typeof CATALOG_VERSION;
  generatedAt: string;
  tree: TreeNode[];
  topics: CatalogTopic[];
  tombstones: { id: string }[];
}

/** One tree row as the database holds it. */
export interface TreeRow {
  id: string;
  /** The id of the parent row; null for a category. */
  parent: string | null;
  nameEn: string;
  nameUr: string;
  position: number;
}

/** What the published version of a topic contributes. Read defensively: it is a JSON column. */
export interface TopicMeta {
  title?: unknown;
  summary?: unknown;
  tags?: unknown;
  estimatedMinutes?: unknown;
  prerequisites?: unknown;
  next?: unknown;
}

export interface TopicRow {
  id: string;
  chapter: string;
  level: string;
  chapterOrder: number;
  publishedHash: string | null;
  deleted: boolean;
  everPublished: boolean;
  /** Null unless the topic is published. */
  meta: TopicMeta | null;
}

export interface CatalogRows {
  categories: TreeRow[];
  subcategories: TreeRow[];
  chapters: TreeRow[];
  topics: TopicRow[];
}

export interface BuildResult {
  catalog: Catalog;
  /** Published topics left out because their stored document lacked a field the catalog needs. Never silent. */
  skipped: { id: string; reason: string }[];
}

const LEVELS: readonly string[] = ['foundation', 'intermediate', 'advanced'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A `{en, ur}` text with at least an English value, keeping only string values; null if it is not one. */
function locOf(v: unknown): Loc | null {
  if (!isRecord(v)) return null;
  const out: Loc = {};
  for (const [k, x] of Object.entries(v)) if (typeof x === 'string' && x.trim() !== '') out[k] = x;
  return typeof out['en'] === 'string' ? out : null;
}

const idsOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function tokensOf(title: Loc, summary: Loc, tags: unknown): Loc {
  const out: Loc = {};
  for (const lang of new Set([...Object.keys(title), ...Object.keys(summary)])) {
    const list = isRecord(tags) && Array.isArray(tags[lang]) ? (tags[lang] as unknown[]).filter((t): t is string => typeof t === 'string') : [];
    out[lang] = [title[lang] ?? title['en'] ?? '', summary[lang] ?? '', ...list].map((s) => plainText(s ?? '').toLowerCase()).join(' ').replace(/\s+/g, ' ').trim();
  }
  return out;
}

const byOrder = <T extends { position: number; id: string }>(a: T, b: T) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const nameOf = (r: TreeRow): Loc => ({ en: r.nameEn, ur: r.nameUr.trim() === '' ? r.nameEn : r.nameUr });

export function buildCatalog(rows: CatalogRows, now: Date): BuildResult {
  const skipped: BuildResult['skipped'] = [];
  const subs = new Map(rows.subcategories.map((r) => [r.id, r]));
  const chapters = new Map(rows.chapters.map((r) => [r.id, r]));
  const categories = new Map(rows.categories.map((r) => [r.id, r]));

  const topics: CatalogTopic[] = [];
  const tombstones: { id: string }[] = [];
  for (const row of [...rows.topics].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const live = row.publishedHash !== null && !row.deleted;
    if (!live) {
      if (row.everPublished) tombstones.push({ id: row.id });
      continue;
    }
    const chapter = chapters.get(row.chapter);
    const sub = chapter ? subs.get(chapter.parent ?? '') : undefined;
    const category = sub ? categories.get(sub.parent ?? '') : undefined;
    const meta = row.meta ?? {};
    const title = locOf(meta.title);
    const summary = locOf(meta.summary);
    const minutes = meta.estimatedMinutes;
    const reason = !chapter || !sub || !category ? 'its chapter is not in the tree' : !title ? 'no title' : !summary ? 'no summary' : !LEVELS.includes(row.level) ? 'unknown level' : typeof minutes !== 'number' ? 'no estimated minutes' : '';
    if (reason || !chapter || !sub || !category || !title || !summary || row.publishedHash === null || typeof minutes !== 'number') {
      skipped.push({ id: row.id, reason: reason || 'incomplete' });
      continue;
    }
    topics.push({
      id: row.id,
      hash: row.publishedHash,
      path: { category: category.id, subcategory: sub.id, chapter: chapter.id },
      chapterOrder: row.chapterOrder,
      level: row.level as Level,
      estimatedMinutes: minutes,
      title,
      summary,
      prerequisites: idsOf(meta.prerequisites),
      next: idsOf(meta.next),
      searchTokens: tokensOf(title, summary, meta.tags),
      thumb: null,
    });
  }
  topics.sort((a, b) => (a.path.chapter < b.path.chapter ? -1 : a.path.chapter > b.path.chapter ? 1 : 0) || a.chapterOrder - b.chapterOrder || (a.id < b.id ? -1 : 1));

  const perChapter = new Map<string, number>();
  const perSub = new Map<string, number>();
  const perCategory = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const t of topics) {
    bump(perChapter, t.path.chapter);
    bump(perSub, t.path.subcategory);
    bump(perCategory, t.path.category);
  }

  const tree: TreeNode[] = [];
  for (const c of [...rows.categories].sort(byOrder)) {
    tree.push({ category: c.id, subcategory: null, chapter: null, name: nameOf(c), order: c.position, count: perCategory.get(c.id) ?? 0 });
    for (const s of rows.subcategories.filter((x) => x.parent === c.id).sort(byOrder)) {
      tree.push({ category: c.id, subcategory: s.id, chapter: null, name: nameOf(s), order: s.position, count: perSub.get(s.id) ?? 0 });
      for (const h of rows.chapters.filter((x) => x.parent === s.id).sort(byOrder)) {
        tree.push({ category: c.id, subcategory: s.id, chapter: h.id, name: nameOf(h), order: h.position, count: perChapter.get(h.id) ?? 0 });
      }
    }
  }

  return { catalog: { version: CATALOG_VERSION, generatedAt: now.toISOString(), tree, topics, tombstones }, skipped };
}
