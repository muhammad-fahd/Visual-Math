import 'server-only';
import type { CatalogRows, TopicRow } from '../lib/topic-schema/catalog';
import type { CatalogPort } from './catalog';
import tree from '../../content/fixtures/tree.json';
import fractions from '../../content/fixtures/num-equivalent-fractions.json';
import balance from '../../content/fixtures/alg-balance-scale.json';
import solver from '../../content/fixtures/alg-solve-steps.json';
import graph from '../../content/fixtures/alg-quadratic-graph.json';
import section from '../../content/fixtures/geo-cone-section.json';
import cone from '../../content/fixtures/geo-cone-volume.json';
import fill from '../../content/fixtures/geo-cylinder-fill.json';
import net from '../../content/fixtures/geo-cylinder-net.json';
import triangle from '../../content/fixtures/geo-triangle-transform.json';
import triangle3 from '../../content/fixtures/trig-right-triangle.json';
import circle from '../../content/fixtures/trig-unit-circle.json';
import dice from '../../content/fixtures/stats-dice.json';
import normal from '../../content/fixtures/stats-normal-distribution.json';

// The rows of the harness (VM_HARNESS=1): the fixture topics placed in a small tree by `tree.json`, one of them
// unpublished and one deleted so the lists can be shown to leave them out. Loaded by a literal dynamic import
// from `catalog-source.ts` only under the harness, so production never reads it (the files are in the server build, but
// nothing runs them without the flag). Epic 7 supplies the real rows.

const DOCS = [fractions, balance, solver, graph, section, cone, fill, net, triangle, triangle3, circle, dice, normal] as unknown as {
  id: string;
  level: string;
  chapterOrder: number;
  title: unknown;
  summary: unknown;
  tags: unknown;
  estimatedMinutes: number;
  prerequisites?: unknown;
  next?: unknown;
}[];

export function fixtureRows(): CatalogRows {
  const hidden = new Set(tree.unpublished);
  const deleted = new Set(tree.deleted);
  const placement = tree.placement as Record<string, string>;
  const topics: TopicRow[] = DOCS.map((d) => ({
    id: d.id,
    chapter: placement[d.id] ?? '',
    level: d.level,
    chapterOrder: d.chapterOrder,
    publishedHash: hidden.has(d.id) || deleted.has(d.id) ? null : `sha256:${Array.from(d.id).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(64, '0').slice(0, 64)}`,
    deleted: deleted.has(d.id),
    everPublished: hidden.has(d.id) || deleted.has(d.id),
    meta: { title: d.title, summary: d.summary, tags: d.tags, estimatedMinutes: d.estimatedMinutes, prerequisites: d.prerequisites, next: d.next },
  }));
  return { categories: tree.categories, subcategories: tree.subcategories, chapters: tree.chapters, topics };
}

export const fixturePort: CatalogPort = { read: async () => fixtureRows() };

/** The document of a fixture topic that the harness lists as published; null for an unpublished, a deleted or an unknown id. */
export function fixtureTopic(id: string): unknown {
  const live = new Set(fixtureRows().topics.filter((t) => t.publishedHash !== null && !t.deleted).map((t) => t.id));
  return live.has(id) ? (DOCS.find((d) => d.id === id) ?? null) : null;
}
