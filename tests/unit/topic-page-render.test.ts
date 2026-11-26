/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { TopicPage } from '../../src/features/topic';
import type { Topic } from '../../src/lib/topic-schema';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// The server render of the topic page: what is in the HTML before any script runs, and text that must
// never become markup.

const load = (id = 'geo-cone-section') => JSON.parse(readFileSync(`content/fixtures/${id}.json`, 'utf8')) as any;
const html = (topic: unknown, locale: 'en' | 'ur' = 'en', extra: Record<string, unknown> = {}) =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(TopicPage, { topic: topic as Topic, ...extra }) }));

describe('the topic page in the server HTML', () => {
  const out = html(load());
  it('has the path, the title, step 1 of 3, the sliders, the formulas, the example, Try this and Watch out', () => {
    expect(out).toContain('aria-label="You are here"');
    expect(out).toContain('href="/en/geometry/solids-volume/cone-sections"');
    expect(out).toContain('Cutting a Cone');
    expect(out).toContain('Step 1 of 3');
    expect(out).toContain('id="param-cut"');
    expect(out).toContain('data-formula="f1"');
    expect(out).toContain('data-testid="example"');
    expect(out).toContain('data-testid="try-this"');
    expect(out).toContain('data-testid="watch-out"');
  });
  it('the first step is applied before any script runs: the cut slider is at the step value', () => {
    expect(out).toMatch(/id="param-cut"[^>]*value="0"/);
  });
  it('is laid out in the two ways of SRS 7.2: a grid of thirds on a laptop, a sticky picture on a phone', () => {
    expect(out).toContain('lg:grid-cols-3');
    expect(out).toContain('lg:col-span-2');
    expect(out).toContain('max-lg:sticky');
    expect(out).toContain('id="scene"');
  });
  it('uses logical CSS only (the layout mirrors in Urdu by itself)', () => {
    expect(out).not.toMatch(/class="[^"]*\b(ml|mr|pl|pr)-\d/);
    expect(out).not.toMatch(/class="[^"]*\btext-(left|right)\b/);
  });
  it('is in Urdu on /ur', () => {
    const urdu = html(load(), 'ur');
    expect(urdu).toContain('مخروط کو کاٹنا');
    expect(urdu).toContain('مرحلہ 1 از 3');
  });
  it('a missing neighbour is left out; a given one is a link with its title', () => {
    expect(html(load())).not.toContain('rel="prev"');
    const both = html(load(), 'en', { previous: { title: { en: 'Before', ur: 'پہلے' }, href: '/en/x' }, next: { title: { en: 'After', ur: 'بعد' }, href: '/en/y' } });
    expect(both).toContain('rel="prev"');
    expect(both).toContain('href="/en/y"');
    expect(both).toContain('After');
  });
  it('the names of the path come from the tree when given', () => {
    const named = html(load(), 'en', { names: { category: { en: 'Geometry and shapes', ur: 'ہندسہ' } }, hrefs: { category: '/en/c/geometry' } });
    expect(named).toContain('Geometry and shapes');
    expect(named).toContain('href="/en/c/geometry"');
  });
});

describe('text that must never become markup', () => {
  const hostile = () => {
    const t = load();
    t.title.en = '<img src=x onerror=alert(1)>';
    t.goal.en = '<script>alert(1)</script> **bold** {{term:unit}}';
    t.steps[0].title.en = '</h2><script>x()</script>';
    t.steps[0].body.en = '<b onclick="x()">body</b> {{term:constructor}} {{term:__proto__}}';
    t.tryThis[0].en = '<iframe src="https://evil.test"></iframe>';
    t.watchOut.en = '[click](javascript:alert(1))';
    t.terms = [{ id: 'unit', term: { en: '<i>unit</i>', ur: 'اکائی' }, definition: { en: 'd', ur: 'د' } }];
    t.example.problem.en = '<script>{{a}}</script>';
    return t;
  };
  const out = html(hostile());
  it('is escaped: no script, iframe, image or event handler comes from topic text', () => {
    expect(out).not.toMatch(/<script>alert/);
    expect(out).not.toMatch(/<script>x\(\)/);
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('<b onclick');
    expect(out).not.toContain('<i>unit</i>');
    expect(out).toContain('&lt;script&gt;');
  });
  it('bold and a real term still work, and a term that is not in this topic shows nothing', () => {
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('data-term="unit"');
    expect(out).not.toContain('data-term="constructor"');
  });
  it('a link in text is just text', () => {
    expect(out).toContain('[click](javascript:alert(1))');
    expect(out).not.toMatch(/href="javascript:/);
  });
});

describe('a topic whose picture has no viewer yet', () => {
  it('shows its steps, example and a plain message, not a crash', () => {
    const t = load();
    t.scene = { type: 'unit-circle', v: 1, caption: { en: 'c', ur: 'ک' }, angle: 'r' };
    const out = html(t);
    expect(out).toContain('data-testid="no-scene"');
    expect(out).toContain('Step 1 of 3');
    expect(out).toContain('data-testid="example"');
    expect(out).not.toContain('data-solid-viewer');
  });
});

describe('the worked example on the page', () => {
  it('shows the live values of its inputs and calculated lines', () => {
    const out = html(load('geo-cylinder-net'));
    expect(out).toContain('radius 3.0 cm');
    expect(out).toContain('150.8');
  });
  it('a line that cannot be computed shows a dash in the words and "undefined" in the math, and the page stays up', () => {
    const t = load('geo-cylinder-net');
    t.example.lines[0].calc.expr = '1 / 0';
    const out = html(t);
    expect(out).toMatch(/The surface area is about —/); // the answer's words: a dash, never the word "undefined" or "NaN"
    expect(out).not.toMatch(/NaN|Infinity/);
    expect(out).toContain('undefined'); // the math says it in words
    expect(out).toContain('data-testid="answer"');
  });
  it('an expression that is hostile is a number that is not there, not code', () => {
    const t = load('geo-cylinder-net');
    t.example.lines[0].calc.expr = 'constructor(1)';
    expect(() => html(t)).not.toThrow();
  });
});
