/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path and feed hostile values */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { Canvas2DViewer, static2D, type Canvas2DTopic } from '../../src/features/scene';
import { buildDrawables, complex, type Canvas2DScene, type ComplexFact, type Drawables, type Element } from '../../src/lib/graph';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { Canvas2D } from '../../src/scenes/canvas2d';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 4.2: the complex numbers of the Argand diagram, as arithmetic, as drawables, as schema and as the viewer's HTML.

const near = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits);
const nearC = (z: readonly [number, number], re: number, im: number, digits = 9) => {
  near(z[0], re, digits);
  near(z[1], im, digits);
};

describe('complex arithmetic (known values)', () => {
  it('modulus and argument: 3 + 4i is 5 at 53.13 degrees; -1 is 180; -i is -90; 1 - i is -45; 0 has no argument', () => {
    expect(complex.modulus([3, 4])).toBe(5);
    near(complex.argument([3, 4])!, 53.130102354, 6);
    expect(complex.argument([-1, 0])).toBe(180);
    expect(complex.argument([-1, -0])).toBe(180);
    expect(complex.argument([0, -1])).toBe(-90);
    near(complex.argument([1, -1])!, -45);
    expect(complex.argument([0, 0])).toBeNull();
    expect(complex.argument([NaN, 1])).toBeNull();
  });
  it('add, multiply and conjugate: (1+2i)+(3-i) = 4+i; (1+i)(1-i) = 2; i times i = -1', () => {
    expect(complex.add([1, 2], [3, -1])).toEqual([4, 1]);
    expect(complex.mul([1, 1], [1, -1])).toEqual([2, 0]);
    expect(complex.mul([0, 1], [0, 1])).toEqual([-1, 0]);
    expect(complex.conj([3, 4])).toEqual([3, -4]);
  });
  it('moduli multiply and arguments add', () => {
    const z: [number, number] = [2, 1];
    const w: [number, number] = [1, 2];
    const p = complex.mul(z, w);
    near(complex.modulus(p), complex.modulus(z) * complex.modulus(w));
    near(complex.argument(p)!, complex.argument(z)! + complex.argument(w)!);
    nearC(p, 0, 5);
  });
  it('powers by De Moivre are exact on the axes: i^2 = -1, i^3 = -i, i^4 = 1, (1+i)^8 = 16', () => {
    expect(complex.power([0, 1], 2)).toEqual([-1, 0]);
    expect(complex.power([0, 1], 3)).toEqual([0, -1]);
    expect(complex.power([0, 1], 4)).toEqual([1, 0]);
    nearC(complex.power([1, 1], 8), 16, 0);
    expect(complex.power([0, 0], 3)).toEqual([0, 0]);
    expect(complex.power([2, 0], 0)).toEqual([2 ** 0, 0]);
    expect(complex.power([1, 0], -1).every(Number.isNaN)).toBe(true);
  });
  it('the 6th roots of 1: six points 60 degrees apart on the unit circle, each to the 6th is 1, and they sum to 0', () => {
    const r = complex.roots([1, 0], 6);
    expect(r).toHaveLength(6);
    r.forEach((q, k) => {
      near(complex.modulus(q), 1);
      near(complex.argument(q)!, k < 4 ? 60 * k : 60 * k - 360, 6);
      nearC(complex.power(q, 6), 1, 0, 6);
    });
    nearC(r.reduce((s, q) => complex.add(s, q), [0, 0] as readonly [number, number]), 0, 0, 9);
    expect(r[0]).toEqual([1, 0]);
  });
  it('the cube roots of -8 have modulus 2 and arguments 60, 180, -60', () => {
    const r = complex.roots([-8, 0], 3);
    r.forEach((q) => near(complex.modulus(q), 2));
    expect(r.map((q) => Math.round(complex.argument(q)!))).toEqual([60, 180, -60]);
    nearC(r[1]!, -2, 0, 9);
  });
  it('the roots of zero, and of a bad n, are an empty list', () => {
    expect(complex.roots([0, 0], 4)).toEqual([]);
    expect(complex.roots([1, 0], 0)).toEqual([]);
    expect(complex.roots([1, 0], 2.5)).toEqual([]);
    expect(complex.roots([NaN, 0], 3)).toEqual([]);
  });
  it('formatComplex writes a number as a person does', () => {
    const f = complex.formatComplex;
    expect(f([3, 4])).toBe('3 + 4i');
    expect(f([3, -4])).toBe('3 − 4i');
    expect(f([-1, 0])).toBe('−1');
    expect(f([0, 2])).toBe('2i');
    expect(f([0, 1])).toBe('i');
    expect(f([0, -1])).toBe('−i');
    expect(f([0, 0])).toBe('0');
    expect(f([1.234, -0.5])).toBe('1.23 − 0.5i');
    expect(f([2, 1])).toBe('2 + i');
  });
});

const VIEW = { scale: 1, panX: 0, panY: 0 };
function draw(elements: Element[], params: Record<string, number> = {}, hidden: string[] = []): Drawables {
  const scene: Canvas2DScene = { viewport: { xMin: -6, xMax: 6, yMin: -4.5, yMax: 4.5 }, elements };
  const program = createProgram(Object.keys(params));
  return buildDrawables({ scene, program, scope: program.scope(params), view: VIEW, hidden: new Set(hidden) });
}
const z = (id: string, re: number | string, im: number | string, extra: Record<string, unknown> = {}): Element => ({ id, type: 'complex', re, im, ...extra }) as Element;
const op = (id: string, kind: string, of: string[], n?: number | string): Element => ({ id, type: 'complexOp', op: kind, of, ...(n === undefined ? {} : { n }) }) as Element;
const fact = <K extends ComplexFact['kind']>(d: Drawables, id: string, kind: K) => d.complex.find((f) => f.id === id && f.kind === kind) as Extract<ComplexFact, { kind: K }>;
const shapes = (d: Drawables, id: string) => d.shapes.filter((s) => s.id === id);

describe('a complex number as drawables (matrix)', () => {
  it('3 + 4i with its polar form: an arrow, a marker, an arc, the modulus 5 and the argument 53.13', () => {
    const d = draw([z('z', 3, 4, { polar: true })]);
    const f = fact(d, 'z', 'number');
    expect(f).toMatchObject({ re: 3, im: 4, modulus: 5 });
    near(f.argument!, 53.13, 2);
    const arrow = shapes(d, 'z')[0]!;
    expect(arrow).toMatchObject({ kind: 'line', arrow: true });
    expect(d.points.find((p) => p.id === 'z')).toMatchObject({ x: 3, y: 4 });
    expect(d.shapes.some((s) => s.kind === 'angle' && s.id === 'z-arg')).toBe(true);
    expect(d.texts.map((t) => (t.label as any).text.en)).toEqual(['r = 5', 'θ = 53.13°']);
  });
  it('without polar there is no arc and no text', () => {
    const d = draw([z('z', 3, 4)]);
    expect(d.shapes.some((s) => s.kind === 'angle')).toBe(false);
    expect(d.texts).toEqual([]);
  });
  it('zero has no argument and no arc', () => {
    const d = draw([z('z', 0, 0, { polar: true })]);
    expect(fact(d, 'z', 'number')).toMatchObject({ modulus: 0, argument: null });
    expect(d.shapes.some((s) => s.kind === 'angle')).toBe(false);
  });
  it('the argument is in (-180, 180]: -1, -i and 1 - i', () => {
    const d = draw([z('a', -1, 0), z('b', 0, -1), z('c', 1, -1)]);
    expect(fact(d, 'a', 'number').argument).toBe(180);
    expect(fact(d, 'b', 'number').argument).toBe(-90);
    near(fact(d, 'c', 'number').argument!, -45);
  });
  it('an arrow whose tip is outside the window has no head', () => {
    const d = draw([z('far', 20, 0)]);
    expect(shapes(d, 'far')[0]).toMatchObject({ arrow: false });
  });
  it('a number is draggable only when each coordinate is exactly the parameter it moves, with snap', () => {
    const d = draw([z('a', 'zr', 'zi', { drag: { x: 'zr', y: 'zi' }, snap: { step: 0.5 } }), z('b', 'zr + 1', 'zi', { drag: { x: 'zr', y: 'zi' } })], { zr: 2, zi: 1 });
    expect(d.points.find((p) => p.id === 'a')).toMatchObject({ drag: { x: 'zr', y: 'zi' }, snap: 0.5 });
    expect(d.points.find((p) => p.id === 'b')!.drag).toEqual({ x: null, y: 'zi' });
  });
  it('two numbers never differ by color alone: each takes the next look', () => {
    const d = draw([z('a', 1, 0), z('b', 0, 1), z('c', -1, 0), z('d', 0, -1)]);
    const look = (id: string) => {
      const arrow = shapes(d, id)[0] as any;
      const p = d.points.find((q) => q.id === id)!;
      return `${arrow.style.color}/${arrow.style.dash}/${p.style.marker}`;
    };
    expect(new Set(['a', 'b', 'c', 'd'].map(look)).size).toBe(4);
  });
});

describe('what is built on complex numbers (matrix)', () => {
  it('add: (1 + 2i) + (3 - i) = 4 + i, with the parallelogram and the sum from the origin', () => {
    const d = draw([z('a', 1, 2), z('b', 3, -1), op('s', 'add', ['a', 'b'])]);
    expect(fact(d, 's', 'add')).toMatchObject({ re: 4, im: 1, of: ['a', 'b'] });
    expect(shapes(d, 's').filter((s: any) => s.arrow === false)).toHaveLength(2);
    expect(shapes(d, 's').filter((s: any) => s.arrow === true)).toHaveLength(1);
    expect(d.points.find((p) => p.id === 's')).toMatchObject({ x: 4, y: 1, drag: null });
  });
  it('multiply: (1 + i)(1 - i) = 2; i times i = -1; the scale and the turn are the second factor’s modulus and argument', () => {
    const d = draw([z('a', 1, 1), z('b', 1, -1), z('i', 0, 1), op('p', 'mul', ['a', 'b']), op('q', 'mul', ['i', 'i'])]);
    expect(fact(d, 'p', 'mul')).toMatchObject({ re: 2, im: 0, modulus: 2 });
    near(fact(d, 'p', 'mul').scale, Math.SQRT2);
    near(fact(d, 'p', 'mul').turn!, -45);
    expect(fact(d, 'q', 'mul')).toMatchObject({ re: -1, im: 0, argument: 180, turn: 90 });
  });
  it('multiply draws the argument of the first and the turn by the second as arcs', () => {
    const d = draw([z('a', 2, 1), z('b', 1, 2), op('p', 'mul', ['a', 'b'])]);
    expect(d.shapes.filter((s) => s.kind === 'angle').map((s) => s.id)).toEqual(['p-arg1', 'p-turn']);
    near((d.shapes.find((s) => s.id === 'p-turn') as any).degrees, 63.43, 2);
  });
  it('a zero factor gives zero and draws no arc', () => {
    const d = draw([z('a', 2, 1), z('o', 0, 0), op('p', 'mul', ['a', 'o'])]);
    expect(fact(d, 'p', 'mul')).toMatchObject({ re: 0, im: 0, modulus: 0 });
    expect(d.shapes.some((s) => s.kind === 'angle')).toBe(false);
  });
  it('conjugate: 3 + 4i gives 3 - 4i', () => {
    const d = draw([z('a', 3, 4), op('c', 'conj', ['a'])]);
    expect(fact(d, 'c', 'conj')).toMatchObject({ re: 3, im: -4, of: 'a' });
  });
  it('powers of i, n = 4: four marks i, -1, -i, 1 on the unit circle, joined', () => {
    const d = draw([z('a', 0, 1), op('w', 'power', ['a'], 4)]);
    const marks = d.points.filter((p) => p.id.startsWith('w-'));
    expect(marks.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([[0, 1], [-1, 0], [0, -1], [1, 0]]);
    expect(shapes(d, 'w').filter((s) => s.kind === 'line')).toHaveLength(3);
    expect(fact(d, 'w', 'power')).toMatchObject({ n: 4, re: 1, im: 0, modulus: 1 });
    expect(marks.map((p) => (p.label as any).text.en)).toEqual(['a^1', 'a^2', 'a^3', 'a^4']);
  });
  it('roots of unity, n = 6: six marks, a circle of radius 1, a regular hexagon', () => {
    const d = draw([z('one', 1, 0), op('u', 'roots', ['one'], 6)]);
    expect(d.points.filter((p) => p.id.startsWith('u-'))).toHaveLength(6);
    expect(new Set(d.points.map((p) => p.id)).size).toBe(d.points.length); // keys are unique, or React keeps ghosts
    expect(shapes(d, 'u').find((s) => s.kind === 'circle')).toMatchObject({ cx: 0, cy: 0, r: 1 });
    const poly = shapes(d, 'u').find((s) => s.kind === 'polygon') as any;
    expect(poly.points).toHaveLength(6);
    expect(fact(d, 'u', 'roots')).toMatchObject({ n: 6, radius: 1, first: 0 });
    expect(fact(d, 'u', 'roots').roots).toHaveLength(6);
  });
  it('n = 2 draws a segment instead of a polygon; n comes from an expression and follows a parameter', () => {
    const two = draw([z('one', 1, 0), op('u', 'roots', ['one'], 2)]);
    expect(shapes(two, 'u').some((s) => s.kind === 'polygon')).toBe(false);
    expect(shapes(two, 'u').some((s) => s.kind === 'line')).toBe(true);
    expect(draw([z('one', 1, 0), op('u', 'roots', ['one'], 'n')], { n: 5 }).points.filter((p) => p.id.startsWith('u-'))).toHaveLength(5);
    expect(draw([z('one', 1, 0), op('u', 'roots', ['one'], 'n')], { n: 9 }).points.filter((p) => p.id.startsWith('u-'))).toHaveLength(9);
  });
  it('the cube roots of -8: radius 2, first at 60 degrees', () => {
    const d = draw([z('m', -8, 0), op('r', 'roots', ['m'], 3)]);
    const f = fact(d, 'r', 'roots');
    near(f.radius, 2);
    near(f.first!, 60, 6);
  });
  it('the roots of zero: left out, and the text says all roots of zero are zero', () => {
    const d = draw([z('o', 0, 0), op('r', 'roots', ['o'], 3)]);
    expect(d.complex.find((f) => f.id === 'r')).toEqual({ kind: 'skipped', id: 'r', reason: 'zero' });
  });
  it('an n that is not a whole number from 2 to 12 (power) or 16 (roots) is left out, named', () => {
    for (const [kind, n] of [['power', 1], ['power', 13], ['power', 2.5], ['roots', 1], ['roots', 17], ['roots', 'k']] as const) {
      const d = draw([z('a', 1, 1), op('x', kind, ['a'], n)], { k: NaN });
      expect(d.complex.find((f) => f.id === 'x'), `${kind} ${n}`).toMatchObject({ kind: 'skipped' });
      expect(d.points.some((p) => p.id.startsWith('x'))).toBe(false);
    }
  });
  it('a missing id, the wrong number of numbers, and a cycle leave the op out and named', () => {
    const missing = draw([z('a', 1, 1), op('s', 'add', ['a', 'nope'])]);
    expect(missing.complex.find((f) => f.id === 's')).toEqual({ kind: 'skipped', id: 's', reason: 'missing' });
    expect(draw([z('a', 1, 1), op('s', 'add', ['a'])]).complex.find((f) => f.id === 's')).toMatchObject({ kind: 'skipped', reason: 'missing' });
    const cycle = draw([op('p', 'add', ['q', 'q']), op('q', 'add', ['p', 'p'])]);
    expect(cycle.complex.map((f) => f.kind)).toEqual(['skipped', 'skipped']);
  });
  it('an op can be built on another op listed after it, and on a number a step has hidden', () => {
    const els = [op('sum2', 'add', ['sum', 'a']), op('sum', 'add', ['a', 'b']), z('a', 1, 0), z('b', 0, 1)];
    expect(fact(draw(els), 'sum2', 'add')).toMatchObject({ re: 2, im: 1 });
    const hiddenZ = draw([z('a', 1, 0), z('b', 0, 1), op('s', 'add', ['a', 'b'])], {}, ['a', 'b']);
    expect(hiddenZ.points.map((p) => p.id)).toEqual(['s']);
    expect(hiddenZ.complex.map((f) => f.id)).toEqual(['s']);
    expect(fact(hiddenZ, 's', 'add')).toMatchObject({ re: 1, im: 1 });
  });
  it('a hidden op is not drawn and not listed', () => {
    const d = draw([z('a', 1, 0), z('b', 0, 1), op('s', 'add', ['a', 'b'])], {}, ['s']);
    expect(d.points.some((p) => p.id === 's')).toBe(false);
    expect(d.complex.some((f) => f.id === 's')).toBe(false);
  });
});

describe('hostile numbers never give NaN geometry', () => {
  const finite = (d: Drawables) => {
    for (const p of d.points) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    for (const s of d.shapes) {
      if (s.kind === 'line') for (const e of s.ends) expect(e.every(Number.isFinite)).toBe(true);
      if (s.kind === 'polygon') for (const e of s.points) expect(e.every(Number.isFinite)).toBe(true);
      if (s.kind === 'circle') expect(Number.isFinite(s.r)).toBe(true);
    }
  };
  it('1e300, a division by zero and an unparseable expression leave their numbers out', () => {
    const d = draw([z('big', 1e300, 0), z('div', '1/0', 0), z('bad', 'zr +', 0), z('ok', 1, 1)], { zr: 1 });
    finite(d);
    expect(d.complex.filter((f) => f.kind === 'skipped').map((f) => [f.id, (f as any).reason])).toEqual([['big', 'tooFar'], ['div', 'notFinite'], ['bad', 'notFinite']]);
    expect(d.points.map((p) => p.id)).toEqual(['ok']);
  });
  it('a power that grows past what can be drawn is left out whole (100 to the 12th)', () => {
    const d = draw([z('a', 100, 0), op('w', 'power', ['a'], 12)]);
    finite(d);
    expect(d.complex.find((f) => f.id === 'w')).toEqual({ kind: 'skipped', id: 'w', reason: 'tooFar' });
  });
  it('the same scene at the same values is the same drawables', () => {
    const els = [z('a', 2, 1, { polar: true }), z('b', 1, 2), op('s', 'add', ['a', 'b']), op('p', 'mul', ['a', 'b']), op('w', 'power', ['a'], 5)];
    expect(draw(els)).toEqual(draw(els));
  });
});

const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const fixture = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
const problems = (doc: unknown) => {
  const r = validator.validate(doc);
  return r.ok ? [] : r.problems.map((p) => `${p.code} ${p.pointer}`);
};

describe('the schema of the two elements', () => {
  it('both fixture topics are valid, formula and worked-example checks included', () => {
    for (const name of ['cx-argand-arithmetic', 'cx-roots-powers']) expect(problems(fixture(name)), name).toEqual([]);
  });
  it.each([
    ['an add of one number', (d: any) => (d.scene.elements[2].of = ['z'])],
    ['a conj of two numbers', (d: any) => (d.scene.elements[4].of = ['z', 'w'])],
    ['a conj with an n', (d: any) => (d.scene.elements[4].n = 3)],
    ['an unknown op', (d: any) => (d.scene.elements[2].op = 'divide')],
    ['an unknown field on a complex number', (d: any) => (d.scene.elements[0].colour = 'red')],
    ['a complex number without im', (d: any) => delete d.scene.elements[0].im],
    ['no ids in of', (d: any) => (d.scene.elements[2].of = [])],
    ['three numbers in of', (d: any) => (d.scene.elements[2].of = ['z', 'w', 'z'])],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('cx-argand-arithmetic');
    edit(doc);
    expect(problems(doc).length).toBeGreaterThan(0);
  });
  it.each([
    ['roots without n', (d: any) => delete d.scene.elements[1].n],
    ['power with a literal n of 13', (d: any) => ((d.scene.elements[3].n = 13))],
    ['roots with a literal n of 17', (d: any) => ((d.scene.elements[1].n = 17))],
    ['roots with a literal n of 2.5', (d: any) => ((d.scene.elements[1].n = 2.5))],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('cx-roots-powers');
    edit(doc);
    expect(problems(doc).length).toBeGreaterThan(0);
  });
  it('accepts n as an expression, which is checked when drawn', () => {
    const doc = fixture('cx-roots-powers');
    doc.scene.elements[1].n = 'n + 1';
    expect(problems(doc)).toEqual([]);
  });
});

const html = (topic: Canvas2DTopic, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(Canvas2DViewer, { topic, ...props }) }));

describe('the viewer as server HTML', () => {
  const topic = () => fixture('cx-argand-arithmetic') as Canvas2DTopic;
  it('says each number with its polar form, the sum, the product and the conjugate in words', () => {
    const out = html(topic());
    expect(out).toContain('z = 2 + i; modulus 2.24, argument 26.57 degrees.');
    expect(out).toContain('w = 1 + 2i; modulus 2.24, argument 63.43 degrees.');
    expect(out).toContain('z + w = 3 + 3i: put each number at the tip of the other');
    expect(out).toContain('z × z w'.replace('z × z w', 'z × w'));
    expect(out).toContain('= 5i. Multiplying by w scales by 2.24 and turns by 63.43 degrees, so the modulus is 5 and the argument is 90 degrees.');
    expect(out).toContain('The conjugate of z is 2 − i');
  });
  it('a draggable number has a handle with its keyboard, and the arrow has its head', () => {
    const out = html(topic());
    expect(out).toContain('data-handle="z"');
    expect(out).toContain('data-handle="w"');
    expect(out).toContain('data-kind="arrow"');
  });
  it('a step that hides things takes them out of the text', () => {
    const out = html(topic(), 'en', { step: { index: 0, params: {}, hidden: new Set(['w', 'sum', 'prod', 'zbar']) } });
    expect(out).toContain('z = 2 + i');
    expect(out).not.toContain('z + w =');
    expect(out).not.toContain('Multiplying by');
  });
  it('is in Urdu with Urdu sentences and the diagram left to right', () => {
    const out = html(topic(), 'ur');
    expect(out).toContain('ماڈیولس');
    expect(out).toContain('dir="ltr"');
  });
  it('an element that cannot be drawn is named in the text instead of failing', () => {
    const t = topic();
    (t.scene as any).elements[1].re = '1/0';
    const out = html(t);
    expect(out).toContain('w is left out');
  });
  it('the roots topic lists the roots when there are eight or fewer, and only the circle when there are more', () => {
    const roots = fixture('cx-roots-powers') as Canvas2DTopic;
    const hidden = { step: { index: 0, params: {}, hidden: new Set(['z', 'pow']) } };
    const six = html(roots, 'en', hidden);
    expect(six).toContain('The 6 roots of 1 lie on a circle of radius 1, 60 degrees apart, the first at 0 degrees.');
    expect(six).toContain('They are 1; 0.5 + 0.87i;');
    const many = { ...roots, parameters: roots.parameters.map((p) => (p.id === 'n' ? { ...p, default: 9 } : p)) } as Canvas2DTopic;
    const nine = html(many, 'en', hidden);
    expect(nine).toContain('The 9 roots of 1 lie on a circle of radius 1, 40 degrees apart');
    expect(nine).not.toContain('They are');
  });
});

describe('the pictures', () => {
  it('Canvas2D draws the head of an arrow only when the arrow has one', () => {
    const withHead = renderToStaticMarkup(createElement(Canvas2D, { drawables: draw([z('a', 3, 2)]), axes: true, grid: true, labelText: () => '', readoutText: () => '' }));
    expect(withHead).toContain('data-kind="arrow"');
    expect(withHead).toMatch(/data-kind="arrow"[^]*?<polygon/);
    const far = renderToStaticMarkup(createElement(Canvas2D, { drawables: draw([z('a', 30, 20)]), axes: true, grid: true, labelText: () => '', readoutText: () => '' }));
    expect(far).toContain('data-kind="line"');
  });
  it('static2D draws the complex topics with no NaN', () => {
    for (const name of ['cx-argand-arithmetic', 'cx-roots-powers']) {
      const out = renderToStaticMarkup(static2D({ topic: fixture(name), locale: 'en' })!);
      expect(out).toContain('data-static2d="canvas2d"');
      expect(out).not.toMatch(/NaN|Infinity/);
    }
    expect(renderToStaticMarkup(static2D({ topic: fixture('cx-argand-arithmetic'), locale: 'en' })!)).toContain('data-kind="arrow"');
  });
  it('every new word exists in both languages', () => {
    expect(Object.keys(ur.canvas.complex).sort()).toEqual(Object.keys(en.canvas.complex).sort());
    for (const v of Object.values(ur.canvas.complex)) expect(v.trim().length).toBeGreaterThan(0);
  });
});
