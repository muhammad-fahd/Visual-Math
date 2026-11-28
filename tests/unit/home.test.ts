import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/en' }));
import { HomePage, NothingFound } from '../../src/features/library';
import { categories, featuredTopics, readingOrder, startTopic } from '../../src/lib/library';
import { buildCatalog, type CatalogRows, type TopicRow, type TreeRow } from '../../src/lib/topic-schema/catalog';
import { fixtureRows } from '../../src/server/fixture-catalog';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// Story 5.2: the home page and the friendly nothing-found page, and the pure choices behind them.

const NOW = new Date('2026-11-28T00:00:00Z');
const row = (id: string, parent: string | null, position: number): TreeRow => ({ id, parent, nameEn: id, nameUr: `${id}-ur`, position });
const meta = (t: string) => ({ title: { en: t, ur: `${t}-ur` }, summary: { en: `About ${t}`, ur: 'x' }, tags: { en: ['t'], ur: ['ٹ'] }, estimatedMinutes: 6 });
const topic = (id: string, chapter: string, level = 'foundation', chapterOrder = 1, live = true): TopicRow => ({
  id,
  chapter,
  level,
  chapterOrder,
  publishedHash: live ? `sha256:${'a'.repeat(64)}` : null,
  deleted: false,
  everPublished: true,
  meta: live ? meta(id) : null,
});
/** n categories c1..cn, each with one subcategory and one chapter `h{i}`. */
function rows(n: number, topics: TopicRow[]): CatalogRows {
  const cats = Array.from({ length: n }, (_, i) => row(`c${i + 1}`, null, i + 1));
  return {
    categories: cats,
    subcategories: cats.map((c, i) => row(`s${i + 1}`, c.id, 1)),
    chapters: cats.map((c, i) => row(`h${i + 1}`, `s${i + 1}`, 1)),
    topics,
  };
}
const cat = (r: CatalogRows) => buildCatalog(r, NOW).catalog;
const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe('featured topics and Start (matrix)', () => {
  it('one per category with topics, in tree order: 5 of 12 categories have topics, so 5 are featured', () => {
    const c = cat(rows(12, [topic('t3', 'h3'), topic('t1', 'h1'), topic('t7', 'h7'), topic('t12', 'h12'), topic('t5', 'h5'), topic('t5b', 'h5', 'foundation', 2)]));
    expect(ids(featuredTopics(c))).toEqual(['t1', 't3', 't5', 't7', 't12']);
  });
  it('at most 6, the first six in tree order', () => {
    const c = cat(rows(9, Array.from({ length: 9 }, (_, i) => topic(`t${i + 1}`, `h${i + 1}`))));
    expect(ids(featuredTopics(c))).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
    expect(ids(featuredTopics(c, 3))).toEqual(['t1', 't2', 't3']);
  });
  it('a category whose only topic is unpublished is skipped, and counts zero', () => {
    const c = cat(rows(3, [topic('t1', 'h1'), topic('t2', 'h2', 'foundation', 1, false), topic('t3', 'h3')]));
    expect(ids(featuredTopics(c))).toEqual(['t1', 't3']);
    expect(categories(c).find((n) => n.category === 'c2')!.count).toBe(0);
  });
  it('within a category the Foundation topic comes first, else the first in reading order', () => {
    const c = cat(rows(2, [topic('a-inter', 'h1', 'intermediate', 1), topic('b-found', 'h1', 'foundation', 2), topic('x1', 'h2', 'advanced', 2), topic('x2', 'h2', 'intermediate', 1)]));
    expect(ids(featuredTopics(c))).toEqual(['b-found', 'x2']);
  });
  it('Start is the first Foundation topic in tree order, else the first topic, else nothing', () => {
    expect(startTopic(cat(rows(3, [topic('t1', 'h1', 'intermediate'), topic('t2', 'h2', 'foundation'), topic('t3', 'h3', 'foundation')])))!.id).toBe('t2');
    expect(startTopic(cat(rows(2, [topic('t2', 'h2', 'advanced'), topic('t1', 'h1', 'intermediate')])))!.id).toBe('t1');
    expect(startTopic(cat(rows(2, [])))).toBeUndefined();
    expect(featuredTopics(cat(rows(2, [])))).toEqual([]);
    const some = cat(rows(2, [topic('t1', 'h1'), topic('t2', 'h2')]));
    expect(featuredTopics(some, 0)).toEqual([]);
    expect(featuredTopics(some, -1)).toEqual([]);
  });
  it('reading order follows the tree, not the ids, and the same rows always give the same answer', () => {
    const shuffled = rows(3, [topic('z', 'h1'), topic('m', 'h3'), topic('a', 'h2')]);
    expect(ids(readingOrder(cat(shuffled)))).toEqual(['z', 'a', 'm']);
    const again = rows(3, [topic('a', 'h2'), topic('m', 'h3'), topic('z', 'h1')]);
    expect(ids(featuredTopics(cat(again)))).toEqual(ids(featuredTopics(cat(shuffled))));
  });
});

const html = (locale: 'en' | 'ur', child: ReturnType<typeof createElement>) => renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: child }));
const fixtures = cat(fixtureRows());
const empty = cat(rows(12, []));

describe('the home page', () => {
  const out = html('en', createElement(HomePage, { catalog: fixtures }));
  it('explains Visual Math in three lines, with one h1', () => {
    expect(out.match(/<h1/g)).toHaveLength(1);
    for (const k of ['line1', 'line2', 'line3'] as const) expect(out).toContain(en.home[k]);
  });
  it('has the search box as a GET form to /en/search with a labelled, required field q (no JavaScript needed)', () => {
    expect(out).toMatch(/<form[^>]*action="\/en\/search"[^>]*method="get"|<form[^>]*method="get"[^>]*action="\/en\/search"/);
    expect(out).toContain('role="search"');
    expect(out).toContain('name="q"');
    expect(out).toContain('required');
    expect(out).toContain('pattern=".*\\S.*"'); // a blank search is not sent either
    expect(out).toContain('Search topics</label>');
  });
  it('lists the 12 categories with counts, and the featured topics, one per category with topics', () => {
    expect(out.match(/data-tree-link=/g)).toHaveLength(12);
    expect(out).toContain('data-count="5"'); // geometry
    expect((out.match(/data-topic-card=/g) ?? []).length).toBe(featuredTopics(fixtures).length);
    expect(featuredTopics(fixtures).map((t) => t.path.category)).toEqual(['arithmetic-and-numbers', 'algebra', 'geometry', 'trigonometry', 'statistics-and-probability']);
  });
  it('Start opens the first Foundation topic in tree order', () => {
    const s = startTopic(fixtures)!;
    expect(s.level).toBe('foundation');
    expect(out).toContain(`href="/en/topic/${s.id}"`);
    expect(out).toContain(`data-start-link="${s.id}"`);
    expect(out).toContain(s.title['en']!);
  });
  it('asks for nothing: no login, account or password wording, in either language', () => {
    for (const text of [out, html('ur', createElement(HomePage, { catalog: fixtures }))]) expect(text).not.toMatch(/log ?in|sign ?in|sign ?up|password|account|لاگ|پاس ورڈ|اکاؤنٹ/i);
  });
  it('in Urdu: Urdu words and names, links in /ur', () => {
    const ru = html('ur', createElement(HomePage, { catalog: fixtures }));
    expect(ru).toContain(ur.home.line1);
    expect(ru).toContain('action="/ur/search"');
    expect(ru).toContain('href="/ur/geometry"');
    expect(ru).toContain('جیومیٹری');
    expect(ru).toContain(ur.home.start);
  });
  it('with no published topic: the categories at zero, no featured block, and "coming soon" instead of Start', () => {
    const e = html('en', createElement(HomePage, { catalog: empty }));
    expect(e.match(/data-tree-link=/g)).toHaveLength(12);
    expect(e).toContain('data-count="0"');
    expect(e).not.toContain('data-featured');
    expect(e).not.toContain('data-start-link');
    expect(e).toContain(en.home.comingSoon);
  });
  it('with no category at all (an empty database) it still renders', () => {
    const none = html('en', createElement(HomePage, { catalog: cat(rows(0, [])) }));
    expect(none).toContain(en.home.comingSoon);
    expect(none.match(/<h1/g)).toHaveLength(1);
  });
  it('headings are in order: h1, then h2 sections, then h3 card titles', () => {
    const levels = [...out.matchAll(/<h([1-6])/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });
});

describe('the nothing-found page', () => {
  const cats = categories(fixtures);
  it('says what happened and offers a search box, the categories and a way home', () => {
    const out = html('en', createElement(NothingFound, { categories: cats }));
    expect(out).toContain(en.library.notFoundTitle);
    expect(out).toContain('name="q"');
    expect(out.match(/data-tree-link=/g)).toHaveLength(12);
    expect(out).toContain('data-home-link');
    expect(out).toContain('href="/en"');
    expect(out.match(/<h1/g)).toHaveLength(1);
  });
  it('in Urdu, with links in /ur', () => {
    const out = html('ur', createElement(NothingFound, { categories: cats }));
    expect(out).toContain(ur.library.notFoundTitle);
    expect(out).toContain('action="/ur/search"');
    expect(out).toContain('href="/ur"');
  });
  it('still works with no categories, and shows the caller’s own way back', () => {
    const out = html('en', createElement(NothingFound, { categories: [] }, createElement('a', { href: '/en/x', 'data-mine': '' }, 'Back')));
    expect(out).not.toContain('data-tree-link');
    expect(out).toContain('data-mine');
    expect(out).toContain('data-home-link');
  });
});

describe('the new words exist in both languages', () => {
  it('every home key has a value in English and in Urdu', () => {
    expect(Object.keys(ur.home).sort()).toEqual(Object.keys(en.home).sort());
    for (const v of Object.values(ur.home)) expect(v.trim().length).toBeGreaterThan(0);
    expect(Object.keys(ur.library).sort()).toEqual(Object.keys(en.library).sort());
  });
});
