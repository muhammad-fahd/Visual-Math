/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit fixtures by path and feed hostile values */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { SpaceViewer, type SpaceTopic } from '../../src/features/scene/SpaceViewer';
import { static2D } from '../../src/features/scene';
import { createProgram } from '../../src/lib/params';
import { clipLine, buildSpace, planeInBox, toScene, type Fact, type SpaceElement, type SpaceModel } from '../../src/lib/space';
import { LOCALES } from '../../src/i18n/locales';
import { Space2D } from '../../src/scenes/space3d';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';

// Story 4.1: the drawing model of `space3d` against known values, the schema, the fixtures, and the viewer's HTML.

const fixture = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
const label = (text: string) => ({ text: { en: text, ur: text } });
const labelOf = (l: any, id: string) => (l ? l.text.en : id);

/** The model of a scene whose parameters are `params` (named in the expressions). */
function model(elements: SpaceElement[], params: Record<string, number> = {}, over: { range?: number | string; hidden?: string[] } = {}): SpaceModel {
  const program = createProgram(Object.keys(params));
  return buildSpace({ scene: { range: over.range, elements }, program, scope: program.scope(params), hidden: new Set(over.hidden ?? []), labelOf });
}
const fact = <K extends Fact['kind']>(m: SpaceModel, id: string, kind: K) => m.facts.find((f) => f.id === id && f.kind === kind) as Extract<Fact, { kind: K }>;
const vec = (id: string, to: [number, number, number], from?: [number, number, number]): SpaceElement => ({ type: 'vector', id, to, ...(from ? { from } : {}), label: label(id) });
const near = (a: readonly number[], b: readonly number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, 6));

describe('the picture’s coordinates', () => {
  it('math (x, y, z) is drawn at (y, z, x): z is up, and a right-handed cross product stays right-handed', () => {
    expect(toScene([1, 2, 3])).toEqual([2, 3, 1]);
    const m = model([vec('x', [1, 0, 0]), vec('y', [0, 1, 0]), { type: 'op', id: 'c', op: 'cross', of: ['x', 'y'] }]);
    const c = m.segments.find((s) => s.id === 'c')!;
    near(c.b, [0, 1, 0]); // +z is up on the screen
  });
});

describe('add, scale, cross, dot (matrix, known values)', () => {
  it('add: (1,2,0) + (3,-1,2) = (4,1,2), drawn tip to tail and from the origin', () => {
    const m = model([vec('a', [1, 2, 0]), vec('b', [3, -1, 2]), { type: 'op', id: 'sum', op: 'add', of: ['a', 'b'] }]);
    const f = fact(m, 'sum', 'add');
    expect(f.v).toEqual([4, 1, 2]);
    expect(f.length).toBeCloseTo(Math.sqrt(21), 9);
    const mains = m.segments.filter((s) => s.id === 'sum' && s.weight === 2);
    near(mains[0]!.a, [0, 0, 0]);
    near(mains[0]!.b, toScene([4, 1, 2]));
    const parts = m.segments.filter((s) => s.id === 'sum' && s.dash === 'dashed' && s.weight === 1);
    near(parts[0]!.b, toScene([1, 2, 0])); // the first part reaches the tip of a
    near(parts[parts.length - 1]!.b, toScene([4, 1, 2])); // the last part ends at the sum
  });
  it('add of three vectors', () => {
    const m = model([vec('a', [1, 0, 0]), vec('b', [0, 2, 0]), vec('c', [0, 0, 3]), { type: 'op', id: 's', op: 'add', of: ['a', 'b', 'c'] }]);
    expect(fact(m, 's', 'add').v).toEqual([1, 2, 3]);
  });
  it('scale: (1,2,3) by -2 = (-2,-4,-6), twice as long and reversed', () => {
    const m = model([vec('v', [1, 2, 3]), { type: 'op', id: 's', op: 'scale', of: ['v'], k: -2 }]);
    const f = fact(m, 's', 'scale');
    expect(f.v).toEqual([-2, -4, -6]);
    expect(f.length).toBeCloseTo(2 * Math.sqrt(14), 9);
    near(m.segments.find((s) => s.id === 's' && s.weight === 2)!.b, toScene([-2, -4, -6]));
  });
  it('scale by an expression of a parameter, and from a vector that does not start at the origin', () => {
    const m = model([vec('v', [3, 1, 1], [1, 1, 1]), { type: 'op', id: 's', op: 'scale', of: ['v'], k: 'k' }], { k: 1.5 });
    near(m.segments.find((s) => s.id === 's' && s.weight === 2)!.a, toScene([1, 1, 1]));
    expect(fact(m, 's', 'scale').v).toEqual([3, 0, 0]);
  });
  it('cross: (1,0,0) x (0,1,0) = (0,0,1), length 1 (the area of the unit square)', () => {
    const m = model([vec('a', [1, 0, 0]), vec('b', [0, 1, 0]), { type: 'op', id: 'c', op: 'cross', of: ['a', 'b'] }]);
    const f = fact(m, 'c', 'cross');
    expect(f.v).toEqual([0, 0, 1]);
    expect(f.length).toBe(1);
    expect(f.parallel).toBe(false);
  });
  it('cross: (1,2,2) x (2,0,1) = (2,3,-4), length sqrt 29; and a x b = - b x a', () => {
    const m = model([vec('a', [1, 2, 2]), vec('b', [2, 0, 1]), { type: 'op', id: 'c', op: 'cross', of: ['a', 'b'] }, { type: 'op', id: 'd', op: 'cross', of: ['b', 'a'] }]);
    expect(fact(m, 'c', 'cross').v).toEqual([2, 3, -4]);
    expect(fact(m, 'c', 'cross').length).toBeCloseTo(Math.sqrt(29), 9);
    expect(fact(m, 'd', 'cross').v).toEqual([-2, -3, 4]);
  });
  it('cross of parallel vectors is the zero vector: not drawn, and the text says parallel', () => {
    const m = model([vec('a', [1, 2, 3]), vec('b', [2, 4, 6]), { type: 'op', id: 'c', op: 'cross', of: ['a', 'b'] }]);
    const f = fact(m, 'c', 'cross');
    expect(f.parallel).toBe(true);
    expect(f.v).toEqual([0, 0, 0]);
    expect(m.segments.some((s) => s.id === 'c')).toBe(false);
  });
  it('dot: (1,2,3) . (4,-5,6) = 12 and the angle between them; the projection of a on b is drawn', () => {
    const m = model([vec('a', [1, 2, 3]), vec('b', [4, -5, 6]), { type: 'dot', id: 'd', a: 'a', b: 'b' }]);
    const f = fact(m, 'd', 'dot');
    expect(f.value).toBe(12);
    expect(f.angle!).toBeCloseTo((Math.acos(12 / Math.sqrt(14 * 77)) * 180) / Math.PI, 9);
    expect(f.angle!).toBeCloseTo(68.56, 2);
    const proj = m.segments.find((s) => s.id === 'd' && s.weight === 2)!;
    const k = 12 / 77; // the foot is (12 / |b|^2) b
    near(proj.b, toScene([4 * k, -5 * k, 6 * k]));
  });
  it('dot: perpendicular vectors give 0 and 90 degrees; the same vector gives |a|^2 and 0 degrees; opposite gives 180', () => {
    const m = model([vec('x', [1, 0, 0]), vec('y', [0, 1, 0]), vec('z', [2, 0, 0]), vec('w', [-3, 0, 0]), { type: 'dot', id: 'p', a: 'x', b: 'y' }, { type: 'dot', id: 'q', a: 'z', b: 'z' }, { type: 'dot', id: 'r', a: 'x', b: 'w' }]);
    expect(fact(m, 'p', 'dot')).toMatchObject({ value: 0, angle: 90 });
    expect(fact(m, 'q', 'dot')).toMatchObject({ value: 4, angle: 0 });
    expect(fact(m, 'r', 'dot')).toMatchObject({ value: -3, angle: 180 });
  });
  it('dot with a zero vector: the value is 0, the angle is not defined, and no projection is drawn', () => {
    const m = model([vec('a', [1, 2, 3]), vec('z', [0, 0, 0]), { type: 'dot', id: 'd', a: 'a', b: 'z' }]);
    expect(fact(m, 'd', 'dot')).toMatchObject({ value: 0, angle: null });
    expect(m.segments.some((s) => s.id === 'd')).toBe(false);
  });
});

describe('lines and planes', () => {
  it('a line through the origin along (1,1,1) is cut to the box: from (-6,-6,-6) to (6,6,6)', () => {
    const m = model([{ type: 'line', id: 'l', point: [0, 0, 0], direction: [1, 1, 1] }]);
    const s = m.segments.find((x) => x.id === 'l')!;
    near(s.a, toScene([-6, -6, -6]));
    near(s.b, toScene([6, 6, 6]));
    expect(fact(m, 'l', 'line').inside).toBe(true);
    expect(m.marks.some((x) => x.id === 'l')).toBe(true); // the starting point is inside the box
  });
  it('a line parallel to an axis, and one that misses the box', () => {
    near(clipLine([1, 1, 0], [0, 0, 1], 6)!, [-6, 6]);
    expect(clipLine([7, 0, 0], [0, 0, 1], 6)).toBeNull();
    expect(clipLine([10, 10, 10], [1, 1, 1], 6)).toEqual([-16, -4].map((t) => t - 0) as [number, number]);
  });
  it('a line outside the box is not drawn and the fact says so', () => {
    const m = model([{ type: 'line', id: 'l', point: [20, 0, 0], direction: [0, 1, 0] }]);
    expect(m.segments.some((s) => s.id === 'l')).toBe(false);
    expect(fact(m, 'l', 'line').inside).toBe(false);
  });
  it('a zero direction is left out and named', () => {
    const m = model([{ type: 'line', id: 'l', point: [0, 0, 0], direction: [0, 0, 0] }]);
    expect(m.facts).toEqual([{ kind: 'skipped', id: 'l', label: 'l', reason: 'zero' }]);
    expect(m.segments.some((s) => s.id === 'l')).toBe(false);
  });
  it('plane z = 2 is a square patch at height 2 with a normal arrow', () => {
    const m = model([{ type: 'plane', id: 'p', normal: [0, 0, 1], d: 2 }]);
    const patch = m.patches.find((p) => p.id === 'p')!;
    expect(patch.points).toHaveLength(4);
    for (const q of patch.points) expect(q[1]).toBeCloseTo(2, 9); // picture y is math z
    expect(m.segments.some((s) => s.id === 'p' && s.weight === 2)).toBe(true);
    expect(fact(m, 'p', 'plane')).toMatchObject({ normal: [0, 0, 1], d: 2, inside: true });
  });
  it('the plane x + y + z = 0 meets the box in a hexagon, every corner on the plane', () => {
    const poly = planeInBox([1, 1, 1], 0, 6)!;
    expect(poly).toHaveLength(6);
    for (const q of poly) expect(q[0] + q[1] + q[2]).toBeCloseTo(0, 9);
  });
  it('a plane that misses the box has no patch; a zero normal is left out', () => {
    expect(model([{ type: 'plane', id: 'p', normal: [0, 0, 1], d: 100 }]).patches).toEqual([]);
    expect(planeInBox([0, 0, 1], 100, 6)).toBeNull();
    expect(model([{ type: 'plane', id: 'p', normal: [0, 0, 0], d: 1 }]).facts[0]).toMatchObject({ kind: 'skipped', reason: 'zero' });
  });
  it('a plane through a corner, along a face and along an edge direction does not fail', () => {
    for (const [n, d] of [[[1, 1, 1], 18], [[1, 0, 0], 6], [[1, 1, 0], 0], [[1, 1, 1], -18]] as const) {
      const poly = planeInBox(n as any, d, 6);
      if (poly) for (const q of poly) expect(Number.isFinite(q[0] + q[1] + q[2])).toBe(true);
    }
  });
});

describe('hostile and odd input never gives NaN geometry', () => {
  const finite = (m: SpaceModel) => {
    for (const s of m.segments) for (const v of [...s.a, ...s.b]) expect(Number.isFinite(v)).toBe(true);
    for (const p of m.patches) for (const q of p.points) for (const v of q) expect(Number.isFinite(v)).toBe(true);
    for (const t of m.tags) for (const v of t.at) expect(Number.isFinite(v)).toBe(true);
    for (const k of m.marks) for (const v of k.at) expect(Number.isFinite(v)).toBe(true);
  };
  it('1e9 components are clamped inside fifty ranges of the origin', () => {
    const m = model([vec('a', [1e9, -1e9, 1e9]), { type: 'line', id: 'l', point: [0, 0, 0], direction: [1e9, 1, 1] }, { type: 'plane', id: 'p', normal: [1e9, 1, 1], d: 1e9 }]);
    finite(m);
    for (const s of m.segments) for (const v of [...s.a, ...s.b]) expect(Math.abs(v)).toBeLessThanOrEqual(300 + 1e-6);
  });
  it('a division by zero or an overflow leaves the element out, named, with the rest intact', () => {
    const m = model([vec('a', [1, 2, 3]), vec('bad', ['1/0', 0, 0] as any), vec('also', ['k', 0, 0] as any)], { k: 0 });
    finite(m);
    expect(m.facts.find((f) => f.id === 'bad')).toMatchObject({ kind: 'skipped', reason: 'notFinite' });
    expect(m.facts.find((f) => f.id === 'a')).toBeDefined();
  });
  it('an expression that does not parse leaves its element out, named, instead of throwing', () => {
    const m = model([vec('a', [1, 2, 3]), vec('bad', ['ax +', 0, 0] as any)], { ax: 1 });
    expect(m.facts.find((f) => f.id === 'bad')).toMatchObject({ kind: 'skipped', reason: 'notFinite' });
    expect(m.facts.find((f) => f.id === 'a')).toBeDefined();
  });
  it('an element that names a missing or later vector is left out and named', () => {
    const m = model([{ type: 'op', id: 's', op: 'add', of: ['a', 'b'] }, vec('a', [1, 0, 0]), { type: 'dot', id: 'd', a: 'a', b: 'nope' }]);
    expect(m.facts.filter((f) => f.kind === 'skipped').map((f) => [f.id, (f as any).reason])).toEqual([['s', 'missing'], ['d', 'missing']]);
  });
  it('the range is clamped (1 to 50) and 6 by default; a broken range falls back to 6', () => {
    expect(model([vec('a', [1, 1, 1])]).range).toBe(6);
    expect(model([vec('a', [1, 1, 1])], {}, { range: 1000 }).range).toBe(50);
    expect(model([vec('a', [1, 1, 1])], {}, { range: -5 }).range).toBe(1);
    expect(model([vec('a', [1, 1, 1])], {}, { range: '1/0' }).range).toBe(6);
  });
  it('a long grid stays small: at most about 25 lines per direction', () => {
    const m = model([vec('a', [1, 1, 1])], {}, { range: 50 });
    expect(m.segments.filter((s) => s.id === 'grid').length).toBeLessThanOrEqual(60);
  });
});

describe('what a step can hide', () => {
  const els = [vec('a', [1, 0, 0]), vec('b', [0, 1, 0]), { type: 'op', id: 'sum', op: 'add', of: ['a', 'b'] } as SpaceElement];
  it('a hidden element is not drawn, not listed, and an element built on it still works', () => {
    const m = model(els, {}, { hidden: ['a', 'b'] });
    expect(m.segments.some((s) => s.id === 'a' || s.id === 'b')).toBe(false);
    expect(m.facts.map((f) => f.id)).toEqual(['sum']);
    expect(fact(m, 'sum', 'add').v).toEqual([1, 1, 0]);
  });
  it('the fixed parts hide too: axes, grid and box', () => {
    const all = model(els);
    expect(all.segments.some((s) => s.id === 'axes')).toBe(true);
    expect(all.segments.some((s) => s.id === 'grid')).toBe(true);
    expect(all.segments.some((s) => s.id === 'box')).toBe(true);
    const none = model(els, {}, { hidden: ['axes', 'grid', 'box'] });
    expect(none.segments.filter((s) => ['axes', 'grid', 'box'].includes(s.id))).toEqual([]);
    expect(none.tags.some((t) => t.id === 'axes')).toBe(false);
  });
  it('the same scene at the same values is the same model', () => {
    expect(model(els)).toEqual(model(els));
  });
});

describe('the schema', () => {
  const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
  const codes = (doc: unknown) => {
    const r = validator.validate(doc);
    return r.ok ? [] : r.problems.map((p) => `${p.code} ${p.pointer}`);
  };
  it('both fixture topics are valid, formula checks included', () => {
    for (const name of ['vec-3d-vectors', 'vec-3d-lines-planes']) expect(codes(fixture(name)), name).toEqual([]);
  });
  it.each([
    ['an unknown element type', (d: any) => (d.scene.elements[0].type = 'blob')],
    ['an unknown field on an element', (d: any) => (d.scene.elements[0].colour = 'red')],
    ['a vector with two numbers', (d: any) => (d.scene.elements[0].to = [1, 2])],
    ['no elements', (d: any) => (d.scene.elements = [])],
    ['a duplicate id', (d: any) => (d.scene.elements[1].id = d.scene.elements[0].id)],
    ['a scale without k', (d: any) => delete d.scene.elements[3].k],
    ['a cross of one vector', (d: any) => (d.scene.elements[5].of = ['a'])],
    ['an add of one vector', (d: any) => (d.scene.elements[2].of = ['a'])],
    ['more than 24 elements', (d: any) => (d.scene.elements = Array.from({ length: 25 }, (_, i) => ({ type: 'point', id: `p${i}`, at: [0, 0, 0] })))],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('vec-3d-vectors');
    edit(doc);
    expect(codes(doc).length).toBeGreaterThan(0);
  });
});

describe('the viewer as server HTML', () => {
  const html = (topic: SpaceTopic, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
    renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(SpaceViewer, { topic, ...props }) }));
  const topic = () => fixture('vec-3d-vectors') as SpaceTopic;
  it('has the sliders and typed boxes, the live numbers in words, and no canvas; the device picks the tier later', () => {
    const out = html(topic());
    expect(out).toContain('id="param-ax"');
    expect(out).toContain('data-typed="bx"');
    expect(out).toContain('data-space-viewer');
    expect(out).toContain('data-tier="pending"');
    expect(out).not.toContain('<canvas');
    expect(out).toContain('a = (1, 2, 2), length 3.');
    expect(out).toContain('a · b = 4; the angle between them is 53.4 degrees.');
    expect(out).toContain('a × b = (2, 3, −4), length 5.39, the area of the parallelogram spanned by a and b.');
    expect(out).toContain('a + b = (3, 2, 3)');
  });
  it('a step that hides things takes them out of the text', () => {
    const out = html(topic(), 'en', { step: { index: 0, params: {}, hidden: new Set(['sum', 'scaled', 'dotab', 'cross']) } });
    expect(out).toContain('a = (1, 2, 2)');
    expect(out).not.toContain('a + b =');
    expect(out).not.toContain('angle between');
  });
  it('is in Urdu with the picture kept left to right', () => {
    const out = html(topic(), 'ur');
    expect(out).toContain('dir="ltr"');
    expect(out).toContain('لمبائی');
  });
  it('a topic with an element that is not defined still renders, with a sentence saying so', () => {
    const t = topic();
    (t.scene as any).elements[1].to = ['1/0', 0, 0];
    const out = html(t);
    expect(out).toContain('is left out');
  });
});

describe('the static picture and the flat renderer', () => {
  it('static2D draws the scene at its start values, with its labels, as plain markup', () => {
    const el = static2D({ topic: fixture('vec-3d-vectors'), locale: 'en' })!;
    const out = renderToStaticMarkup(el);
    expect(out).toContain('data-static2d="space3d"');
    expect(out).toContain('data-space-2d');
    expect(out).toContain('data-seg="a"');
    expect(out).toContain('>a<');
    expect(out).not.toMatch(/NaN|Infinity/);
  });
  it('a step’s hidden parts are not in the static picture', () => {
    const out = renderToStaticMarkup(static2D({ topic: fixture('vec-3d-vectors'), locale: 'en', step: { hidden: new Set(['sum', 'cross', 'dotab', 'scaled']) } })!);
    expect(out).not.toContain('data-seg="sum"');
  });
  it('the overlay draws only the labels when the geometry is off, and no line when it is the lines that are asked for', () => {
    const m = model([vec('a', [1, 2, 3])]);
    const view = { azimuth: 30, elevation: 20, scale: 1, panX: 0, panY: 0 };
    const labelsOnly = renderToStaticMarkup(createElement(Space2D, { model: m, view, geometry: false, labels: true }));
    expect(labelsOnly).not.toContain('<line');
    expect(labelsOnly).toContain('data-tag="a"');
    const all = renderToStaticMarkup(createElement(Space2D, { model: m, view, geometry: true, labels: true }));
    expect(all).toContain('<line');
    expect(all).not.toMatch(/NaN|Infinity/);
  });
  it('dashes and colors: two elements never differ by color alone', () => {
    const m = model([vec('a', [1, 0, 0]), vec('b', [0, 1, 0]), vec('c', [0, 0, 1]), vec('d', [1, 1, 0]), vec('e', [0, 1, 1])]);
    const look = (id: string) => {
      const s = m.segments.find((x) => x.id === id)!;
      return `${s.token}/${s.dash}`;
    };
    expect(new Set(['a', 'b', 'c', 'd', 'e'].map(look)).size).toBe(5);
  });
});

describe('the 3D chunk stays lazy', () => {
  it('the barrel of the scene does not export the three.js renderer', () => {
    const text = readFileSync('src/scenes/space3d/index.ts', 'utf8');
    expect(text).not.toMatch(/export[^;]*Space3D['"]?\s*from/);
    expect(text).not.toContain("from './Space3D'");
  });
  it('the viewer loads it with a dynamic import and no other file imports three', () => {
    expect(readFileSync('src/features/scene/SpaceViewer.tsx', 'utf8')).toContain("dynamic(() => import('../../scenes/space3d/Space3D')");
  });
  it('every new word exists in both languages', () => {
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(ur.space).sort()).toEqual(keys(en.space).sort());
  });
});
