import { describe, expect, it } from 'vitest';
import { categories, chapterNode, chapters, RESERVED_SLUGS, subcategories, topicHref, topicsOf, treeHref } from '../../src/lib/library';
import { buildCatalog, type CatalogRows, type TopicRow, type TreeRow } from '../../src/lib/topic-schema/catalog';

// Story 5.1: the catalog is built whole from rows, with published topics only, and always the same way.

const NOW = new Date('2026-11-28T10:00:00.000Z');
const row = (id: string, parent: string | null, position: number, nameEn = id, nameUr = `${id}-ur`): TreeRow => ({ id, parent, nameEn, nameUr, position });
const hash = (c: string) => `sha256:${c.repeat(64).slice(0, 64)}`;
const meta = (title: string) => ({ title: { en: title, ur: `${title} (ur)` }, summary: { en: `About ${title}`, ur: `${title} کے بارے میں` }, tags: { en: ['one', 'two'], ur: ['ایک'] }, estimatedMinutes: 8, prerequisites: ['a-topic'], next: ['b-topic'] });
const topic = (id: string, over: Partial<TopicRow> = {}): TopicRow => ({
  id,
  chapter: 'chap',
  level: 'foundation',
  chapterOrder: 1,
  publishedHash: hash('a'),
  deleted: false,
  everPublished: true,
  meta: meta(id),
  ...over,
});

function rows(topics: TopicRow[]): CatalogRows {
  return {
    categories: [row('algebra', null, 2), row('geometry', null, 1), row('empty-cat', null, 3)],
    subcategories: [row('sub', 'algebra', 1), row('sub-b', 'algebra', 2), row('geo-sub', 'geometry', 1)],
    chapters: [row('chap', 'sub', 1), row('chap-b', 'sub', 2), row('geo-chap', 'geo-sub', 1)],
    topics,
  };
}

describe('buildCatalog (matrix: counts, empty branches, hidden topics, order)', () => {
  const three = [topic('pub-one'), topic('pub-two', { chapterOrder: 2 }), topic('unpub', { publishedHash: null, meta: null }), topic('gone', { publishedHash: null, deleted: true, meta: null })];

  it('counts published topics only: 2 in the chapter, the same in its subcategory and category', () => {
    const { catalog } = buildCatalog(rows(three), NOW);
    expect(chapterNode(catalog, 'algebra', 'sub', 'chap')!.count).toBe(2);
    expect(catalog.tree.find((n) => n.category === 'algebra' && n.subcategory === 'sub' && n.chapter === null)!.count).toBe(2);
    expect(catalog.tree.find((n) => n.category === 'algebra' && n.subcategory === null)!.count).toBe(2);
  });
  it('an unpublished or deleted topic is in no list and no count; one published once is a tombstone', () => {
    const { catalog } = buildCatalog(rows(three), NOW);
    expect(catalog.topics.map((t) => t.id)).toEqual(['pub-one', 'pub-two']);
    expect(topicsOf(catalog, 'chap').map((t) => t.id)).toEqual(['pub-one', 'pub-two']);
    expect(catalog.tombstones).toEqual([{ id: 'gone' }, { id: 'unpub' }]);
    expect(JSON.stringify(catalog.tree)).not.toContain('unpub');
  });
  it('a topic never published is not even a tombstone', () => {
    const { catalog } = buildCatalog(rows([topic('draft', { publishedHash: null, everPublished: false, meta: null })]), NOW);
    expect(catalog.topics).toEqual([]);
    expect(catalog.tombstones).toEqual([]);
  });
  it('a branch with no published topic is still in the tree with a count of zero', () => {
    const { catalog } = buildCatalog(rows(three), NOW);
    const empty = catalog.tree.find((n) => n.category === 'empty-cat')!;
    expect(empty.count).toBe(0);
    expect(chapterNode(catalog, 'algebra', 'sub', 'chap-b')!.count).toBe(0);
    expect(chapterNode(catalog, 'geometry', 'geo-sub', 'geo-chap')!.count).toBe(0);
  });
  it('the tree is by position and the topics by chapter order then id, whatever order the rows arrive in', () => {
    const shuffled = rows([topic('zeta', { chapterOrder: 1 }), topic('beta', { chapterOrder: 2 }), topic('alpha', { chapterOrder: 2 })]);
    shuffled.categories.reverse();
    shuffled.chapters.reverse();
    const { catalog } = buildCatalog(shuffled, NOW);
    expect(categories(catalog).map((n) => n.category)).toEqual(['geometry', 'algebra', 'empty-cat']);
    expect(topicsOf(catalog, 'chap').map((t) => t.id)).toEqual(['zeta', 'alpha', 'beta']);
    expect(subcategories(catalog, 'algebra').map((n) => n.subcategory)).toEqual(['sub', 'sub-b']);
    expect(chapters(catalog, 'algebra', 'sub').map((n) => n.chapter)).toEqual(['chap', 'chap-b']);
  });
  it('the same rows give the same bytes apart from generatedAt, in any input order', () => {
    const a = rows([topic('x1'), topic('x2', { chapterOrder: 2 }), topic('x3', { chapter: 'chap-b' })]);
    const b = rows([topic('x3', { chapter: 'chap-b' }), topic('x2', { chapterOrder: 2 }), topic('x1')]);
    b.subcategories.reverse();
    const strip = (c: object) => JSON.stringify({ ...c, generatedAt: '' });
    expect(strip(buildCatalog(a, NOW).catalog)).toBe(strip(buildCatalog(b, new Date('2030-01-01')).catalog));
    expect(buildCatalog(a, NOW).catalog.generatedAt).toBe('2026-11-28T10:00:00.000Z');
  });
});

describe('what a catalog topic carries', () => {
  it('path from the tree (not the document), hash, level, minutes, titles, links to other topics, search words, no thumbnail yet', () => {
    const t = buildCatalog(rows([topic('pub', { level: 'advanced', publishedHash: hash('b') })]), NOW).catalog.topics[0]!;
    expect(t.path).toEqual({ category: 'algebra', subcategory: 'sub', chapter: 'chap' });
    expect(t).toMatchObject({ id: 'pub', hash: hash('b'), level: 'advanced', estimatedMinutes: 8, prerequisites: ['a-topic'], next: ['b-topic'], thumb: null });
    expect(t.title).toEqual({ en: 'pub', ur: 'pub (ur)' });
    expect(t.searchTokens['en']).toBe('pub about pub one two');
    expect(t.searchTokens['ur']).toContain('ایک');
  });
  it('a missing Urdu name falls back to English in the tree', () => {
    const r = rows([]);
    r.categories[0] = row('algebra', null, 2, 'Algebra', '  ');
    expect(categories(buildCatalog(r, NOW).catalog).find((n) => n.category === 'algebra')!.name).toEqual({ en: 'Algebra', ur: 'Algebra' });
  });
  it('markup in a summary does not reach the search words', () => {
    const m = meta('markup');
    m.summary = { en: 'Uses **bold** here', ur: 'x' };
    const t = buildCatalog(rows([topic('markup', { meta: m })]), NOW).catalog.topics[0]!;
    expect(t.searchTokens['en']).not.toContain('*');
  });
});

describe('a published topic the catalog cannot place or describe is left out and named, never guessed', () => {
  const skip = (over: Partial<TopicRow>) => buildCatalog(rows([topic('bad', over)]), NOW);
  it('its chapter is not in the tree', () => {
    const r = skip({ chapter: 'nowhere' });
    expect(r.catalog.topics).toEqual([]);
    expect(r.skipped).toEqual([{ id: 'bad', reason: 'its chapter is not in the tree' }]);
  });
  it('no English title, no summary, an unknown level, no minutes', () => {
    expect(skip({ meta: { ...meta('x'), title: { ur: 'x' } } }).skipped[0]!.reason).toBe('no title');
    expect(skip({ meta: { ...meta('x'), summary: undefined } }).skipped[0]!.reason).toBe('no summary');
    expect(skip({ level: 'expert' }).skipped[0]!.reason).toBe('unknown level');
    expect(skip({ meta: { ...meta('x'), estimatedMinutes: '8' } }).skipped[0]!.reason).toBe('no estimated minutes');
  });
  it('the rest of the catalog is still built', () => {
    const r = buildCatalog(rows([topic('bad', { chapter: 'nowhere' }), topic('fine')]), NOW);
    expect(r.catalog.topics.map((t) => t.id)).toEqual(['fine']);
  });
});

describe('addresses (owner decision) and lookups', () => {
  it('the tree is /{locale}/{category}/{subcategory}/{chapter}; a topic is /{locale}/topic/{id}', () => {
    expect(treeHref('en')).toBe('/en');
    expect(treeHref('ur', 'algebra')).toBe('/ur/algebra');
    expect(treeHref('en', 'algebra', 'sub', 'chap')).toBe('/en/algebra/sub/chap');
    expect(treeHref('en', 'algebra', null, null)).toBe('/en/algebra');
    expect(topicHref('ur', 'geo-cone-volume')).toBe('/ur/topic/geo-cone-volume');
  });
  it('the words other pages use are reserved, and none of the seeded categories is one', () => {
    for (const w of ['topic', 'search', 'map', 'help', 'about', 'privacy', 'terms', 'faq', 'contact', 'progress', 'plans', 'admin', 'api', 'dev']) expect(RESERVED_SLUGS).toContain(w);
    const seeded = ['arithmetic-and-numbers', 'algebra', 'geometry', 'trigonometry', 'coordinate-geometry', 'functions-and-graphs', 'vectors', 'complex-numbers', 'calculus', 'series-and-discrete-maths', 'statistics-and-probability', 'linear-algebra'];
    for (const s of seeded) expect(RESERVED_SLUGS).not.toContain(s);
  });

});
