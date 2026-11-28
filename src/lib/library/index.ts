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
