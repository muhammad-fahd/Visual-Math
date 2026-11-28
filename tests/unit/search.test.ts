import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/search', useSearchParams: () => new URLSearchParams('q=cone&cat=geometry') }));
import { SearchPage } from '../../src/features/library/SearchPage';
import { SearchResults } from '../../src/features/library/SearchResults';
import { EMPTY_SEARCH, LEVELS, buildSearchData, formatSearchAddress, parseSearchAddress, searchTopics, type SearchState } from '../../src/lib/library';
import { normalizeSearch } from '../../src/lib/text';
import { buildCatalog } from '../../src/lib/topic-schema/catalog';
import { fixtureRows } from '../../src/server/fixture-catalog';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// Story 5.3: one normalization, matching over the catalog, filters, and the address.

describe('normalizeSearch (AD-21)', () => {
  it('folds the Arabic yeh and kaf into the Persian forms, which Urdu keyboards mix', () => {
    expect(normalizeSearch('ي')).toBe('ی');
    expect(normalizeSearch('ك')).toBe('ک');
    expect(normalizeSearch('ى')).toBe('ی');
    expect(normalizeSearch('كتاب')).toBe(normalizeSearch('کتاب'));
    expect(normalizeSearch('علي')).toBe(normalizeSearch('علی'));
  });
  it('drops Arabic diacritics, tatweel and the zero-width joiners', () => {
    expect(normalizeSearch('مُخْرُوط')).toBe(normalizeSearch('مخروط'));
    expect(normalizeSearch('مـخـروط')).toBe('مخروط');
    expect(normalizeSearch('خط‌مستقیم')).toBe('خطمستقیم');
  });
  it('maps Eastern digits, both sets, to Western', () => {
    expect(normalizeSearch('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeSearch('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeSearch('باب ۱۲')).toBe('باب 12');
  });
  it('case-folds, strips Latin accents and collapses spaces', () => {
    expect(normalizeSearch('  CÔNE   Volume ')).toBe('cone volume');
    expect(normalizeSearch('Ångström')).toBe('angstrom');
  });
  it('is idempotent and total on odd input', () => {
    for (const s of ['', ' ', 'à', 'ﷺ', '‌‌', 'كﻲ', '١٢ ٣']) expect(normalizeSearch(normalizeSearch(s))).toBe(normalizeSearch(s));
  });
});

const catalog = buildCatalog(fixtureRows(), new Date('2026-11-28T00:00:00Z')).catalog;
const data = buildSearchData(catalog, 'en');
const dataUr = buildSearchData(catalog, 'ur');
const find = (over: Partial<SearchState>, d = data) => searchTopics(d, { ...EMPTY_SEARCH, ...over }).map((e) => e.id);

describe('searchTopics (matrix)', () => {
  it('a name: topics with the word in the title come first, then summary or tag matches', () => {
    const ids = find({ q: 'cone' });
    expect(ids).toContain('geo-cone-volume');
    expect(ids).toContain('geo-cone-section');
    expect(data.topics.find((t) => t.id === ids[0])!.titleWords).toContain('cone');
    const titleHits = ids.filter((id) => data.topics.find((t) => t.id === id)!.titleWords.includes('cone'));
    expect(ids.slice(0, titleHits.length)).toEqual(titleHits);
  });
  it('every word must match: a second word narrows', () => {
    const one = find({ q: 'cone' });
    const two = find({ q: 'cone volume' });
    expect(two.length).toBeLessThan(one.length);
    expect(two).toEqual(['geo-cone-volume']);
    expect(find({ q: 'cone zzzz' })).toEqual([]);
  });
  it('a part of a word matches, in any case and with accents', () => {
    expect(find({ q: 'CON' })).toContain('geo-cone-volume');
    expect(find({ q: 'cône' })).toEqual(find({ q: 'cone' }));
  });
  it('a blank query shows every published topic, so the filters work alone; the unpublished and the deleted are never in it', () => {
    for (const q of ['', '   ']) {
      const ids = find({ q });
      expect(ids).toHaveLength(11);
      expect(ids).not.toContain('stats-dice');
      expect(ids).not.toContain('trig-right-triangle');
    }
    expect(find({ q: 'dice' })).toEqual([]);
  });
  it('nothing found is an empty list', () => expect(find({ q: 'zzzz' })).toEqual([]));
  it('each result has its category path, the level and minutes', () => {
    const e = data.topics.find((t) => t.id === 'geo-cone-volume')!;
    expect(e.path).toEqual(['Geometry', 'Solids and volume', 'Cones']);
    expect(LEVELS).toContain(e.level);
    expect(e.minutes).toBeGreaterThan(0);
  });
  it('filters narrow by category and level, and a group with nothing chosen allows all', () => {
    const geometry = find({ cats: ['geometry'] });
    expect(geometry).toHaveLength(5);
    const byLevel = find({ levels: ['foundation'] });
    for (const id of byLevel) expect(data.topics.find((t) => t.id === id)!.level).toBe('foundation');
    const both = find({ cats: ['geometry'], levels: ['foundation'] });
    expect(both.every((id) => geometry.includes(id) && byLevel.includes(id))).toBe(true);
    expect(find({ cats: ['geometry', 'algebra'] }).length).toBe(geometry.length + find({ cats: ['algebra'] }).length);
    expect(find({ cats: ['no-such-category'] })).toEqual([]);
  });
  it('filters and text combine, and clearing the filters keeps the text', () => {
    const withFilter = find({ q: 'cone', cats: ['algebra'] });
    expect(withFilter).toEqual([]);
    expect(find({ q: 'cone', cats: [] }).length).toBeGreaterThan(0);
  });
  it('the same state always gives the same answer, in reading order within a group', () => {
    expect(find({ q: 'a' })).toEqual(find({ q: 'a' }));
  });
});

describe('Urdu queries find the same topics however they are typed', () => {
  const urdu = dataUr.topics.find((t) => t.id === 'geo-cone-volume')!;
  const word = urdu.title.split(' ')[0]!;
  it('plain, with alternate letter forms, with diacritics and with ZWNJ', () => {
    const plain = find({ q: word }, dataUr);
    expect(plain).toContain('geo-cone-volume');
    const alt = word.replace(/ی/g, 'ي').replace(/ک/g, 'ك');
    expect(find({ q: alt }, dataUr)).toEqual(plain);
    expect(find({ q: word.split('').join('َ') }, dataUr)).toEqual(plain);
    expect(find({ q: word.split('').join('‌') }, dataUr)).toEqual(plain);
  });
  it('the Urdu path names are Urdu', () => expect(urdu.path[0]).toBe('جیومیٹری'));
  it('Eastern and Western digits are the same query', () => {
    expect(find({ q: '١٢' }, dataUr)).toEqual(find({ q: '12' }, dataUr));
    expect(find({ q: '۱۲' }, dataUr)).toEqual(find({ q: '12' }, dataUr));
  });
});

describe('the address', () => {
  const p = (s: string) => parseSearchAddress(new URLSearchParams(s));
  it('reads q, cat and level', () => expect(p('q=cone&cat=geometry,algebra&level=foundation,advanced')).toEqual({ q: 'cone', cats: ['geometry', 'algebra'], levels: ['foundation', 'advanced'] }));
  it('ignores an unknown level, a malformed or repeated slug and a missing key', () => {
    expect(p('level=expert,foundation,foundation&cat=Geo Metry,a--b,algebra,algebra')).toEqual({ q: '', cats: ['algebra'], levels: ['foundation'] });
    expect(p('')).toEqual(EMPTY_SEARCH);
  });
  it('takes the first of a repeated key and limits the text to 200 characters', () => {
    expect(p('q=one&q=two').q).toBe('one');
    expect(p(`q=${'x'.repeat(500)}`).q).toHaveLength(200);
  });
  it('writes only what is set, and reads back what it wrote', () => {
    expect(formatSearchAddress(EMPTY_SEARCH)).toBe('');
    const state: SearchState = { q: 'cone & more ٢', cats: ['geometry'], levels: ['foundation', 'advanced'] };
    expect(formatSearchAddress(state)).toBe('q=cone%20%26%20more%20%D9%A2&cat=geometry&level=foundation,advanced');
    expect(p(formatSearchAddress(state))).toEqual(state);
    expect(formatSearchAddress({ q: '   ', cats: [], levels: [] })).toBe('');
  });
});

const html = (locale: 'en' | 'ur', child: ReturnType<typeof createElement>) => renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: child }));

describe('the search page as server HTML', () => {
  it('shows the query and chips restored from the address, a labelled field, a live count and the results with their path', () => {
    const out = html('en', createElement(SearchPage, { data }));
    expect(out).toContain('value="cone"');
    expect(out).toContain('role="search"');
    expect(out).toContain('Search</label>');
    expect(out).toContain('role="status"');
    expect(out).toMatch(/topics? found/);
    expect(out).toContain('aria-pressed="true"'); // the Geometry chip, from cat=geometry
    expect(out).toContain('data-clear-filters');
    expect(out).toContain('data-path');
    expect(out).toContain('Solids and volume');
  });
  it('has a chip for each category that has topics, and for each level', () => {
    const out = html('en', createElement(SearchPage, { data }));
    expect(out.match(/data-chip="(arithmetic-and-numbers|algebra|geometry|trigonometry|statistics-and-probability)"/g)).toHaveLength(5);
    expect(out).not.toContain('data-chip="calculus"');
    for (const l of LEVELS) expect(out).toContain(`data-chip="${l}"`);
  });
  it('a result card is one link to the topic with title, summary, level, minutes and the path', () => {
    const out = html('en', createElement(SearchResults, { entries: data.topics.slice(0, 2) }));
    expect(out.match(/<a /g)).toHaveLength(2);
    expect(out).toContain(`href="/en/topic/${data.topics[0]!.id}"`);
    expect(out).toContain('data-path');
    expect(out).toContain('data-level');
  });
  it('in Urdu: Urdu words and names', () => {
    const out = html('ur', createElement(SearchPage, { data: dataUr }));
    expect(out).toContain(ur.search.categoryGroup);
    expect(out).toContain('جیومیٹری');
  });
  it('every search word exists in both languages', () => {
    expect(Object.keys(ur.search).sort()).toEqual(Object.keys(en.search).sort());
    for (const v of Object.values(ur.search)) expect(v.trim().length).toBeGreaterThan(0);
  });
});

describe('the catalog search words use the same normalization', () => {
  it('a topic’s Urdu search words hold no diacritic, tatweel, ZWNJ or Eastern digit', () => {
    for (const t of catalog.topics) expect(t.searchTokens['ur']).toBe(normalizeSearch(t.searchTokens['ur']!));
  });
});

describe('speed (NFR-1.5)', () => {
  it('600 topics, every query shape, answer far under a second', () => {
    const base = data.topics[0]!;
    const big = { ...data, topics: Array.from({ length: 600 }, (_, i) => ({ ...base, id: `t${i}`, title: `Topic ${i} cone`, titleWords: `topic ${i} cone`, words: `topic ${i} cone about the volume of a cone and more words here` })) };
    const start = performance.now();
    for (const q of ['', 'cone', 'cone volume', 'zzzz', 'a b c d']) searchTopics(big, { ...EMPTY_SEARCH, q, levels: ['foundation'] });
    expect(performance.now() - start).toBeLessThan(500);
  });
});
