import { normalizeSearch, plainText } from '../text';
import type { Catalog, Level, TreeNode } from '../topic-schema/catalog';
import { categories as categoryNodes, loc, readingOrder, subcategoryNode, chapterNode, categoryNode } from './index';

// Search over the catalog (Story 5.3, FR-1.4, 1.5, AD-21). Pure: the server builds `SearchData` from the catalog, the
// browser runs `searchTopics` on it. The same `normalizeSearch` folds the stored words and what the visitor types.

export const LEVELS: readonly Level[] = ['foundation', 'intermediate', 'advanced'];

/** One published topic, reduced to what the search page shows and matches. */
export interface SearchEntry {
  id: string;
  title: string;
  summary: string;
  level: Level;
  minutes: number;
  category: string;
  /** Names of category, subcategory and chapter, in the page's language. */
  path: [string, string, string];
  /** Folded title, and folded title with summary and tags. */
  titleWords: string;
  words: string;
}

export interface SearchData {
  /** In reading order. */
  topics: SearchEntry[];
  /** The categories, for the chips and for the nothing-found block. */
  categories: TreeNode[];
}

export function buildSearchData(catalog: Catalog, locale: string): SearchData {
  const topics = readingOrder(catalog).map((t): SearchEntry => {
    const { category, subcategory, chapter } = t.path;
    const name = (n: TreeNode | undefined, fallback: string) => (n ? loc(n.name, locale) : fallback);
    const title = plainText(loc(t.title, locale));
    return {
      id: t.id,
      title,
      summary: plainText(loc(t.summary, locale)),
      level: t.level,
      minutes: t.estimatedMinutes,
      category,
      path: [name(categoryNode(catalog, category), category), name(subcategoryNode(catalog, category, subcategory), subcategory), name(chapterNode(catalog, category, subcategory, chapter), chapter)],
      titleWords: normalizeSearch(title),
      words: t.searchTokens[locale] ?? t.searchTokens['en'] ?? '',
    };
  });
  return { topics, categories: categoryNodes(catalog) };
}

export interface SearchState {
  q: string;
  cats: string[];
  levels: Level[];
}

export const EMPTY_SEARCH: SearchState = { q: '', cats: [], levels: [] };

/**
 * The topics for a state. Every word of the query must be part of a topic's words (title, summary, tags); topics whose
 * title holds every word come first, then the rest, each group in reading order. A blank query matches everything, so
 * the filters work on their own. Filters narrow: a topic must be in one of the chosen categories and one of the chosen
 * levels (a group with nothing chosen allows all).
 */
export function searchTopics(data: SearchData, state: SearchState): SearchEntry[] {
  const words = normalizeSearch(state.q).split(' ').filter(Boolean);
  const hits: { entry: SearchEntry; inTitle: boolean }[] = [];
  for (const entry of data.topics) {
    if (state.cats.length > 0 && !state.cats.includes(entry.category)) continue;
    if (state.levels.length > 0 && !state.levels.includes(entry.level)) continue;
    if (!words.every((w) => entry.words.includes(w) || entry.titleWords.includes(w))) continue;
    hits.push({ entry, inTitle: words.every((w) => entry.titleWords.includes(w)) });
  }
  return [...hits.filter((h) => h.inTitle), ...hits.filter((h) => !h.inTitle)].map((h) => h.entry);
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_QUERY = 200;

type Params = { get(name: string): string | null };

const first = (params: Params, name: string) => params.get(name) ?? '';

/** The state in an address (`q`, `cat`, `level`), read safely: unknown, repeated or malformed values are ignored. */
export function parseSearchAddress(params: Params): SearchState {
  const list = (name: string) => [...new Set(first(params, name).split(',').map((s) => s.trim()).filter((s) => SLUG.test(s) && s.length <= 64))];
  return {
    q: Array.from(first(params, 'q')).slice(0, MAX_QUERY).join(''),
    cats: list('cat'),
    levels: list('level').filter((l): l is Level => (LEVELS as readonly string[]).includes(l)),
  };
}

/** The query string (no `?`) for a state; keys with nothing in them are left out. */
export function formatSearchAddress(state: SearchState): string {
  const parts: string[] = [];
  if (state.q.trim() !== '') parts.push(`q=${encodeURIComponent(state.q.trim())}`);
  if (state.cats.length > 0) parts.push(`cat=${state.cats.map(encodeURIComponent).join(',')}`);
  if (state.levels.length > 0) parts.push(`level=${state.levels.join(',')}`);
  return parts.join('&');
}
