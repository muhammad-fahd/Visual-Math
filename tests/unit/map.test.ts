import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ search: 'cat=algebra' }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/map', useSearchParams: () => new URLSearchParams(nav.search) }));
import { MapScreen } from '../../src/features/map';
import { MapGraph } from '../../src/features/map/MapGraph';
import { MapList } from '../../src/features/map/MapList';
import { NODE_H, NODE_W, buildMapData, layoutMap } from '../../src/lib/map';
import { buildCatalog, type CatalogRows, type TopicRow, type TreeRow } from '../../src/lib/topic-schema/catalog';
import { fixtureRows } from '../../src/server/fixture-catalog';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// Story 5.5: the layout (pure) and the map page as server HTML.

const NOW = new Date('2026-11-28T00:00:00Z');
const tree = (id: string, parent: string | null, position = 1): TreeRow => ({ id, parent, nameEn: id.toUpperCase(), nameUr: `${id}-ur`, position });
const topic = (id: string, chapter: string, prerequisites: string[] = [], order = 1, live = true): TopicRow => ({
  id,
  chapter,
  level: 'foundation',
  chapterOrder: order,
  publishedHash: live ? `sha256:${'a'.repeat(64)}` : null,
  deleted: false,
  everPublished: true,
  meta: live ? { title: { en: id, ur: `${id}-ur` }, summary: { en: 's', ur: 's' }, tags: { en: ['t'], ur: ['ٹ'] }, estimatedMinutes: 7, prerequisites } : null,
});
/** Two categories, A and B, each with one subcategory; chapters ca1, ca2 in A and cb1 in B. */
const rows = (topics: TopicRow[]): CatalogRows => ({
  categories: [tree('a', null, 1), tree('b', null, 2), tree('empty', null, 3)],
  subcategories: [tree('sa', 'a'), tree('sb', 'b'), tree('se', 'empty')],
  chapters: [tree('ca1', 'sa', 1), tree('ca2', 'sa', 2), tree('cb1', 'sb', 1)],
  topics,
});
const cat = (t: TopicRow[]) => buildCatalog(rows(t), NOW).catalog;
const map = (t: TopicRow[], c = 'a') => layoutMap(cat(t), c, 'en');
const col = (m: ReturnType<typeof map>, id: string) => Math.round((m.nodes.find((n) => n.id === id)!.x - 16) / (NODE_W + 56));
const edgeIds = (m: ReturnType<typeof map>) => m.edges.map((e) => `${e.from}>${e.to}`);

describe('layoutMap (matrix)', () => {
  it('a chain: columns 0, 1, 2 in the chapter row, two arrows', () => {
    const m = map([topic('t1', 'ca1'), topic('t2', 'ca1', ['t1']), topic('t3', 'ca1', ['t2'])]);
    expect([col(m, 't1'), col(m, 't2'), col(m, 't3')]).toEqual([0, 1, 2]);
    expect(edgeIds(m)).toEqual(['t1>t2', 't2>t3']);
    expect(m.lanes).toHaveLength(1);
    expect(m.nodes.every((n) => n.y === m.nodes[0]!.y)).toBe(true);
  });
  it('two roots and one leaf: the roots stack in column 0, the leaf is in column 1 with two arrows', () => {
    const m = map([topic('r1', 'ca1'), topic('r2', 'ca1'), topic('leaf', 'ca1', ['r1', 'r2'])]);
    expect([col(m, 'r1'), col(m, 'r2'), col(m, 'leaf')]).toEqual([0, 0, 1]);
    expect(m.nodes.find((n) => n.id === 'r2')!.y).toBeGreaterThan(m.nodes.find((n) => n.id === 'r1')!.y);
    expect(edgeIds(m)).toEqual(['r1>leaf', 'r2>leaf']);
  });
  it('the column is one more than the deepest prerequisite', () => {
    const m = map([topic('a1', 'ca1'), topic('a2', 'ca1', ['a1']), topic('a3', 'ca1', ['a1', 'a2'])]);
    expect(col(m, 'a3')).toBe(2);
  });
  it('chapters are rows in tree order, only those with topics', () => {
    const m = map([topic('x', 'ca2'), topic('y', 'ca1')]);
    expect(m.lanes.map((l) => l.name)).toEqual(['CA1', 'CA2']);
    expect(m.nodes.find((n) => n.id === 'y')!.y).toBeLessThan(m.nodes.find((n) => n.id === 'x')!.y);
  });
  it('across categories: an outside node in the last row, named with its category, with an arrow, both ways', () => {
    const m = map([topic('b1', 'cb1'), topic('a1', 'ca1', ['b1']), topic('b2', 'cb1', ['a1'])]);
    const outsideIds = m.nodes.filter((n) => n.external).map((n) => n.id);
    expect(outsideIds).toEqual(['b1', 'b2']);
    expect(m.nodes.find((n) => n.id === 'b1')!.categoryName).toBe('B');
    expect(m.lanes.at(-1)!.external).toBe(true);
    expect(edgeIds(m)).toEqual(['a1>b2', 'b1>a1']);
    expect(m.nodes.find((n) => n.id === 'b1')!.x).toBeLessThan(m.nodes.find((n) => n.id === 'a1')!.x + 1); // a prerequisite sits at or before
    expect(m.list.flatMap((g) => g.topics).find((t) => t.id === 'a1')!.needs).toEqual([{ id: 'b1', title: 'b1', categoryName: 'B' }]);
  });
  it('an outside prerequisite of a first-column topic sits strictly to its left, so every arrow runs left to right', () => {
    const m = map([topic('b1', 'cb1'), topic('a1', 'ca1', ['b1'])]);
    const b1 = m.nodes.find((n) => n.id === 'b1')!;
    const a1 = m.nodes.find((n) => n.id === 'a1')!;
    expect(b1.x + b1.w).toBeLessThan(a1.x);
    for (const e of m.edges) {
      const from = m.nodes.find((n) => n.id === e.from)!;
      const to = m.nodes.find((n) => n.id === e.to)!;
      expect(from.x + from.w).toBeLessThanOrEqual(to.x);
    }
  });
  it('the edge order is a total order even when ids that join to the same text exist', () => {
    const m = map([topic('a-b', 'ca1'), topic('c', 'ca1', ['a-b']), topic('a', 'ca1'), topic('b-c', 'ca1', ['a'])]);
    expect(edgeIds(m)).toEqual(['a>b-c', 'a-b>c']);
  });
  it('a prerequisite that is unpublished, deleted or unknown is not drawn and not listed', () => {
    const m = map([topic('u', 'ca1', [], 1, false), topic('a1', 'ca1', ['u', 'no-such-topic'])]);
    expect(m.nodes.map((n) => n.id)).toEqual(['a1']);
    expect(m.edges).toEqual([]);
    expect(m.list[0]!.topics[0]!.needs).toEqual([]);
  });
  it('a cycle terminates: both topics are drawn and the closing edge does not add a column forever', () => {
    const m = map([topic('c1', 'ca1', ['c2']), topic('c2', 'ca1', ['c1'])]);
    expect(m.nodes).toHaveLength(2);
    expect(m.edges).toHaveLength(2);
    expect(Math.max(col(m, 'c1'), col(m, 'c2'))).toBeLessThanOrEqual(1);
  });
  it('a topic needing itself is ignored', () => {
    const m = map([topic('s', 'ca1', ['s'])]);
    expect(m.edges).toEqual([]);
    expect(col(m, 's')).toBe(0);
  });
  it('no prerequisites at all: every topic in column 0, no arrows', () => {
    const m = map([topic('p', 'ca1'), topic('q', 'ca2')]);
    expect(m.edges).toEqual([]);
    expect([col(m, 'p'), col(m, 'q')]).toEqual([0, 0]);
  });
  it('an empty category has no nodes, and no chip in the data', () => {
    const c = cat([topic('p', 'ca1')]);
    expect(layoutMap(c, 'empty', 'en').nodes).toEqual([]);
    expect(buildMapData(c, 'en').categories.map((x) => x.id)).toEqual(['a']);
  });
  it('is deterministic whatever order the rows arrive in, and every node and edge is inside the drawing', () => {
    const t = [topic('t1', 'ca1'), topic('t2', 'ca1', ['t1']), topic('t3', 'ca2', ['t2']), topic('b1', 'cb1', ['t3'])];
    const a = map(t);
    const b = map([...t].reverse());
    expect(b).toEqual(a);
    for (const n of a.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + NODE_W).toBeLessThanOrEqual(a.width);
      expect(n.y + NODE_H).toBeLessThanOrEqual(a.height);
    }
    for (const e of a.edges) expect(e.d).toMatch(/^M [\d.]+ [\d.]+ C /);
  });
  it('shortens a long title for the node but keeps the full one', () => {
    const m = map([{ ...topic('long', 'ca1'), meta: { ...topic('long', 'ca1').meta!, title: { en: 'A very long topic title that cannot fit', ur: 'x' } } }]);
    expect(m.nodes[0]!.shortTitle.endsWith('…')).toBe(true);
    expect(Array.from(m.nodes[0]!.shortTitle).length).toBeLessThanOrEqual(22);
    expect(m.nodes[0]!.title).toBe('A very long topic title that cannot fit');
  });
  it('the list has every topic once, with Needs and Leads to', () => {
    const m = map([topic('t1', 'ca1'), topic('t2', 'ca1', ['t1'])]);
    const items = m.list.flatMap((g) => g.topics);
    expect(items.map((i) => i.id)).toEqual(['t1', 't2']);
    expect(items[0]!.leads.map((r) => r.id)).toEqual(['t2']);
    expect(items[1]!.needs.map((r) => r.id)).toEqual(['t1']);
  });
});

const catalog = buildCatalog(fixtureRows(), NOW).catalog;
const data = buildMapData(catalog, 'en');
const html = (locale: 'en' | 'ur', child: ReturnType<typeof createElement>) => renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: child }));

describe('the fixture map', () => {
  it('has a chip for each category with topics, in tree order', () => expect(data.categories.map((c) => c.id)).toEqual(['arithmetic-and-numbers', 'algebra', 'geometry', 'trigonometry', 'statistics-and-probability']));
  it('algebra: a chain balance scale, solving, graphs; and a topic of another category before the graph', () => {
    const m = data.layouts['algebra']!;
    const c = (id: string) => Math.round((m.nodes.find((n) => n.id === id)!.x - 16) / (NODE_W + 56));
    expect([c('alg-balance-scale'), c('alg-solve-steps'), c('alg-quadratic-graph')]).toEqual([0, 1, 2]);
    expect(m.nodes.find((n) => n.id === 'num-equivalent-fractions')!.external).toBe(true);
    expect(m.edges.map((e) => `${e.from}>${e.to}`)).toContain('num-equivalent-fractions>alg-quadratic-graph');
  });
  it('geometry: the cone section needs the cone volume; the unpublished and unknown prerequisites are nowhere', () => {
    const m = data.layouts['geometry']!;
    const ids = m.nodes.map((n) => n.id);
    expect(ids).not.toContain('stats-dice');
    expect(m.edges.map((e) => `${e.from}>${e.to}`)).toContain('geo-cone-volume>geo-cone-section');
    expect(m.edges.map((e) => `${e.from}>${e.to}`)).toContain('geo-cylinder-net>geo-cylinder-fill');
  });
});

describe('the map page as server HTML', () => {
  const out = html('en', createElement(MapScreen, { data }));
  it('has one h1, the hint, a chip per category, the picture and the list', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain(en.map.hint.slice(0, 40));
    expect(out.match(/data-chip="/g)).toHaveLength(5);
    expect(out).toContain('data-map-graph');
    expect(out).toContain('data-map-list');
    expect(out).toContain('aria-pressed="true"'); // algebra, from cat=algebra
  });
  it('the picture is hidden from assistive technology and out of the tab order; the list is not', () => {
    const graph = out.slice(out.indexOf('<svg'), out.indexOf('</svg>'));
    expect(graph).toContain('aria-hidden="true"');
    expect((graph.match(/tabindex="-1"/g) ?? []).length).toBe((graph.match(/<a /g) ?? []).length);
    const list = out.slice(out.indexOf('data-map-list'));
    expect(list).not.toContain('tabindex="-1"');
    expect(list).toContain('Needs');
    expect(list).toContain('Leads to');
  });
  it('the list names a topic of another category with its category', () => {
    const list = html('en', createElement(MapList, { layout: data.layouts['algebra']! }));
    expect(list).toMatch(/Equivalent fractions[^<]*\(Arithmetic and Numbers\)/i);
    expect(list).toContain('href="/en/topic/alg-solve-steps"');
  });
  it('the graph carries each topic as a link with its title, level word and minutes; an outside node is dashed', () => {
    const g = html('en', createElement(MapGraph, { layout: data.layouts['algebra']! }));
    expect(g).toContain('data-map-node="alg-solve-steps"');
    expect(g).toContain('Foundation');
    expect(g).toMatch(/\d+ min/);
    expect(g).toContain('stroke-dasharray="5 3"');
    expect(g).toContain('data-map-edge="alg-balance-scale&gt;alg-solve-steps"');
  });
  it('in Urdu: Urdu words and names, the graph text runs right to left and the picture stays left to right', () => {
    const ru = html('ur', createElement(MapScreen, { data: buildMapData(catalog, 'ur') }));
    expect(ru).toContain(ur.map.title);
    expect(ru).toContain('direction="rtl"');
    expect(ru).toContain('dir="ltr"'); // the scrolling picture box
    expect(ru).toContain('الجبرا');
  });
  it('with no topic at all it says so and draws nothing', () => {
    const none = html('en', createElement(MapScreen, { data: buildMapData(cat([]), 'en') }));
    expect(none).toContain(en.map.empty);
    expect(none).not.toContain('data-map-graph');
  });
  it('every map word exists in both languages', () => {
    expect(Object.keys(ur.map).sort()).toEqual(Object.keys(en.map).sort());
    for (const v of Object.values(ur.map)) expect(v.trim().length).toBeGreaterThan(0);
    expect(ur.home.mapLink.length).toBeGreaterThan(0);
  });
});

describe('the category in the address', () => {
  const page = (search: string) => {
    nav.search = search;
    return html('en', createElement(MapScreen, { data }));
  };
  it('a name that exists on every object (constructor, toString, __proto__) is ignored, not a crash', () => {
    for (const bad of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const out = page(`cat=${bad}`);
      expect(out, bad).toContain('data-map-graph');
      expect(out, bad).toMatch(/data-chip="arithmetic-and-numbers"/);
    }
  });
  it('a real category is used, an unknown one falls back to the first', () => {
    expect(page('cat=geometry')).toContain('data-map-node="geo-cone-volume"');
    expect(page('cat=nope')).toContain('data-map-node="num-equivalent-fractions"');
    nav.search = 'cat=algebra';
  });
});
