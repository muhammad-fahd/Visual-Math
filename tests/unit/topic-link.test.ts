import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMigrations, readMigrations } from '../../scripts/check-migrations.mjs';
import type { PGlite } from '@electric-sql/pglite';

// Story 5.4: the topic by its direct link: loadTopic, the published_topic() function, prerequisites and what is next.
const state = vi.hoisted(() => ({ rpc: vi.fn(), client: true }));
vi.mock('../../src/db/admin', () => ({ adminClient: () => (state.client ? { rpc: state.rpc } : null) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/topic/geo-cone-section' }));

import { TopicPage } from '../../src/features/topic';
import { chapterNeighbours, isTopicId, linkedTopics } from '../../src/lib/library';
import type { Topic } from '../../src/lib/topic-schema';
import { buildCatalog, type CatalogRows } from '../../src/lib/topic-schema/catalog';
import { fixtureRows } from '../../src/server/fixture-catalog';
import { loadTopic } from '../../src/server/topic-source';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

let db: PGlite;
beforeAll(async () => {
  db = await applyMigrations(readMigrations());
});
beforeEach(() => {
  state.rpc = vi.fn();
  state.client = true;
  vi.unstubAllEnvs();
});

const catalog = buildCatalog(fixtureRows() as CatalogRows, new Date('2026-11-28T00:00:00Z')).catalog;

describe('isTopicId', () => {
  it('accepts what the schema accepts and nothing else', () => {
    for (const ok of ['geo-cone-volume', 'abc', 'a1-b2']) expect(isTopicId(ok), ok).toBe(true);
    for (const bad of ['', 'ab', 'A B', 'Upper', 'a--b', '-a-', 'a_b', '../etc', 'a/b', 'x'.repeat(65)]) expect(isTopicId(bad), bad).toBe(false);
  });
});

describe('neighbours and links (pure)', () => {
  it('previous and next are the topics around one in its chapter, in reading order', () => {
    const net = chapterNeighbours(catalog, 'geo-cylinder-fill');
    const ids = [chapterNeighbours(catalog, 'geo-cylinder-fill'), chapterNeighbours(catalog, 'geo-cylinder-net')].map((n) => [n.previous?.id, n.next?.id]);
    expect(ids.flat().filter(Boolean)).toHaveLength(2); // two topics in the chapter: one has only a next, the other only a previous
    expect(net.previous === undefined || net.next === undefined).toBe(true);
  });
  it('a topic alone in its chapter, and an unknown id, have no neighbours', () => {
    expect(chapterNeighbours(catalog, 'geo-cone-volume')).toEqual({ previous: undefined, next: undefined });
    expect(chapterNeighbours(catalog, 'nope')).toEqual({});
  });
  it('linkedTopics keeps the published, in the listed order, once each, never the topic itself', () => {
    const ids = linkedTopics(catalog, ['geo-cylinder-fill', 'stats-dice', 'no-such-topic', 'geo-cone-volume', 'geo-cylinder-fill', 'geo-cone-section'], 'geo-cone-section').map((t) => t.id);
    expect(ids).toEqual(['geo-cylinder-fill', 'geo-cone-volume']);
    expect(linkedTopics(catalog, undefined, 'x')).toEqual([]);
    expect(linkedTopics(catalog, ['trig-right-triangle'], 'x')).toEqual([]); // deleted
  });
});

describe('loadTopic', () => {
  it('under the harness: a published fixture comes back; unpublished, deleted, unknown and malformed ids do not', async () => {
    vi.stubEnv('VM_HARNESS', '1');
    expect((await loadTopic('geo-cone-volume'))!.id).toBe('geo-cone-volume');
    for (const id of ['stats-dice', 'trig-right-triangle', 'no-such-topic', 'A B', '../x', '']) expect(await loadTopic(id), id).toBeNull();
  });
  it('with a database: calls published_topic with the id, and a document for another id is refused', async () => {
    const doc = { id: 'abc-topic', steps: [], scene: {} };
    state.rpc = vi.fn(async () => ({ data: doc, error: null }));
    expect(await loadTopic('abc-topic')).toEqual(doc);
    expect(state.rpc).toHaveBeenCalledWith('published_topic', { p_id: 'abc-topic' });
    expect(await loadTopic('other-topic')).toBeNull(); // the row says abc-topic: not the document asked for
    state.rpc = vi.fn(async () => ({ data: null, error: null }));
    expect(await loadTopic('abc-topic')).toBeNull();
  });
  it('a malformed id never reaches the database', async () => {
    await loadTopic('A B');
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('a database error throws, without its message; with no database it is null', async () => {
    state.rpc = vi.fn(async () => ({ data: null, error: { message: 'connection refused at postgres://u:p@h' } }));
    await expect(loadTopic('abc-topic')).rejects.toThrow('published_topic failed');
    state.client = false;
    expect(await loadTopic('abc-topic')).toBeNull();
  });
});

describe('published_topic() on a real Postgres', () => {
  const h = (c: string) => `sha256:${c.repeat(64).slice(0, 64)}`;
  const ask = async (id: string) => (await db.query<{ published_topic: unknown }>('select public.published_topic($1)', [id])).rows[0]!.published_topic;
  beforeAll(async () => {
    await db.query("insert into public.subcategory (id, category_id, name_en, name_ur, position) values ('pt-sub', 'algebra', 'S', 'ایس', 1)");
    await db.query("insert into public.chapter (id, subcategory_id, name_en, name_ur, position) values ('pt-chap', 'pt-sub', 'C', 'سی', 1)");
    const add = (id: string) => db.query("insert into public.topic (id, chapter_id, level, chapter_order, wave) values ($1, 'pt-chap', 'foundation', 1, 1)", [id]);
    const ver = (id: string, c: string, seq: number, doc: object) => db.query('insert into public.topic_version (topic_id, content_hash, seq, doc) values ($1, $2, $3, $4)', [id, h(c), seq, doc]);
    await add('pt-live');
    await ver('pt-live', 'a', 1, { id: 'pt-live', v: 'published' });
    await ver('pt-live', 'b', 2, { id: 'pt-live', v: 'newer draft' });
    await db.query("update public.topic set published_hash = $1, latest_hash = $2 where id = 'pt-live'", [h('a'), h('b')]);
    await add('pt-draft');
    await ver('pt-draft', 'c', 1, { id: 'pt-draft' });
    await add('pt-gone');
    await ver('pt-gone', 'd', 1, { id: 'pt-gone' });
    await db.query("update public.topic set published_hash = $1 where id = 'pt-gone'", [h('d')]);
    await db.query("update public.topic set published_hash = null, deleted_at = now() where id = 'pt-gone'");
  });
  it('gives the published version, not the latest', async () => expect(await ask('pt-live')).toEqual({ id: 'pt-live', v: 'published' }));
  it('gives null for a draft, a deleted topic and an unknown id', async () => {
    expect(await ask('pt-draft')).toBeNull();
    expect(await ask('pt-gone')).toBeNull();
    expect(await ask('pt-none')).toBeNull();
  });
  it('only the service role may call it', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select public.published_topic('pt-live')")).rejects.toThrow(/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    expect((await db.query("select public.published_topic('pt-live')")).rows).toHaveLength(1);
    await db.exec('reset role');
  });
});

import cone from '../../content/fixtures/geo-cone-section.json';
const html = (locale: 'en' | 'ur', props: Record<string, unknown>) =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(TopicPage, { topic: cone as unknown as Topic, ...props }) }));
const link = (id: string, title: string) => ({ title: { en: title, ur: `${title}-ur` }, href: `/en/topic/${id}` });

describe('the topic page with prerequisites, what is next and Share', () => {
  const out = html('en', { prerequisites: [link('geo-cone-volume', 'Cone volume')], upNext: [link('geo-cylinder-fill', 'Cylinder fill')] });
  it('lists "what you need first" with links, and the topic is fully there (never locked)', () => {
    expect(out).toContain('data-testid="prerequisites"');
    expect(out).toContain('What you need first');
    expect(out).toContain('href="/en/topic/geo-cone-volume"');
    expect(out).toContain('id="param-cut"'); // the sliders are there
    const box = /<aside[^>]*data-testid="prerequisites".*?<\/aside>/s.exec(out)![0];
    expect(box).not.toMatch(/disabled|locked|aria-disabled/i); // a list of links, nothing more
  });
  it('lists "what to learn next"', () => {
    expect(out).toContain('data-testid="learn-next"');
    expect(out).toContain('What to learn next');
    expect(out).toContain('href="/en/topic/geo-cylinder-fill"');
  });
  it('shows neither with nothing listed', () => {
    const none = html('en', {});
    expect(none).not.toContain('data-testid="prerequisites"');
    expect(none).not.toContain('data-testid="learn-next"');
  });
  it('has the Share button and an empty polite toast', () => {
    expect(out).toContain('data-testid="share"');
    expect(out).toMatch(/role="status"[^>]*data-testid="share-status"|data-testid="share-status"[^>]*role="status"/);
  });
  it('in Urdu: Urdu words and Urdu titles', () => {
    const ru = html('ur', { prerequisites: [link('geo-cone-volume', 'Cone volume')] });
    expect(ru).toContain(ur.topic.needFirst);
    expect(ru).toContain('Cone volume-ur');
    expect(ru).toContain(ur.topic.share);
  });
  it('the new words exist in both languages', () => {
    for (const k of ['needFirst', 'learnNext', 'share', 'shareCopied', 'shareFailed'] as const) {
      expect(en.topic[k].length).toBeGreaterThan(0);
      expect(ur.topic[k].length).toBeGreaterThan(0);
    }
  });
});

describe('the route', () => {
  it('migration 0007 names the function the server calls', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('supabase/migrations/0007_published_topic.sql', 'utf8')).toMatch(/create function public\.published_topic\(p_id text\) returns jsonb/);
  });
});
