import type { Catalog, CatalogTopic, TreeNode } from '../topic-schema/catalog';

// Reading the catalog for the tree pages (Story 5.1) and the addresses of those pages. Pure.
//
// Addresses (owner decision): the tree is /{locale}/{category}/{subcategory}/{chapter}, and a topic's direct link
// is /{locale}/topic/{id}, which depends only on the permanent id, so moving a topic never breaks a link.

/** Words other pages use at the top level; no category slug may be one of them. */
export const RESERVED_SLUGS: readonly string[] = ['topic', 'search', 'map', 'help', 'about', 'privacy', 'terms', 'faq', 'contact', 'progress', 'plans', 'admin', 'api', 'dev'];

export type Loc = Record<string, string>;

export const loc = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? '';

export function treeHref(locale: string, ...slugs: (string | null | undefined)[]): string {
  const parts = slugs.filter((s): s is string => typeof s === 'string' && s !== '');
  return `/${[locale, ...parts].join('/')}`;
}

export const topicHref = (locale: string, id: string): string => `/${locale}/topic/${id}`;

export const categories = (c: Catalog): TreeNode[] => c.tree.filter((n) => n.subcategory === null);

export const subcategories = (c: Catalog, category: string): TreeNode[] => c.tree.filter((n) => n.category === category && n.subcategory !== null && n.chapter === null);

export const chapters = (c: Catalog, category: string, subcategory: string): TreeNode[] => c.tree.filter((n) => n.category === category && n.subcategory === subcategory && n.chapter !== null);

export const categoryNode = (c: Catalog, category: string): TreeNode | undefined => c.tree.find((n) => n.category === category && n.subcategory === null);

export const subcategoryNode = (c: Catalog, category: string, subcategory: string): TreeNode | undefined => c.tree.find((n) => n.category === category && n.subcategory === subcategory && n.chapter === null);

export const chapterNode = (c: Catalog, category: string, subcategory: string, chapter: string): TreeNode | undefined => c.tree.find((n) => n.category === category && n.subcategory === subcategory && n.chapter === chapter);

/** The published topics of a chapter in reading order. */
export const topicsOf = (c: Catalog, chapter: string): CatalogTopic[] => c.topics.filter((t) => t.path.chapter === chapter);

export const topicById = (c: Catalog, id: string): CatalogTopic | undefined => c.topics.find((t) => t.id === id);

/** Every published topic in reading order: the tree's order (category, subcategory, chapter), then chapter order, then id. */
export function readingOrder(c: Catalog): CatalogTopic[] {
  const at = new Map<string, number>();
  c.tree.forEach((n, i) => {
    if (n.chapter !== null) at.set(n.chapter, i);
  });
  const rank = (t: CatalogTopic) => at.get(t.path.chapter) ?? Number.MAX_SAFE_INTEGER;
  return [...c.topics].sort((a, b) => rank(a) - rank(b) || a.chapterOrder - b.chapterOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The first Foundation topic in reading order, else the first topic; where Start goes (Story 5.2). Undefined with no topics. */
export function startTopic(c: Catalog): CatalogTopic | undefined {
  const all = readingOrder(c);
  return all.find((t) => t.level === 'foundation') ?? all[0];
}

/**
 * The featured topics of Home (Story 5.2, owner decision): up to `limit`, one per category in tree order, a category
 * with no published topic skipped, its Foundation topic first and then its first in reading order. Derived, so there is
 * no flag to maintain.
 */
export function featuredTopics(c: Catalog, limit = 6): CatalogTopic[] {
  const all = readingOrder(c);
  const out: CatalogTopic[] = [];
  if (!(limit >= 1)) return out;
  for (const cat of categories(c)) {
    const own = all.filter((t) => t.path.category === cat.category);
    const pick = own.find((t) => t.level === 'foundation') ?? own[0];
    if (pick) out.push(pick);
    if (out.length >= limit) break;
  }
  return out;
}
/** A topic id as the schema allows it: lowercase letters, digits and single hyphens, 3 to 64 characters. */
export const isTopicId = (id: string): boolean => id.length >= 3 && id.length <= 64 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);

/** The topics before and after one in its chapter, in reading order (Story 5.4). */
export function chapterNeighbours(c: Catalog, id: string): { previous?: CatalogTopic; next?: CatalogTopic } {
  const own = c.topics.find((t) => t.id === id);
  if (!own) return {};
  const inChapter = topicsOf(c, own.path.chapter);
  const at = inChapter.findIndex((t) => t.id === id);
  return { previous: inChapter[at - 1], next: inChapter[at + 1] };
}

/**
 * The published topics among `ids`, in the order listed, each once, never the topic itself (Story 5.4). An id that is
 * not published (or not in the catalog) is left out, so it is neither listed nor linked (FR-1.9).
 */
export function linkedTopics(c: Catalog, ids: readonly string[] | undefined, self: string): CatalogTopic[] {
  const out: CatalogTopic[] = [];
  for (const id of ids ?? []) {
    if (id === self || out.some((t) => t.id === id)) continue;
    const t = topicById(c, id);
    if (t) out.push(t);
  }
  return out;
}

export { EMPTY_SEARCH, LEVELS, buildSearchData, formatSearchAddress, parseSearchAddress, searchTopics } from './search';
export type { SearchData, SearchEntry, SearchState } from './search';
