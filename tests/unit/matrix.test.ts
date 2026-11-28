/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path and feed hostile values */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { MatrixViewer, static2D, type MatrixTopic } from '../../src/features/scene';
import { apply2, buildMatrix, det, eigen2, morph, shoelace, type MatrixSceneLike } from '../../src/lib/matrix';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 4.4: a matrix applied to a grid, a flat shape or a cube, as numerics (known values), a drawing model, schema and HTML.

const near = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits);

describe('the arithmetic (known values)', () => {
  it('determinants: stretch 6, shear 1, swap -1, singular 0, identity 1; 3x3 diag(1,2,3) is 6', () => {
    expect(det([[2, 0], [0, 3]])).toBe(6);
    expect(det([[1, 1], [0, 1]])).toBe(1);
    expect(det([[0, 1], [1, 0]])).toBe(-1);
    expect(det([[1, 2], [2, 4]])).toBe(0);
    expect(det([[1, 0], [0, 1]])).toBe(1);
    expect(det([[1, 0, 0], [0, 2, 0], [0, 0, 3]])).toBe(6);
    expect(det([[2, -1, 0], [1, 3, 4], [0, 5, -2]])).toBe(-54);
  });
  it('the area of a polygon: the unit square 1, a triangle 0.5, the F 0.5 (by shoelace); the sign is the direction', () => {
    expect(shoelace([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(1);
    expect(shoelace([[0, 1], [1, 1], [1, 0], [0, 0]])).toBe(-1);
    expect(shoelace([[0, 0], [1, 0], [0.5, 1]])).toBe(0.5);
  });
  it('the area of any shape under M is det M times the original: shoelace of the image', () => {
    const m = [[2, 1], [-1, 3]];
    const shape = [[0, 0], [0.3, 0], [0.3, 0.4], [0.7, 0.4], [0.7, 0.6], [0.3, 0.6], [0.3, 0.8], [0.9, 0.8], [0.9, 1], [0, 1]] as const;
    near(shoelace(shape.map((p) => apply2(m, p))), det(m) * shoelace(shape), 9);
  });
  it('the morph is the identity at 0, the matrix at 1, and its determinant is the area scale at every step', () => {
    const m = [[2, 1], [-1, 3]];
    expect(morph(m, 0)).toEqual([[1, 0], [0, 1]]);
    expect(morph(m, 1)).toEqual(m);
    for (const p of [0.25, 0.5, 0.75]) near(det(morph(m, p)), (1 + p) * (1 + 2 * p) + p * p, 9);
  });
  it('eigen: [[2,1],[1,2]] has 3 along (1,1) and 1 along (1,-1)', () => {
    const e = eigen2([[2, 1], [1, 2]]);
    expect(e.kind).toBe('real');
    if (e.kind !== 'real') return;
    near(e.pairs[0]!.value, 3);
    near(e.pairs[0]!.vector[0], Math.SQRT1_2);
    near(e.pairs[0]!.vector[1], Math.SQRT1_2);
    near(e.pairs[1]!.value, 1);
    near(e.pairs[1]!.vector[0], Math.SQRT1_2);
    near(e.pairs[1]!.vector[1], -Math.SQRT1_2);
  });
  it('eigen: a diagonal matrix has the axes; every vector satisfies A v = lambda v for several matrices', () => {
    const d = eigen2([[3, 0], [0, 1]]);
    expect(d.kind === 'real' && d.pairs.map((p) => [p.value, p.vector[0], p.vector[1]])).toEqual([[3, 1, 0], [1, 0, 1]]);
    for (const m of [[[4, 1], [2, 3]], [[1, 2], [0, 3]], [[0, 1], [1, 0]], [[5, 0], [3, 2]], [[2, -1], [-1, 2]]]) {
      const e = eigen2(m);
      expect(e.kind).toBe('real');
      if (e.kind !== 'real') continue;
      for (const { value, vector } of e.pairs) {
        const av = apply2(m, vector);
        near(av[0], value * vector[0], 9);
        near(av[1], value * vector[1], 9);
      }
    }
  });
  it('eigen: a rotation is complex, a multiple of the identity is every direction, a shear has one line', () => {
    expect(eigen2([[0, -1], [1, 0]])).toEqual({ kind: 'complex' });
    expect(eigen2([[2, 0], [0, 2]])).toEqual({ kind: 'all', value: 2 });
    const s = eigen2([[1, 1], [0, 1]]);
    expect(s.kind === 'real' && s.pairs).toHaveLength(1);
    near((s as any).pairs[0].value, 1);
    expect((s as any).pairs[0].vector).toEqual([1, 0]);
  });
});

const prog = (names: string[] = []) => createProgram(names);
function build(scene: Partial<MatrixSceneLike> & Pick<MatrixSceneLike, 'matrix'>, params: Record<string, number> = {}, hidden: string[] = []) {
  const program = prog(Object.keys(params));
  const full: MatrixSceneLike = { dim: scene.matrix.length as 2 | 3, shape: 'unitSquare', ...scene };
  return buildMatrix({ scene: full, program, scope: program.scope(params), hidden: new Set(hidden) });
}

describe('the drawing model (matrix)', () => {
  it('stretch [[2,0],[0,3]] on the unit square: a 2 by 3 rectangle, determinant 6, area 6', () => {
    const m = build({ matrix: [[2, 0], [0, 3]], showDeterminant: true, showBasis: true });
    expect(m.facts).toMatchObject({ det: 6, flips: false, flat: false, before: 1, after: 6, measure: 'area' });
    expect(m.plane!.result[0]!.points).toEqual([[0, 0], [2, 0], [2, 3], [0, 3]]);
    expect(m.plane!.ghost[0]!.points).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(m.plane!.basis.map((b) => b.to)).toEqual([[2, 0], [0, 3]]);
    expect(m.plane!.area).toEqual(m.plane!.result[0]!.points);
  });
  it('shear keeps the area; a swap flips (negative determinant, the picture runs the other way round)', () => {
    expect(build({ matrix: [[1, 1], [0, 1]] }).facts).toMatchObject({ det: 1, after: 1, flips: false });
    const f = build({ matrix: [[0, 1], [1, 0]], shape: 'triangle' });
    expect(f.facts).toMatchObject({ det: -1, flips: true, before: 0.5, after: 0.5 });
    expect(shoelace(f.plane!.result[0]!.points as any)).toBeLessThan(0);
  });
  it('a singular matrix flattens the shape to a line: determinant 0, flat, every image point on one line', () => {
    const m = build({ matrix: [[1, 2], [2, 4]], shape: 'letterF' });
    expect(m.facts).toMatchObject({ flat: true, after: 0 });
    near(shoelace(m.plane!.result[0]!.points as any), 0, 9);
  });
  it('morph: progress 0 is the original, 1 the matrix, 0.5 between; the area follows det M(p); the ghost never moves', () => {
    const at = (p: number) => build({ matrix: [[2, 0], [0, 3]], progress: p });
    expect(at(0).plane!.result[0]!.points).toEqual(at(0).plane!.ghost[0]!.points);
    expect(at(1).plane!.result[0]!.points[2]).toEqual([2, 3]);
    expect(at(0.5).plane!.result[0]!.points[2]).toEqual([1.5, 2]);
    near(at(0.5).facts!.det, 1.5 * 2);
    expect(at(0.5).plane!.ghost).toEqual(at(1).plane!.ghost);
    expect(build({ matrix: [[2, 0], [0, 3]], progress: 5 }).facts!.progress).toBe(1);
    expect(build({ matrix: [[2, 0], [0, 3]], progress: -2 }).facts!.progress).toBe(0);
  });
  it('entries follow the sliders', () => {
    const m = build({ matrix: [['a', 0], [0, 'a + 1']], showDeterminant: true }, { a: 2 });
    expect(m.facts).toMatchObject({ det: 6 });
  });
  it('the unit grid: lines both ways, the unit cell filled when the determinant is shown', () => {
    const m = build({ matrix: [[1, 1], [0, 1]], shape: 'unitGrid', showDeterminant: true });
    expect(m.plane!.result).toHaveLength(26);
    expect(m.plane!.area).toHaveLength(4);
    expect(build({ matrix: [[1, 1], [0, 1]], shape: 'unitGrid' }).plane!.area).toBeNull();
  });
  it('eigenvector lines only when asked: two for [[2,1],[1,2]], none for a rotation, with the facts', () => {
    const m = build({ matrix: [[2, 1], [1, 2]], showEigen: true });
    expect(m.plane!.eigenLines.map((e) => e.value)).toEqual([3, 1]);
    expect(m.plane!.eigenLines.map((e) => e.text)).toEqual(['λ = 3', 'λ = 1']);
    expect(build({ matrix: [[0, -1], [1, 0]], showEigen: true }).plane!.eigenLines).toEqual([]);
    expect(build({ matrix: [[0, -1], [1, 0]], showEigen: true }).facts!.eigen).toEqual({ kind: 'complex' });
    expect(build({ matrix: [[2, 1], [1, 2]] }).facts!.eigen).toBeNull();
  });
  it('steps hide parts: shape, basis, determinant, eigen, grid', () => {
    const scene = { matrix: [[2, 1], [1, 2]], showBasis: true, showDeterminant: true, showEigen: true };
    const m = build(scene, {}, ['shape', 'basis', 'determinant', 'eigen', 'grid']);
    expect(m.plane!).toMatchObject({ ghost: [], result: [], area: null, basis: [], eigenLines: [], grid: false });
    expect(m.facts).toMatchObject({ showBasis: false, showDet: false, eigen: null });
  });
  it('3D: the cube under diag(1,2,3) is a box of volume 6; 12 ghost edges and 12 result edges; the basis arrows', () => {
    const m = build({ matrix: [[1, 0, 0], [0, 2, 0], [0, 0, 3]], shape: 'unitCube', showDeterminant: true, showBasis: true });
    expect(m.facts).toMatchObject({ det: 6, after: 6, measure: 'volume', dim: 3 });
    const edges = (token: string) => m.space!.segments.filter((s) => s.id === 'shape' && s.token === token);
    expect(edges('edge')).toHaveLength(12);
    expect(edges('curve1')).toHaveLength(12);
    expect(m.space!.patches.filter((p) => p.id === 'shape')).toHaveLength(6);
    expect(m.space!.tags.filter((t) => t.id.startsWith('e')).map((t) => t.text)).toEqual(['e1', 'e2', 'e3']);
    expect(m.space!.segments.some((s) => s.id === 'axes')).toBe(true);
  });
  it('3D: a shear keeps the volume, a reflection flips, a singular matrix flattens', () => {
    expect(build({ matrix: [[1, 1, 0], [0, 1, 0], [0, 0, 1]], shape: 'unitCube' }).facts).toMatchObject({ det: 1, flips: false });
    expect(build({ matrix: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]], shape: 'unitCube' }).facts).toMatchObject({ det: -1, flips: true });
    expect(build({ matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 0]], shape: 'unitCube' }).facts).toMatchObject({ flat: true });
  });
  it('3D unit grid: the three coordinate planes, ghost and image', () => {
    const m = build({ matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], shape: 'unitGrid' });
    expect(m.space!.segments.filter((s) => s.id === 'shape')).toHaveLength(2 * 6 * 5);
  });
  it('an entry that is not a number leaves the scene out and says so', () => {
    const m = build({ matrix: [['q', 0], [0, 1]] }, { q: NaN });
    expect(m).toMatchObject({ facts: null, skipped: 'notFinite', plane: null, space: null });
    expect(build({ matrix: [[1, 0, 0], [0, 1, 0]] as any, dim: 3 })).toMatchObject({ skipped: 'notFinite' });
  });
  it('a huge entry stays finite in everything drawn', () => {
    const m = build({ matrix: [[1e12, 0], [0, 1]], shape: 'letterF', showBasis: true, showDeterminant: true, showEigen: true });
    const all = [...m.plane!.result.flatMap((r) => r.points), ...(m.plane!.area ?? []), ...m.plane!.basis.map((b) => b.to)];
    for (const [x, y] of all) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    const cube = build({ matrix: [[1e12, 0, 0], [0, 1, 0], [0, 0, 1]], shape: 'unitCube', showBasis: true });
    for (const s of cube.space!.segments) expect([...s.a, ...s.b].every(Number.isFinite)).toBe(true);
  });
  it('the same scene at the same values is the same model', () => {
    const scene = { matrix: [[2, 1], [1, 2]], shape: 'letterF' as const, showBasis: true, showEigen: true };
    expect(build(scene)).toEqual(build(scene));
  });
});

const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const fixture = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
const FIXTURES = ['mx-plane-transform', 'mx-determinant-area', 'mx-eigenvectors', 'mx-cube-volume'];
const problems = (doc: unknown) => {
  const r = validator.validate(doc);
  return r.ok ? [] : r.problems.map((p) => `${p.code} ${p.pointer} ${p.message}`);
};

describe('the schema of matrix-transform', () => {
  it('the four fixture topics are valid, formula and worked-example checks included', () => {
    for (const name of FIXTURES) expect(problems(fixture(name)), name).toEqual([]);
  });
  it.each([
    ['unitCube with dim 2', (d: any) => (d.scene.shape = 'unitCube')],
    ['a 3 by 3 matrix with dim 2', (d: any) => d.scene.matrix.push(['a', 'b', 'c'])],
    ['a short row', (d: any) => d.scene.matrix[0].pop()],
    ['a letter F with dim 3', (d: any) => { d.scene.dim = 3; d.scene.matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; d.scene.shape = 'letterF'; }],
    ['eigenvectors in 3D', (d: any) => { d.scene.dim = 3; d.scene.matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; d.scene.shape = 'unitCube'; d.scene.showEigen = true; }],
    ['a camera in 2D', (d: any) => (d.scene.camera = { preset: 'iso' })],
    ['an unknown field', (d: any) => (d.scene.colour = 'red')],
    ['dim 4', (d: any) => (d.scene.dim = 4)],
    ['a shape that does not exist', (d: any) => (d.scene.shape = 'hexagon')],
    ['a non-boolean showBasis', (d: any) => (d.scene.showBasis = 'yes')],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('mx-plane-transform');
    edit(doc);
    expect(problems(doc).length).toBeGreaterThan(0);
  });
  it('accepts a 3D grid, and an expression for progress', () => {
    const doc = fixture('mx-cube-volume');
    doc.scene.shape = 'unitGrid';
    expect(problems(doc)).toEqual([]);
    const flat = fixture('mx-plane-transform');
    flat.scene.progress = 't / 2';
    expect(problems(flat)).toEqual([]);
  });
});

const html = (topic: MatrixTopic, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(MatrixViewer, { topic, ...props }) }));

describe('the viewer as server HTML', () => {
  it('the plane topic says the matrix, where e1 and e2 go, and the determinant', () => {
    const out = html(fixture('mx-plane-transform'));
    expect(out).toContain('The matrix has the rows (1, 1); (0, 1).');
    expect(out).toContain('e1 goes to (1, 0); e2 goes to (1, 1).');
    expect(out).toContain('The determinant is 1, so every area is multiplied by 1.');
    expect(out).toContain('data-matrix-2d');
    expect(out).toContain('data-readout="det"');
  });
  it('the F shape says its area before and after', () => {
    const t = fixture('mx-plane-transform');
    t.parameters[0].default = 2;
    t.parameters[3].default = 3;
    t.parameters[1].default = 0;
    const out = html(t);
    expect(out).toContain('The determinant is 6, so every area is multiplied by 6.');
    expect(out).toContain('The area goes from 0.5 to 3.');
  });
  it('a swap says flipped; a singular matrix says flattened', () => {
    const t = fixture('mx-determinant-area');
    Object.assign(t.parameters[0], { default: 0 });
    Object.assign(t.parameters[1], { default: 1 });
    Object.assign(t.parameters[2], { default: 1 });
    Object.assign(t.parameters[3], { default: 0 });
    expect(html(t)).toContain('The determinant is negative, so the shape is flipped over (mirrored).');
    const s = fixture('mx-determinant-area');
    [1, 2, 1, 2].forEach((v, i) => (s.parameters[i].default = v));
    expect(html(s)).toContain('The determinant is 0: the shape is flattened onto a line, so its area is 0.');
  });
  it('the eigen topic says each eigenvalue and eigenvector; a rotation says there are none', () => {
    const out = html(fixture('mx-eigenvectors'));
    expect(out).toContain('The eigenvalue 3 has the eigenvector (0.71, 0.71)');
    expect(out).toContain('The eigenvalue 1 has the eigenvector (0.71, -0.71)'.replace('-', '−'));
    const t = fixture('mx-eigenvectors');
    [0, -1, 1, 0].forEach((v, i) => (t.parameters[i].default = v));
    expect(html(t)).toContain('There are no real eigenvectors: every direction is turned.');
  });
  it('the cube topic says volume', () => {
    const out = html(fixture('mx-cube-volume'));
    expect(out).toContain('The determinant is 6, so every volume is multiplied by 6.');
    expect(out).toContain('The matrix has the rows (1, 0, 0); (0, 2, 0); (0, 0, 3).');
    expect(out).toContain('data-dim="3"');
  });
  it('progress under 1 is said; a step that hides parts takes them out of the text', () => {
    const half = fixture('mx-plane-transform');
    half.parameters[4].default = 0.5;
    expect(html(half)).toContain('The picture is 50% of the way from the original shape to the matrix.');
    const out = html(fixture('mx-plane-transform'), 'en', { step: { index: 0, params: {}, hidden: new Set(['basis', 'determinant']) } });
    expect(out).not.toContain('e1 goes to');
    expect(out).not.toContain('The determinant is');
  });
  it('an entry that is not a number is named instead of failing', () => {
    const t = fixture('mx-plane-transform');
    t.scene.matrix[0][0] = '1 / 0';
    expect(html(t)).toContain('The picture is left out: a number in the matrix is not defined.');
  });
  it('is in Urdu with Urdu sentences, the diagram left to right', () => {
    const out = html(fixture('mx-plane-transform'), 'ur');
    expect(out).toContain('میٹرکس کی قطاریں');
    expect(out).toContain('dir="ltr"');
  });
});

describe('the pictures', () => {
  it('static2D draws each fixture with no NaN; the flat ones have a ghost and a result, the cube has its edges', () => {
    for (const name of FIXTURES) {
      const out = renderToStaticMarkup(static2D({ topic: fixture(name), locale: 'en' })!);
      expect(out).toContain('data-static2d="matrix-transform"');
      expect(out).not.toMatch(/NaN|Infinity/);
    }
    const flat = renderToStaticMarkup(static2D({ topic: fixture('mx-plane-transform'), locale: 'en' })!);
    expect(flat).toContain('data-ghost="shape"');
    expect(flat).toContain('data-result="shape"');
    expect(flat).toContain('data-basis="e2"');
    expect(renderToStaticMarkup(static2D({ topic: fixture('mx-eigenvectors'), locale: 'en' })!)).toContain('data-eigen="eigen-1"');
    expect(renderToStaticMarkup(static2D({ topic: fixture('mx-cube-volume'), locale: 'en' })!)).toContain('data-seg="shape"');
  });
  it('every new word exists in both languages', () => {
    expect(Object.keys(ur.matrix).sort()).toEqual(Object.keys(en.matrix).sort());
  });
});
