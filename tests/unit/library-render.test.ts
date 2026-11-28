import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ path: '/en/algebra/equations/nope' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
import { BackLink, LibraryPage, TopicCard, TreeList } from '../../src/features/library';
import { PROGRESS_KEY, viewedIds } from '../../src/features/progress';
import { buildCatalog } from '../../src/lib/topic-schema/catalog';
import { fixtureRows } from '../../src/server/fixture-catalog';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// Story 5.1: the tree pages as server HTML (what is there before any script runs), in both languages.

const { catalog } = buildCatalog(fixtureRows(), new Date('2026-11-28T00:00:00Z'));
const html = (locale: 'en' | 'ur', child: ReturnType<typeof createElement>) => renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: child }));
const cones = catalog.topics.find((t) => t.id === 'geo-cone-volume')!;

describe('the topic card', () => {
  const out = html('en', createElement('ul', null, createElement(TopicCard, { topic: cones })));
  it('is one link to the topic with title, summary, level as a word and minutes', () => {
    expect(out).toContain('href="/en/topic/geo-cone-volume"');
    expect(out).toContain('<h3'); // under the chapter's "Topics" h2
    expect(cones.level).toBe('intermediate');
    expect(out).toContain('data-level="intermediate"');
    expect(out).toContain('>Intermediate<');
    expect(out).toContain('min-h-11 p-4'); // not the larger foundation card
    expect(out).toMatch(/\d+ min/);
    expect(out.match(/<a /g)).toHaveLength(1);
  });
  it('shows no viewed mark in the server HTML (the mark comes after hydration, from this device)', () => {
    expect(out).not.toContain('Viewed');
    expect(out).not.toContain('data-viewed');
  });
  it('is the Urdu card in Urdu, with the Urdu level word and a link in /ur', () => {
    const ru = html('ur', createElement('ul', null, createElement(TopicCard, { topic: cones })));
    expect(ru).toContain('href="/ur/topic/geo-cone-volume"');
    expect(ru).toContain(ur.topic.level.intermediate);
    expect(ru).not.toContain('>Intermediate<');
  });
  it('a foundation card is the larger one, with the level word', () => {
    const base = catalog.topics.find((t) => t.level === 'foundation')!;
    const out2 = html('en', createElement('ul', null, createElement(TopicCard, { topic: base })));
    expect(out2).toContain('>Foundation<');
    expect(out2).toContain('min-h-12 p-5');
    expect(out2).toContain('text-2xl');
  });
});

describe('the tree list', () => {
  const geometry = catalog.tree.filter((n) => n.category === 'geometry' && n.subcategory !== null && n.chapter === null);
  it('links each child with its name and its count, a branch with no topics included (FR-1.2)', () => {
    const out = html('en', createElement(TreeList, { nodes: catalog.tree.filter((n) => n.subcategory === null) }));
    expect(out).toContain('href="/en/geometry"');
    expect(out).toContain('Geometry');
    expect(out).toContain('data-count="5"');
    expect(out).toMatch(/\(5 topics\)/);
    expect(out).toMatch(/\(0 topics\)/); // calculus has none yet
    expect(out.match(/data-tree-link/g)).toHaveLength(12);
    expect(geometry).toHaveLength(2);
  });
  it('says one topic in the singular and uses Urdu names in Urdu', () => {
    const one = html('en', createElement(TreeList, { nodes: catalog.tree.filter((n) => n.chapter === 'cones') }));
    expect(one).toMatch(/\(1 topic\)/);
    const ru = html('ur', createElement(TreeList, { nodes: catalog.tree.filter((n) => n.subcategory === null) }));
    expect(ru).toContain('جیومیٹری');
    expect(ru).toContain('href="/ur/geometry"');
  });
});

describe('the page frame', () => {
  const page = (locale: 'en' | 'ur') => html(locale, createElement(LibraryPage, { trail: [{ slug: 'home', name: 'Home', href: `/${locale}` }], title: 'Cylinders', count: 2, heading: 'Topics', children: createElement('p', null, 'inside') }));
  it('has one h1 with the name, the count, the path and the language switcher', () => {
    const out = page('en');
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('Cylinders');
    expect(out).toContain('data-total="2"');
    expect(out).toContain('2 topics');
    expect(out).toContain('aria-label="You are here"');
    expect(out).toContain('aria-label="Language"');
    expect(out).toContain('inside');
  });
  it('in Urdu uses the Urdu count words', () => {
    expect(page('ur')).toContain('2 موضوعات');
  });
});

describe('the way back from a page that found nothing', () => {
  it('leads one level up the address', () => {
    expect(html('en', createElement(BackLink))).toContain('href="/en/algebra/equations"');
  });
  it('from a missing topic it goes to the language home, since /topic is not a page', () => {
    nav.path = '/ur/topic/nope';
    const out = html('ur', createElement(BackLink));
    expect(out).toContain('href="/ur"');
    expect(out).toContain(ur.library.home);
    nav.path = '/en/algebra/equations/nope';
  });
});

describe('the viewed marks read from the device (hand-checked, no Zod)', () => {
  const stored = (topics: unknown, v: unknown = 1) => JSON.stringify({ v, topics, last: 'a-topic' });
  it('reads the ids of a valid value', () => {
    expect([...viewedIds(stored({ 'geo-cone-volume': { viewedAt: '2026-11-28T00:00:00Z', lastStep: 2 }, 'alg-balance-scale': { viewedAt: 1764288000000 } }))].sort()).toEqual(['alg-balance-scale', 'geo-cone-volume']);
  });
  it.each([
    ['nothing stored', null],
    ['not JSON', '{nope'],
    ['another version', stored({ a: { viewedAt: 'x' } }, 2)],
    ['topics as a list', stored([{ viewedAt: 'x' }])],
    ['an entry without a time', stored({ a: {} })],
    ['an entry that is text', stored({ a: 'viewed' })],
    ['the value is a number', '5'],
  ])('discards the whole value when it is %s', (_name, raw) => expect(viewedIds(raw as string | null).size).toBe(0));
  it('the key is the one the architecture names', () => expect(PROGRESS_KEY).toBe('vm.progress.v1'));
});

describe('the new words exist in both languages', () => {
  it('every library key has a value in English and in Urdu', () => {
    expect(Object.keys(ur.library).sort()).toEqual(Object.keys(en.library).sort());
    for (const v of Object.values(ur.library)) expect(v.trim().length).toBeGreaterThan(0);
  });
});
