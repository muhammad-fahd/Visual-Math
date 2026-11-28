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
import { buildDrawables, calculus as calc, type CalcFact, type Canvas2DScene, type Drawables, type Element } from '../../src/lib/graph';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 4.3: the calculus elements of the graph scene, as numerics (known values), drawables, schema and HTML.

const f = (src: string) => {
  const program = createProgram([]);
  return program.fn(src, 'x', program.scope({}));
};
const near = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits);

describe('the numerics (known values, NFR-6.2)', () => {
  it('integrals: x^2 from 0 to 3 is 9, sin from 0 to pi is 2, 1/x from 1 to e is 1', () => {
    near(calc.integral(f('x^2'), 0, 3), 9, 10);
    near(calc.integral(f('sin(x)'), 0, Math.PI), 2, 9);
    near(calc.integral(f('1/x'), 1, Math.E), 1, 9);
    near(calc.integral(f('x^3 - 2*x'), -1, 2), 3.75 - 3, 9); // (x^4/4 - x^2) from -1 to 2 = 0 - (-0.75) = 0.75
  });
  it('an integral is 0 over nothing, negative the wrong way round, and NaN where f is not a number', () => {
    expect(calc.integral(f('x'), 2, 2)).toBe(0);
    near(calc.integral(f('x^2'), 3, 0), -9, 10);
    expect(calc.integral(f('1/x'), -1, 1)).toBeNaN(); // a pole in the middle
    expect(calc.integral(f('sqrt(x)'), -1, 1)).toBeNaN();
    expect(calc.integral(f('x'), 0, NaN)).toBeNaN();
  });
  it('derivatives: x^2 at 3 is 6, sin at 0 is 1, ln at 1 is 1; none where f is not defined', () => {
    near(calc.derivativeAt(f('x^2'), 3)!, 6, 6);
    near(calc.derivativeAt(f('sin(x)'), 0)!, 1, 6);
    near(calc.derivativeAt(f('ln(x)'), 1)!, 1, 6);
    expect(calc.derivativeAt(f('sqrt(x)'), -1)).toBeNull();
    expect(calc.derivativeAt(f('x'), NaN)).toBeNull();
  });
  it('a tangent exists where the slope is the same from both sides: not at a corner, a jump or a hole', () => {
    near(calc.slopeAt(f('x^2'), 3)!, 6, 6);
    expect(calc.slopeAt(f('abs(x)'), 0)).toBeNull();
    expect(calc.slopeAt(f('sign(x)'), 0)).toBeNull();
    expect(calc.slopeAt(f('(x^2 - 1)/(x - 1)'), 1)).toBeNull(); // not defined at the point itself
    near(calc.slopeAt(f('abs(x)'), 2)!, 1, 6);
    near(calc.slopeAt(f('sin(x)'), 1)!, Math.cos(1), 6);
  });
  it('the four sums of x^2 on [0, 3] with 3 slices: left 5, right 14, midpoint 8.75, trapezoid 9.5; with 1: 0, 27, 6.75, 13.5', () => {
    const sum = (n: number, m: calc.Method) => calc.sumOf(calc.slices(f('x^2'), 0, 3, n, m));
    expect([sum(3, 'left'), sum(3, 'right'), sum(3, 'mid'), sum(3, 'trapezoid')]).toEqual([5, 14, 8.75, 9.5]);
    expect([sum(1, 'left'), sum(1, 'right'), sum(1, 'mid'), sum(1, 'trapezoid')]).toEqual([0, 27, 6.75, 13.5]);
  });
  it('more slices close in on the integral, and the midpoint beats the left sum for the same n', () => {
    const sum = (n: number, m: calc.Method) => calc.sumOf(calc.slices(f('x^2'), 0, 3, n, m));
    for (const m of ['left', 'right', 'mid', 'trapezoid'] as const) expect(Math.abs(sum(100, m) - 9)).toBeLessThan(Math.abs(sum(5, m) - 9));
    expect(Math.abs(sum(10, 'mid') - 9)).toBeLessThan(Math.abs(sum(10, 'left') - 9));
    near(sum(200, 'mid'), 9, 3);
  });
  it('slices of a bad n, a bad interval or a function that is not a number somewhere are an empty list', () => {
    for (const n of [0, -1, 2.5, NaN]) expect(calc.slices(f('x'), 0, 1, n, 'left')).toEqual([]);
    expect(calc.slices(f('x'), NaN, 1, 3, 'left')).toEqual([]);
    expect(calc.slices(f('1/x'), 0, 1, 4, 'left')).toEqual([]); // f(0) is not a number
    expect(calc.slices(f('1/x'), 0, 1, 4, 'right')).toHaveLength(4); // the right heights are fine
  });
  it('limits: sin(x)/x at 0 is 1 with a hole; abs(x)/x has two sides that differ; (x^2-1)/(x-1) at 1 is 2; x^2 at 2 is 4', () => {
    const a = calc.limitOf(f('sin(x)/x'), 0, 0.1)!;
    near(a.left, 0.9983341664, 8);
    near(a.right, a.left, 12);
    near(a.limit!, 1, 5);
    expect(a.atPoint).toBeNull();
    const b = calc.limitOf(f('abs(x)/x'), 0, 0.1)!;
    expect([b.left, b.right, b.limit]).toEqual([-1, 1, null]);
    const c = calc.limitOf(f('(x^2 - 1)/(x - 1)'), 1, 0.5)!;
    near(c.limit!, 2, 2);
    expect(c.atPoint).toBeNull();
    const d = calc.limitOf(f('x^2'), 2, 0.5)!;
    near(d.limit!, 4, 2);
    expect(d.atPoint).toBe(4);
  });
  it('a limit with a side where f is not defined, or a bad distance, is null', () => {
    expect(calc.limitOf(f('sqrt(x)'), 0, 0.1)).toBeNull();
    expect(calc.limitOf(f('x'), 0, 0)).toBeNull();
    expect(calc.limitOf(f('x'), 0, -1)).toBeNull();
    expect(calc.limitOf(f('x'), NaN, 1)).toBeNull();
  });
});

const VIEW = { scale: 1, panX: 0, panY: 0 };
function draw(elements: Element[], params: Record<string, number> = {}, hidden: string[] = [], traceX: number | null = null): Drawables {
  const scene: Canvas2DScene = { viewport: { xMin: -4.5, xMax: 4.5, yMin: -3, yMax: 10 }, aspect: 'free', elements };
  const program = createProgram(Object.keys(params));
  return buildDrawables({ scene, program, scope: program.scope(params), view: VIEW, hidden: new Set(hidden), traceX });
}
const el = (type: string, fields: Record<string, unknown>) => ({ id: 'e', type, ...fields }) as Element;
const fact = <K extends CalcFact['kind']>(d: Drawables, kind: K) => d.calculus.find((x) => x.kind === kind) as Extract<CalcFact, { kind: K }>;

describe('tangent (matrix)', () => {
  it('x^2 at 3: slope 6 through (3, 9), a marker on the curve and a line of that slope', () => {
    const d = draw([el('tangent', { fn: 'x^2', at: 3 })]);
    expect(fact(d, 'tangent')).toMatchObject({ at: 3, y: 9 });
    near(fact(d, 'tangent').slope!, 6, 6);
    const line = d.shapes.find((s) => s.kind === 'line') as any;
    expect(line.arrow ?? false).toBe(false);
    const [[x0, y0], [x1, y1]] = line.ends;
    near((y1 - y0) / (x1 - x0), 6, 4);
    near(y0 - 9, 6 * (x0 - 3), 4); // the line passes through (3, 9)
    expect(d.points[0]).toMatchObject({ x: 3, y: 9, drag: null });
  });
  it('the marker is draggable along x only when `at` is exactly the parameter, and then y follows the curve', () => {
    const d = draw([el('tangent', { fn: 'x^2', at: 'a', drag: { x: 'a' }, snap: { step: 0.5 } })], { a: 2 });
    expect(d.points[0]).toMatchObject({ x: 2, y: 4, drag: { x: 'a', y: null }, snap: 0.5 });
    expect(draw([el('tangent', { fn: 'x^2', at: 'a + 0', drag: { x: 'a' } })], { a: 2 }).points[0]!.drag).toBeNull();
  });
  it('the length is the half-length along x; the default is a fraction of the window', () => {
    const short = draw([el('tangent', { fn: 'x', at: 0, length: 1 })]);
    const ends = (short.shapes[0] as any).ends;
    expect(ends[0][0]).toBe(-1);
    expect(ends[1][0]).toBe(1);
  });
  it('at a corner there is a marker and the text fact, and no line', () => {
    const d = draw([el('tangent', { fn: 'abs(x)', at: 0 })]);
    expect(fact(d, 'tangent')).toMatchObject({ at: 0, y: 0, slope: null });
    expect(d.shapes).toEqual([]);
    expect(d.points).toHaveLength(1);
  });
  it('where the curve is not defined the element is left out and named', () => {
    const d = draw([el('tangent', { fn: 'sqrt(x)', at: -1 })]);
    expect(d.calculus).toEqual([{ kind: 'skipped', id: 'e', reason: 'notFinite' }]);
    expect(d.points).toEqual([]);
  });
});

describe('the derivative graph and the link (matrix)', () => {
  it('x^2: a curve of 2x, with a marker at (3, 6) joined by a dotted guide to the point (3, 9) of the curve', () => {
    const d = draw([el('derivative', { fn: 'x^2', at: 3 })]);
    const curve = d.curves[0]!;
    const near2 = curve.segments.flat().find(([x]) => Math.abs(x - 2) < 0.05)!;
    near(near2[1], 2 * near2[0], 3);
    expect(d.points[0]).toMatchObject({ x: 3, y: expect.closeTo(6, 5) });
    const link = d.shapes.find((s) => s.id === 'e-link') as any;
    expect(link.ends[0]).toEqual([3, 9]);
    near(link.ends[1][1], 6, 5);
    expect(link.style.dash).toBe('dotted');
    near(fact(d, 'derivative').value!, 6, 5);
  });
  it('without `at` there is only the graph and no fact', () => {
    const d = draw([el('derivative', { fn: 'x^2' })]);
    expect(d.curves).toHaveLength(1);
    expect(d.calculus).toEqual([]);
    expect(d.points).toEqual([]);
  });
  it('the tangent’s slope and the derivative graph’s height at the same x are the same number, wherever the point is', () => {
    for (const a of [-3, -1.5, 0, 0.5, 2, 4]) {
      const d = draw([el('tangent', { fn: 'x^3 - x', at: a }), { id: 'g', type: 'derivative', fn: 'x^3 - x', at: a } as Element]);
      near(fact(d, 'tangent').slope!, fact(d, 'derivative').value!, 6);
    }
  });
  it('the derivative graph reads the trace like any function', () => {
    const d = draw([el('derivative', { fn: 'x^2' })], {}, [], 2);
    near(d.curves[0]!.traceY!, 4, 5);
  });
  it('where f has a corner the derivative graph has a value on each side and the marker at the corner is left out', () => {
    const d = draw([el('derivative', { fn: 'abs(x)', at: 2 })]);
    near(fact(d, 'derivative').value!, 1, 5);
  });
});

describe('secant (matrix)', () => {
  it('x^2 from 1 to 3: slope 4, two markers, a line through both', () => {
    const d = draw([el('secant', { fn: 'x^2', x1: 1, x2: 3 })]);
    expect(fact(d, 'secant')).toMatchObject({ x1: 1, x2: 3, y1: 1, y2: 9, slope: 4 });
    expect(d.points.map((p) => [p.x, p.y])).toEqual([[1, 1], [3, 9]]);
    expect(d.shapes).toHaveLength(1);
  });
  it('as the gap shrinks the slope goes to the derivative: (a + h)^2 - a^2 over h is 2a + h', () => {
    for (const h of [2, 1, 0.1, 0.001]) near(fact(draw([el('secant', { fn: 'x^2', x1: 1, x2: 1 + h })]), 'secant').slope!, 2 + h, 6);
  });
  it('the same point twice has no slope and no line', () => {
    const d = draw([el('secant', { fn: 'x^2', x1: 2, x2: 2 })]);
    expect(fact(d, 'secant').slope).toBeNull();
    expect(d.shapes).toEqual([]);
  });
  it('a point where the curve is not defined leaves the secant out', () => {
    expect(draw([el('secant', { fn: 'ln(x)', x1: -1, x2: 1 })]).calculus).toEqual([{ kind: 'skipped', id: 'e', reason: 'notFinite' }]);
  });
});

describe('limit probe (matrix)', () => {
  it('sin(x)/x at 0: marks on both sides at the same height, an open circle at (0, 1), and the hole in the text', () => {
    const d = draw([el('limitProbe', { fn: 'sin(x)/x', approach: 0, h: 0.1 })]);
    const f1 = fact(d, 'limit');
    near(f1.limit!, 1, 5);
    expect(f1.atPoint).toBeNull();
    const open = d.points.find((p) => p.style.marker === 'open')!;
    expect(open.x).toBe(0);
    near(open.y, 1, 5);
    expect(d.points.filter((p) => p.style.marker === 'triangle').map((p) => p.x)).toEqual([-0.1, 0.1]);
  });
  it('sides that differ have no open circle', () => {
    const d = draw([el('limitProbe', { fn: 'abs(x)/x', approach: 0, h: 0.5 })]);
    expect(fact(d, 'limit')).toMatchObject({ left: -1, right: 1, limit: null });
    expect(d.points.some((p) => p.style.marker === 'open')).toBe(false);
  });
  it('a hole at 1 in (x^2 - 1)/(x - 1) has its limit 2, and a point of the curve has its own value', () => {
    near(fact(draw([el('limitProbe', { fn: '(x^2 - 1)/(x - 1)', approach: 1, h: 0.5 })]), 'limit').limit!, 2, 2);
    expect(fact(draw([el('limitProbe', { fn: 'x^2', approach: 2, h: 0.5 })]), 'limit').atPoint).toBe(4);
  });
  it('h follows a parameter; a side where f is not defined, or h <= 0, leaves the probe out', () => {
    expect(fact(draw([el('limitProbe', { fn: 'sin(x)/x', approach: 0, h: 'h' })], { h: 0.5 }), 'limit').h).toBe(0.5);
    expect(draw([el('limitProbe', { fn: 'sqrt(x)', approach: 0, h: 0.1 })]).calculus[0]).toMatchObject({ kind: 'skipped' });
    expect(draw([el('limitProbe', { fn: 'x', approach: 0, h: 0 })]).calculus[0]).toMatchObject({ kind: 'skipped' });
  });
});

describe('Riemann sums and the area (matrix)', () => {
  const sums = (method: calc.Method, n: number) => fact(draw([el('riemann', { fn: 'x^2', from: 0, to: 3, n, method })]), 'riemann');
  it('x^2 on [0, 3] with 3 slices: left 5, right 14, midpoint 8.75, trapezoid 9.5, and the exact area 9 beside each', () => {
    expect([sums('left', 3).sum, sums('right', 3).sum, sums('mid', 3).sum, sums('trapezoid', 3).sum]).toEqual([5, 14, 8.75, 9.5]);
    for (const m of ['left', 'right', 'mid', 'trapezoid'] as const) near(sums(m, 3).exact!, 9, 9);
  });
  it('n slices are n polygons: rectangles with a flat top, trapezoids with a slanted one', () => {
    const rect = draw([el('riemann', { fn: 'x^2', from: 0, to: 3, n: 4, method: 'left' })]);
    expect(rect.shapes).toHaveLength(4);
    for (const s of rect.shapes as any[]) expect(s.points[1][1]).toBe(s.points[2][1]);
    const trap = draw([el('riemann', { fn: 'x^2', from: 0, to: 3, n: 4, method: 'trapezoid' })]);
    expect((trap.shapes[1] as any).points[1][1]).not.toBe((trap.shapes[1] as any).points[2][1]);
  });
  it('n from an expression follows the slider', () => {
    expect(fact(draw([el('riemann', { fn: 'x^2', from: 0, to: 3, n: 'n', method: 'mid' })], { n: 6 }), 'riemann').n).toBe(6);
    expect(draw([el('riemann', { fn: 'x^2', from: 0, to: 3, n: 'n', method: 'mid' })], { n: 40 }).shapes).toHaveLength(40);
  });
  it('a bad n (0, 201, 2.5, not a number) is left out and named; so is an interval that is backwards or a function that is not a number', () => {
    for (const n of [0, 201, 2.5, 'k']) expect(draw([el('riemann', { fn: 'x^2', from: 0, to: 3, n, method: 'left' })], { k: NaN }).calculus[0], String(n)).toEqual({ kind: 'skipped', id: 'e', reason: 'badN' });
    expect(draw([el('riemann', { fn: 'x^2', from: 3, to: 0, n: 3, method: 'left' })]).calculus[0]).toMatchObject({ reason: 'notFinite' });
    expect(draw([el('riemann', { fn: '1/x', from: 0, to: 1, n: 3, method: 'left' })]).calculus[0]).toMatchObject({ reason: 'notFinite' });
  });
  it('a sum below the axis counts negative', () => {
    near(fact(draw([el('riemann', { fn: '-x', from: 0, to: 2, n: 2, method: 'left' })]), 'riemann').sum, -1, 9);
  });
  it('the area of a region, when asked: x^2 from 0 to 3 is 9, sin from 0 to pi is 2; not asked: no measure', () => {
    const area = (between: [string, string], to: number | string, measure = true) => draw([el('region', { between, from: 0, to, measure })]).measures.find((m) => m.kind === 'area');
    near(area(['x^2', '0'], 3)!.value, 9, 10);
    near(area(['sin(x)', '0'], Math.PI)!.value, 2, 9);
    near(area(['x', 'x^2'], 1)!.value, 1 / 6, 9);
    expect(area(['x^2', '0'], 3, false)).toBeUndefined();
    expect(area(['1/x', '0'], 1)!.value).toBeNaN(); // not defined at 0
  });
});

describe('hostile numbers never give NaN geometry', () => {
  it('every kind of calculus element at a point where nothing is defined draws nothing wrong', () => {
    const d = draw([
      el('tangent', { fn: 'ln(x)', at: -3 }),
      { id: 'd', type: 'derivative', fn: 'ln(x)', at: -3 } as Element,
      { id: 's', type: 'secant', fn: 'ln(x)', x1: -3, x2: -2 } as Element,
      { id: 'l', type: 'limitProbe', fn: 'ln(x)', approach: -3, h: 0.1 } as Element,
      { id: 'r', type: 'riemann', fn: 'ln(x)', from: -3, to: -1, n: 4, method: 'mid' } as Element,
      { id: 'a', type: 'region', between: ['ln(x)', '0'], from: -3, to: -1, measure: true } as Element,
    ]);
    for (const p of d.points) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    for (const s of d.shapes) {
      if (s.kind === 'line') for (const e of s.ends) expect(e.every(Number.isFinite)).toBe(true);
      if (s.kind === 'polygon') for (const e of s.points) expect(e.every(Number.isFinite)).toBe(true);
    }
    expect(d.calculus.filter((x) => x.kind === 'skipped')).toHaveLength(4);
  });
  it('a huge value or a near-vertical slope stays finite', () => {
    const d = draw([el('tangent', { fn: 'x^20', at: 4 })]);
    for (const s of d.shapes as any[]) for (const e of s.ends) expect(e.every(Number.isFinite)).toBe(true);
  });
  it('the same scene at the same values is the same drawables', () => {
    const els = [el('tangent', { fn: 'x^2', at: 1 }), { id: 'r', type: 'riemann', fn: 'x^2', from: 0, to: 3, n: 5, method: 'trapezoid' } as Element];
    expect(draw(els)).toEqual(draw(els));
  });
});

const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const fixture = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
const problems = (doc: unknown) => {
  const r = validator.validate(doc);
  return r.ok ? [] : r.problems.map((p) => `${p.code} ${p.pointer}`);
};

describe('the schema of the calculus elements', () => {
  it('the three fixture topics are valid, formula and worked-example checks included', () => {
    for (const name of ['calc-tangent-derivative', 'calc-limit-zoom', 'calc-riemann-sums']) expect(problems(fixture(name)), name).toEqual([]);
  });
  it.each([
    ['a tangent without at', (d: any) => delete d.scene.elements[2].at],
    ['a tangent dragged in y', (d: any) => (d.scene.elements[2].drag = { x: 'a', y: 'a' })],
    ['a secant without x2', (d: any) => delete d.scene.elements[3].x2],
    ['an unknown field on a derivative', (d: any) => (d.scene.elements[1].colour = 'red')],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('calc-tangent-derivative');
    edit(doc);
    expect(problems(doc).length).toBeGreaterThan(0);
  });
  it.each([
    ['a method that does not exist', (d: any) => (d.scene.elements[2].method = 'upper')],
    ['a literal n of 0', (d: any) => (d.scene.elements[2].n = 0)],
    ['a literal n of 201', (d: any) => (d.scene.elements[2].n = 201)],
    ['a literal n of 2.5', (d: any) => (d.scene.elements[2].n = 2.5)],
    ['a region measure that is not a boolean', (d: any) => (d.scene.elements[0].measure = 'yes')],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('calc-riemann-sums');
    edit(doc);
    expect(problems(doc).length).toBeGreaterThan(0);
  });
  it('accepts n as an expression, checked when drawn', () => {
    const doc = fixture('calc-riemann-sums');
    doc.scene.elements[2].n = 'n + 1';
    expect(problems(doc)).toEqual([]);
  });
});

const html = (topic: Canvas2DTopic, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(Canvas2DViewer, { topic, ...props }) }));

describe('the viewer as server HTML', () => {
  it('the tangent topic says the slope of the tangent, the height of the derivative graph, and the secant', () => {
    const out = html(fixture('calc-tangent-derivative'));
    expect(out).toContain('tangent: at x = 1 the curve is at y = 1 and the slope of the tangent is 2.');
    expect(out).toContain('the derivative graph is 2 high, which is the slope of the tangent there.');
    expect(out).toContain('secant: from x = 1 to x = 3 the curve goes from 1 to 9, so the slope of the secant is 4.');
    expect(out).toContain('data-handle="tan"');
    expect(out).toContain('aria-valuetext');
  });
  it('the slope of the tangent and the height of the derivative graph are the same number in the words, wherever the point is', () => {
    const t = fixture('calc-tangent-derivative');
    t.parameters[0].default = -2.5;
    const out = html(t);
    expect(out).toContain('the slope of the tangent is −5.');
    expect(out).toContain('the derivative graph is −5 high');
  });
  it('the limit topic says both sides, the limit, and the hole', () => {
    const out = html(fixture('calc-limit-zoom'));
    expect(out).toContain('limit: at x = 0, a distance 1 either side, the curve is at 0.84 on the left and 0.84 on the right; it is heading for 1. The function is not defined there: an open circle marks the hole.');
  });
  it('the Riemann topic gives each sum beside the exact area, and the area of the region', () => {
    const out = html(fixture('calc-riemann-sums'));
    expect(out).toContain('left: with 3 left rectangles the sum is 5; the exact area is 9, a difference of 4.');
    expect(out).toContain('right: with 3 right rectangles the sum is 14; the exact area is 9, a difference of 5.');
    expect(out).toContain('midpoint: with 3 midpoint rectangles the sum is 8.75; the exact area is 9, a difference of 0.25.');
    expect(out).toContain('trapezoid: with 3 trapezoids the sum is 9.5; the exact area is 9, a difference of 0.5.');
    expect(out).toContain('area 9');
    expect(out).toContain('data-readout="rl"');
  });
  it('a step that hides things takes them out of the text', () => {
    const out = html(fixture('calc-riemann-sums'), 'en', { step: { index: 0, params: {}, hidden: new Set(['right', 'mid', 'trap']) } });
    expect(out).toContain('left: with 3 left rectangles');
    expect(out).not.toContain('right: with');
    expect(out).not.toContain('trapezoid: with');
  });
  it('an element that cannot be drawn is named in the text instead of failing', () => {
    const t = fixture('calc-riemann-sums');
    t.scene.elements[2].n = 0;
    expect(html(t)).toContain('left is left out: the number of slices must be a whole number from 1 to 200.');
  });
  it('is in Urdu with Urdu sentences, the diagram left to right', () => {
    const out = html(fixture('calc-tangent-derivative'), 'ur');
    expect(out).toContain('مماس کی ڈھلوان');
    expect(out).toContain('dir="ltr"');
  });
});

describe('the pictures', () => {
  it('static2D draws each calculus fixture with no NaN, the open circle of the limit, and the slices of the sum', () => {
    for (const name of ['calc-tangent-derivative', 'calc-limit-zoom', 'calc-riemann-sums']) {
      const out = renderToStaticMarkup(static2D({ topic: fixture(name), locale: 'en' })!);
      expect(out).toContain('data-static2d="canvas2d"');
      expect(out).not.toMatch(/NaN|Infinity/);
    }
    expect(renderToStaticMarkup(static2D({ topic: fixture('calc-limit-zoom'), locale: 'en' })!)).toContain('data-element="probe-limit"');
    expect((renderToStaticMarkup(static2D({ topic: fixture('calc-riemann-sums'), locale: 'en' })!).match(/data-element="left"/g) ?? []).length).toBe(3);
  });
  it('every new word exists in both languages', () => {
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(ur.canvas.calc).sort()).toEqual(keys(en.canvas.calc).sort());
  });
});

describe('review fixes: steep curves, extrapolated limits', () => {
  it('a steep smooth curve has a tangent; a corner and a jump still have none', () => {
    expect(calc.slopeAt((x) => 1000 * x, 0)).toBeCloseTo(1000, 3);
    expect(calc.slopeAt((x) => 1e-3 * x, 0)).toBeCloseTo(1e-3, 6);
    expect(calc.slopeAt((x) => Math.abs(x), 0)).toBeNull();
    expect(calc.slopeAt((x) => Math.sign(x), 0)).toBeNull();
    expect(calc.slopeAt((x) => Math.cbrt(x), 0)).toBeNull();
  });
  it('a limit of a sloped line is found for a large h; a jump and a pole have none', () => {
    expect(calc.limitOf((x) => x, 0, 2)!.limit).toBeCloseTo(0, 6);
    expect(calc.limitOf((x) => 100 * x, 0, 1)!.limit).toBeCloseTo(0, 4);
    expect(calc.limitOf((x) => Math.sign(x), 0, 1)!.limit).toBeNull();
    expect(calc.limitOf((x) => 1 / (x * x), 0, 1)!.limit).toBeNull();
    expect(calc.limitOf((x) => (x * x - 1) / (x - 1), 1, 0.5)!.limit).toBeCloseTo(2, 4);
  });
});
