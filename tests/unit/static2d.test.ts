/* eslint-disable @typescript-eslint/no-explicit-any -- the tests read fixture topics by path */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STATIC2D_TYPES, static2D, type Static2DInput } from '../../src/features/scene';
import { sceneRegistry } from '../../src/scenes/registry';

// The epic-3 goal: every scene type has a static2D, a pure picture of its start state that a server can render.

const FIXTURES: Record<string, string[]> = {
  canvas2d: ['alg-quadratic-graph', 'geo-triangle-transform', 'cx-argand-arithmetic', 'cx-roots-powers', 'calc-tangent-derivative', 'calc-limit-zoom', 'calc-riemann-sums'],
  'matrix-transform': ['mx-plane-transform', 'mx-determinant-area', 'mx-eigenvectors', 'mx-cube-volume'],
  surface3d: ['sf-paraboloid', 'sf-saddle', 'sf-bend'],
  'number-model': ['num-equivalent-fractions'],
  'algebra-tool': ['alg-balance-scale', 'alg-solve-steps'],
  'unit-circle': ['trig-unit-circle'],
  'right-triangle': ['trig-right-triangle'],
  stats: ['stats-normal-distribution', 'stats-dice'],
  solid3d: ['geo-cone-section', 'geo-cone-volume', 'geo-cylinder-fill', 'geo-cylinder-net'],
  space3d: ['vec-3d-vectors', 'vec-3d-lines-planes'],
};
const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
const render = (input: Static2DInput) => {
  const el = static2D(input);
  return el === null ? null : renderToStaticMarkup(el);
};
const all = Object.entries(FIXTURES).flatMap(([type, names]) => names.map((name) => ({ type, name })));

describe('every scene type has a static picture', () => {
  it('the types static2D draws are exactly the types in the scene registry, and each has a fixture here', () => {
    const registered = sceneRegistry.keys().map((k) => k.split('@')[0]!);
    expect([...new Set(registered)].sort()).toEqual([...STATIC2D_TYPES].sort());
    expect(Object.keys(FIXTURES).sort()).toEqual([...STATIC2D_TYPES].sort());
  });
  for (const { type, name } of all) {
    it(`${name}: an image with the caption, an SVG, no listeners, no hex colors, no NaN`, () => {
      const topic = load(name);
      const out = render({ topic, locale: 'en' })!;
      expect(out).not.toBeNull();
      expect(out).toContain(`data-static2d="${type}"`);
      expect(out).toContain('role="img"');
      expect(out).toContain(`aria-label="${topic.scene.caption.en.replaceAll('"', '&quot;').replaceAll("'", '&#x27;')}"`);
      expect(out).toContain('<svg');
      expect(out).not.toMatch(/ on[A-Z]\w+=|onclick/i);
      expect(out).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/);
      expect(out).not.toMatch(/NaN|Infinity/);
    });
    it(`${name}: the same input gives the same picture`, () => {
      expect(render({ topic: load(name), locale: 'en' })).toBe(render({ topic: load(name), locale: 'en' }));
    });
    it(`${name}: in Urdu the caption is Urdu`, () => {
      const topic = load(name);
      const out = render({ topic, locale: 'ur' })!;
      expect(out).toContain('dir="ltr"');
      expect(out).toContain('aria-label="' + topic.scene.caption.ur.replaceAll('"', '&quot;').replaceAll("'", '&#x27;'));
    });
  }
});

describe('what static2D draws is what the scene says', () => {
  it('a scene type it does not know is null, not a crash', () => {
    const topic = load('stats-dice');
    topic.scene.type = 'not-built-yet';
    expect(static2D({ topic, locale: 'en' })).toBeNull();
  });
  it('a locale the topic does not have falls back to English', () => {
    const topic = load('stats-dice');
    expect(render({ topic, locale: 'fr' })).toContain(topic.scene.caption.en);
  });
  it('step values change the picture: more dice rolls, another numerator, another angle', () => {
    const dice = (tr: number) => render({ topic: load('stats-dice'), locale: 'en', step: { params: { tr } } });
    expect(dice(6)).not.toBe(dice(600));
    const bars = (n1: number) => render({ topic: load('num-equivalent-fractions'), locale: 'en', step: { params: { n1 } } });
    expect(bars(1)).not.toBe(bars(3));
    const circle = (angle: number) => render({ topic: load('trig-unit-circle'), locale: 'en', step: { params: { angle } } });
    expect(circle(30)).not.toBe(circle(150));
  });
  it('a step that hides a part, or shows an element, changes the picture', () => {
    const normal = (hidden: string[]) => render({ topic: load('stats-normal-distribution'), locale: 'en', step: { hidden: new Set(hidden) } })!;
    expect(normal([])).not.toBe(normal(['shade']));
    expect(normal([])).toBe(normal(['no-such-part']));
    const graph = (shown: string[]) => render({ topic: load('alg-quadratic-graph'), locale: 'en', step: { shown: new Set(shown) } })!;
    expect(graph([])).not.toBe(graph(['line']));
  });
  it('a solid shows its start state: the section of the cone is drawn, the net of the cylinder is drawn', () => {
    expect(render({ topic: load('geo-cone-section'), locale: 'en' })).toContain('data-layer="cut"');
    expect(render({ topic: load('geo-cylinder-net'), locale: 'en' })).toContain('data-solid-2d');
    expect(render({ topic: load('geo-cylinder-fill'), locale: 'en' })).toContain('data-layer');
  });
  it('the step solver is drawn as its first moves in text', () => {
    const out = render({ topic: load('alg-solve-steps'), locale: 'en', step: { params: { m: 3 } } })!;
    expect(out).toContain('2x + 3 = 11');
    expect(out).toContain('2x = 8');
    expect(render({ topic: load('alg-solve-steps'), locale: 'en', step: { params: { m: 1 } } })).not.toContain('2x = 8');
  });
  it('the words of a triangle and the letters of a coin come from the caller', () => {
    const tri = render({ topic: load('trig-right-triangle'), locale: 'ur', words: { opposite: 'مقابل', adjacent: 'ملحق', hypotenuse: 'وتر' } })!;
    expect(tri).toContain('مقابل');
    expect(render({ topic: load('trig-right-triangle'), locale: 'en' })).toContain('hypotenuse');
    const coin = load('stats-dice');
    coin.scene.chart = { kind: 'simulation', sim: 'coin', trials: 20, seed: 1 };
    expect(render({ topic: coin, locale: 'en', words: { heads: 'C', tails: 'P' } })).toContain('>C<');
    expect(render({ topic: coin, locale: 'en' })).toContain('>H<');
  });
  it('a broken scene (nothing computable) is an empty picture, not a throw', () => {
    const topic = load('num-equivalent-fractions');
    topic.scene.model = { kind: 'fractionBars', rows: [{ num: 'nope(', den: '0/0' }] };
    expect(() => render({ topic, locale: 'en' })).not.toThrow();
    const bad = load('alg-quadratic-graph');
    bad.scene.elements = [{ id: 'f', type: 'function', expr: 'constructor(1)' }];
    expect(() => render({ topic: bad, locale: 'en' })).not.toThrow();
  });
});

describe('static2D is safe for a server component', () => {
  const source = readFileSync('src/features/scene/static2d.tsx', 'utf8');
  it('has no client directive, no hooks and no browser API', () => {
    expect(source).not.toMatch(/^['"]use client['"]/m);
    expect(source).not.toMatch(/\buse(State|Effect|Memo|Ref|Callback|Layout|Translations|Locale)\b/);
    expect(source).not.toMatch(/\b(window|document|localStorage|matchMedia)\b/);
  });
  it('imports nothing from the viewers or their client-only state', () => {
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
    for (const i of imports) {
      if (i.startsWith('./')) expect(source, i).toMatch(new RegExp(`import type .* from '${i.replace('.', '\\.')}'`));
    }
    expect(imports).not.toContain('./useSceneState');
    expect(imports).not.toContain('./viewers');
    expect(imports).not.toContain('../../scenes/frame');
  });
});
