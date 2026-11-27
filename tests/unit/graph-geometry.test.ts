/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { Canvas2DViewer, type Canvas2DTopic } from '../../src/features/scene';
import { angleAt, buildDrawables, clipLine, distance, perimeter, polygonArea, reflectLine, reflectX, reflectY, rotate, scaleAbout, translate, type Canvas2DScene, type Element } from '../../src/lib/graph';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { Canvas2D } from '../../src/scenes/canvas2d';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 3.2: the measures and transformations (pure), the elements that name points, the schema, the fixture
// topic, and the text and picture it makes. Each row of the spec's I/O matrix has a test here.

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);

describe('measures', () => {
  it('distance, angle in degrees, shoelace area and perimeter', () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
    near(angleAt([1, 0], [0, 0], [0, 1])!, 90);
    near(angleAt([1, 0], [0, 0], [-1, 0])!, 180);
    near(angleAt([1, 0], [0, 0], [1, 1])!, 45);
    expect(polygonArea([[0, 0], [4, 0], [0, 3]])).toBe(6);
    expect(polygonArea([[0, 0], [1, 1], [2, 2]])).toBe(0);
    near(perimeter([[0, 0], [4, 0], [0, 3]]), 12);
    expect(perimeter([[0, 0], [3, 4]], false)).toBe(5);
  });
  it('a ray with no length gives no angle; numbers that are not numbers give NaN or null', () => {
    expect(angleAt([0, 0], [0, 0], [1, 1])).toBeNull();
    expect(angleAt([1, 1], [0, 0], [NaN, 1])).toBeNull();
    expect(distance([0, 0], [Infinity, 1])).toBeNaN();
    expect(polygonArea([[0, 0], [1, 0]])).toBeNaN();
  });
  it('rounding just past 1 in the cosine does not make a NaN angle', () => {
    expect(angleAt([1, 0], [0, 0], [1 + 1e-16, 0])).toBe(0);
    expect(angleAt([0.1, 0.2], [0, 0], [0.2, 0.4])).not.toBeNaN();
  });
});

describe('transformations', () => {
  it('reflect over the axes and over a line', () => {
    expect(reflectY([3, 2])).toEqual([-3, 2]);
    expect(reflectX([3, 2])).toEqual([3, -2]);
    const m = reflectLine([3, 0], [0, 0], [1, 1])!;
    near(m[0], 0);
    near(m[1], 3);
    expect(reflectLine([1, 1], [2, 2], [2, 2])).toBeNull();
  });
  it('rotate 90 degrees about the origin sends (1, 0) to (0, 1)', () => {
    const r = rotate([1, 0], [0, 0], 90);
    near(r[0], 0);
    near(r[1], 1);
    const about = rotate([2, 1], [1, 1], 180);
    near(about[0], 0);
    near(about[1], 1);
  });
  it('translate and scale; a factor of 0 collapses onto the centre', () => {
    expect(translate([1, 2], 3, -1)).toEqual([4, 1]);
    expect(scaleAbout([2, 4], [0, 0], 0.5)).toEqual([1, 2]);
    expect(scaleAbout([2, 4], [1, 1], 0)).toEqual([1, 1]);
  });
});

describe('a line, a ray and a segment against the window', () => {
  const win = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };
  it('a line reaches both edges, a ray starts at its first point, a segment stays between its ends', () => {
    const l = clipLine([0, 0], [1, 1], win, 'line')!;
    expect(l[0][0]).toBeLessThan(-6);
    expect(l[1][0]).toBeGreaterThan(6);
    const r = clipLine([0, 0], [1, 1], win, 'ray')!;
    expect(r[0]).toEqual([0, 0]);
    expect(r[1][0]).toBeGreaterThan(6);
    expect(clipLine([0, 0], [1, 1], win, 'segment')).toEqual([[0, 0], [1, 1]]);
  });
  it('the same point twice, a miss and a non-number give null', () => {
    expect(clipLine([1, 1], [1, 1], win, 'line')).toBeNull();
    expect(clipLine([20, 20], [21, 20], win, 'line')).toBeNull();
    expect(clipLine([NaN, 0], [1, 1], win, 'line')).toBeNull();
  });
  it('a vertical and a horizontal line are clipped', () => {
    const v = clipLine([2, 0], [2, 1], win, 'line')!;
    expect(v[0][0]).toBe(2);
    expect(v[1][0]).toBe(2);
    expect(clipLine([20, 0], [20, 1], win, 'line')).toBeNull();
  });
});

const pt = (id: string, x: number | string, y: number | string, extra: object = {}): Element => ({ id, type: 'point', at: [x, y], ...extra }) as Element;
const scene = (elements: Element[]): Canvas2DScene => ({ viewport: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 }, elements });
const draw = (s: Canvas2DScene, params: Record<string, number> = {}, over: Partial<Parameters<typeof buildDrawables>[0]> = {}) => {
  const program = createProgram(Object.keys(params));
  return buildDrawables({ scene: s, program, scope: program.scope(params), view: { scale: 1, panX: 0, panY: 0 }, ...over });
};
const value = (d: ReturnType<typeof draw>, id: string) => d.measures.find((m) => m.id === id)?.value;

describe('shapes that name points (buildDrawables)', () => {
  it('a segment from (0,0) to (3,4) has length 5, listed and drawn; the same point twice has length 0 and is not drawn', () => {
    const d = draw(scene([pt('a', 0, 0), pt('b', 3, 4), { id: 'ab', type: 'segment', a: 'a', b: 'b', measure: true }]));
    expect(value(d, 'ab-length')).toBe(5);
    expect(d.shapes.map((s) => s.id)).toEqual(['ab']);
    const same = draw(scene([pt('a', 1, 1), pt('b', 1, 1), { id: 'ab', type: 'segment', a: 'a', b: 'b', measure: true }]));
    expect(value(same, 'ab-length')).toBe(0);
    expect(same.shapes).toEqual([]);
  });
  it('dragging a point moves every shape built on it, live', () => {
    const els: Element[] = [pt('a', 'px', 0, { drag: { x: 'px' } }), pt('o', 0, 0), pt('b', 0, 1), { id: 'ang', type: 'angle', points: ['a', 'o', 'b'] }, { id: 'ao', type: 'segment', a: 'a', b: 'o', measure: true }];
    const at1 = draw(scene(els), { px: 1 });
    near(value(at1, 'ang-angle')!, 90);
    expect(value(at1, 'ao-length')).toBe(1);
    expect(at1.points[0]!.drag).toEqual({ x: 'px', y: null });
    const at3 = draw(scene(els), { px: 3 });
    expect(value(at3, 'ao-length')).toBe(3);
    near(value(at3, 'ang-angle')!, 90);
  });
  it('an angle of (1,0), (0,0), (0,1) is 90 degrees with an arc at the vertex; the vertex on an arm reads undefined', () => {
    const d = draw(scene([pt('a', 1, 0), pt('o', 0, 0), pt('b', 0, 1), { id: 'ang', type: 'angle', points: ['a', 'o', 'b'] }]));
    near(value(d, 'ang-angle')!, 90);
    expect(d.shapes.find((s) => s.kind === 'angle')).toBeDefined();
    const bad = draw(scene([pt('a', 0, 0), pt('o', 0, 0), pt('b', 0, 1), { id: 'ang', type: 'angle', points: ['a', 'o', 'b'] }]));
    expect(value(bad, 'ang-angle')).toBeNaN();
    expect(bad.shapes.find((s) => s.kind === 'angle')).toBeUndefined();
    expect(draw(scene([pt('a', 1, 0), pt('o', 0, 0), pt('b', 0, 1), { id: 'ang', type: 'angle', points: ['a', 'o', 'b'], measure: false }])).measures).toEqual([]);
  });
  it('a line goes edge to edge, a ray starts at its point, the same point twice draws nothing', () => {
    const els = (ray: boolean, b: [number, number]): Element[] => [pt('a', 0, 0), pt('b', b[0], b[1]), { id: 'l', type: 'line', through: ['a', 'b'], ray }];
    const line = draw(scene(els(false, [1, 1]))).shapes[0] as any;
    expect(line.ends[0][0]).toBeLessThan(-6);
    const ray = draw(scene(els(true, [1, 1]))).shapes[0] as any;
    expect(ray.ends[0]).toEqual([0, 0]);
    expect(draw(scene(els(false, [0, 0]))).shapes).toEqual([]);
  });
  it('a circle takes a radius or a point on it; a radius of 0, below 0 or NaN draws nothing', () => {
    const c = (extra: object): Element[] => [pt('o', 0, 0), pt('p', 3, 4), { id: 'c', type: 'circle', center: 'o', measure: true, ...extra } as Element];
    const through = draw(scene(c({ through: 'p' })));
    expect(value(through, 'c-radius')).toBe(5);
    near(value(through, 'c-circumference')!, 10 * Math.PI);
    near(value(through, 'c-area')!, 25 * Math.PI);
    expect(draw(scene(c({ radius: 2 }))).shapes).toHaveLength(1);
    expect(draw(scene(c({ radius: 0 }))).shapes).toEqual([]);
    expect(draw(scene(c({ radius: -1 }))).shapes).toEqual([]);
    expect(draw(scene(c({ radius: '0/0' }))).shapes).toEqual([]);
    expect(draw(scene(c({}))).shapes).toEqual([]);
  });
  it('a triangle has its perimeter and area; collinear points have area 0; a polygon may mix points and coordinates', () => {
    const tri = draw(scene([pt('a', 0, 0), pt('b', 4, 0), pt('c', 0, 3), { id: 't', type: 'polygon', points: ['a', 'b', 'c'], measure: true }]));
    near(value(tri, 't-perimeter')!, 12);
    expect(value(tri, 't-area')).toBe(6);
    const flat = draw(scene([pt('a', 0, 0), pt('b', 1, 1), pt('c', 2, 2), { id: 't', type: 'polygon', points: ['a', 'b', 'c'], measure: true }]));
    expect(value(flat, 't-area')).toBe(0);
    const mixed = draw(scene([pt('a', 0, 0), { id: 't', type: 'polygon', points: ['a', [4, 0], [0, 3]], measure: true }]));
    expect(value(mixed, 't-area')).toBe(6);
  });
  it('a reference to a missing, hidden or non-computable point draws nothing and does not throw', () => {
    const els: Element[] = [pt('a', 0, 0), pt('b', '1/0', 0), { id: 's1', type: 'segment', a: 'a', b: 'nope' }, { id: 's2', type: 'segment', a: 'a', b: 'b' }, { id: 't', type: 'polygon', points: ['a', 'b', 'a'] }];
    expect(() => draw(scene(els))).not.toThrow();
    expect(draw(scene(els)).shapes).toEqual([]);
  });
  it('a step that hides a point hides the shapes that use it', () => {
    const els: Element[] = [pt('a', 0, 0), pt('b', 3, 4), { id: 'ab', type: 'segment', a: 'a', b: 'b', measure: true }];
    const d = draw(scene(els), {}, { hidden: new Set(['a', 'zzz']) });
    expect(d.shapes).toEqual([]);
    expect(d.measures).toEqual([]);
    expect(draw(scene(els), {}, { hidden: new Set(['ab']) }).points).toHaveLength(2);
  });
});

describe('transform elements', () => {
  const tri = (how: object, extra: object = {}): Element[] => [pt('a', 1, 0), pt('b', 3, 0), pt('c', 1, 2), { id: 'p', type: 'polygon', points: ['a', 'b', 'c'] }, { id: 'img', type: 'transform', of: 'p', how, ...extra } as Element];
  const image = (els: Element[], params: Record<string, number> = {}, over = {}) => draw(scene(els), params, over).shapes.find((s) => s.id === 'img') as any;
  it('reflect over the y-axis negates x; over the x-axis negates y; over a line through two points', () => {
    expect(image(tri({ kind: 'reflect', over: 'y' })).points).toEqual([[-1, 0], [-3, 0], [-1, 2]]);
    expect(image(tri({ kind: 'reflect', over: 'x' })).points).toEqual([[1, -0], [3, -0], [1, -2]]);
    const els = [...tri({ kind: 'reflect', over: ['o', 'q'] }), pt('o', 0, 0), pt('q', 1, 1)];
    const pts = image(els).points as [number, number][];
    near(pts[0]![0], 0);
    near(pts[0]![1], 1);
    expect(image(tri({ kind: 'reflect', over: ['o', 'nope'] }))).toBeUndefined();
  });
  it('rotate follows its parameter; (1, 0) turned 90 degrees is (0, 1)', () => {
    const els = tri({ kind: 'rotate', degrees: 'r' });
    const p = image(els, { r: 90 }).points as [number, number][];
    near(p[0]![0], 0);
    near(p[0]![1], 1);
    const q = image(els, { r: 180 }).points as [number, number][];
    near(q[0]![0], -1);
    expect(image(tri({ kind: 'rotate', degrees: '1/0' }), {})).toBeUndefined();
  });
  it('translate and scale follow their parameters; a factor of 0 collapses the image onto the centre without a throw', () => {
    expect(image(tri({ kind: 'translate', dx: 'd', dy: 1 }), { d: 2 }).points[0]).toEqual([3, 1]);
    expect(image(tri({ kind: 'scale', k: 'k' }), { k: 2 }).points).toEqual([[2, 0], [6, 0], [2, 4]]);
    const collapsed = image(tri({ kind: 'scale', k: 'k' }), { k: 0 }).points as [number, number][];
    expect(collapsed.every((p) => p[0] === 0 && p[1] === 0)).toBe(true);
    const about = image([...tri({ kind: 'scale', about: 'o', k: 2 }), pt('o', 1, 0)]).points;
    expect(about[0]).toEqual([1, 0]);
  });
  it('the image is dashed in another token, and shows when only the image is wanted (the source hidden)', () => {
    const img = image(tri({ kind: 'translate', dx: 1, dy: 0 }));
    expect(img.style.dash).toBe('dashed');
    expect(img.image).toBe(true);
    const els = tri({ kind: 'translate', dx: 1, dy: 0 }).map((e) => (e.id === 'p' ? { ...e, visible: false } : e)) as Element[];
    const d = draw(scene(els));
    expect(d.shapes.map((s) => s.id)).toEqual(['img']);
  });
  it('a transform of something that is not a polygon, or whose parameters are bad, is nothing', () => {
    expect(image([pt('a', 0, 0), { id: 'img', type: 'transform', of: 'a', how: { kind: 'translate', dx: 1, dy: 1 } }])).toBeUndefined();
    expect(image(tri({ kind: 'translate', dx: 'nope(', dy: 1 }))).toBeUndefined();
  });
});

describe('the schema (canvas2d@1 geometry)', () => {
  const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
  const load = () => JSON.parse(readFileSync('content/fixtures/geo-triangle-transform.json', 'utf8')) as any;
  const ok = (edit: (d: any) => void) => {
    const d = load();
    edit(d);
    return validator.validate(d).ok;
  };
  it('the fixture topic passes', () => {
    const r = validator.validate(load());
    expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
  });
  it('a polygon needs 3 to 12 corners', () => {
    expect(ok((d) => (d.scene.elements[0].points = ['a', 'b']))).toBe(false);
    expect(ok((d) => (d.scene.elements[0].points = Array.from({ length: 13 }, () => 'a')))).toBe(false);
    expect(ok((d) => (d.scene.elements[0].points = ['a', 'b', [1, 2]]))).toBe(true);
  });
  it('an angle takes exactly three points, a line two; a transform needs a known kind and its fields', () => {
    expect(ok((d) => (d.scene.elements[1].points = ['a', 'b']))).toBe(false);
    expect(ok((d) => d.scene.elements.push({ id: 'l', type: 'line', through: ['a'] }))).toBe(false);
    expect(ok((d) => d.scene.elements.push({ id: 'l', type: 'line', through: ['a', 'b'], ray: true }))).toBe(true);
    expect(ok((d) => (d.scene.elements[3].how = { kind: 'shear', k: 1 }))).toBe(false);
    expect(ok((d) => (d.scene.elements[3].how = { kind: 'rotate' }))).toBe(false);
    expect(ok((d) => (d.scene.elements[3].how = { kind: 'reflect', over: 'z' }))).toBe(false);
    expect(ok((d) => (d.scene.elements[3].how = { kind: 'rotate', degrees: 45, extra: 1 }))).toBe(false);
  });
  it('ids must be well formed and unknown keys are refused', () => {
    expect(ok((d) => (d.scene.elements[0].id = 'Bad Id'))).toBe(false);
    expect(ok((d) => (d.scene.elements[2].surprise = 1))).toBe(false);
  });
  it('the formula checks of the fixture come out as the topic says', () => {
    const topic = load();
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const defaults = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
    for (const f of topic.formulas) {
      for (const check of f.checks) {
        const scope = program.scope({ ...defaults, ...check.at });
        for (const [name, expected] of Object.entries(check.expect) as [string, number][]) {
          expect(Math.abs(program.evaluate(f.bind[name].expr, scope) - expected), `${f.id}.${name}`).toBeLessThanOrEqual(0.5 * 10 ** -f.bind[name].decimals);
        }
      }
    }
  });
});

describe('the picture and the text (server HTML)', () => {
  const load = () => JSON.parse(readFileSync('content/fixtures/geo-triangle-transform.json', 'utf8')) as any;
  const html = (locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
    renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(Canvas2DViewer, { topic: load() as Canvas2DTopic, ...props }) }));
  const out = html();
  it('has the triangle, the angle mark, three handles and the measures as text', () => {
    expect(out).toContain('data-element="tri"');
    expect(out).toContain('data-kind="angle"');
    for (const id of ['a', 'b', 'c']) expect(out).toContain(`data-handle="${id}"`);
    expect(out).toContain('ABC: perimeter 10.24');
    expect(out).toContain('ABC: area 4.5');
    expect(out).toContain('Angle B: angle 90 degrees');
  });
  it('a transform that starts hidden is not in the picture until a step shows it, and then its corners are listed', () => {
    expect(out).not.toContain('data-element="reflect"');
    const shown = html('en', { step: { index: 1, params: {}, hidden: new Set(), shown: new Set(['reflect']) } });
    expect(shown).toContain('data-kind="image"');
    expect(shown).toContain('the image has corners (4, −1) (1, −1) (1, 2)');
  });
  it('is in Urdu on /ur with the numbers kept left to right', () => {
    const urdu = html('ur');
    expect(urdu).toContain('زاویہ 90 درجے');
    expect(urdu).toContain('dir="ltr"');
  });
  it('renders to static markup without a browser, with no listeners and no hex colors', () => {
    const topic = load();
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const params = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
    const drawables = buildDrawables({ scene: topic.scene, program, scope: program.scope(params), view: { scale: 1, panX: 0, panY: 0 }, shown: new Set(['reflect', 'ring']) });
    const markup = renderToStaticMarkup(createElement(Canvas2D, { drawables, axes: true, grid: true, labelText: () => '', readoutText: () => '', measureText: (m) => String(m.value) }));
    expect(markup).toContain('data-kind="circle"');
    expect(markup).not.toMatch(/ on[A-Z]\w+=|onclick/i);
    expect(markup).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/);
    expect(markup).not.toMatch(/NaN|Infinity/);
  });
});
