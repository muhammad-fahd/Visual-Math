import type { Program, Scope } from '../params';
import type { Vec3 } from '../solid/kinds';
import { buildSpace, toScene, type Dash, type Mark, type Patch, type Seg, type SpaceModel, type SpaceToken, type Tag } from '../space';

// The drawing model of a `matrix-transform@1` scene at one set of parameter values (Story 4.4, FR-3.27): a matrix applied to
// a shape, as plain geometry (the original as a ghost, the transformed one), the images of the basis vectors, the lines of the
// real eigenvectors, and the numbers behind them as `facts`. In 2D the renderer draws a `Plane`; in 3D this module builds a
// `SpaceModel` and the `space3d` renderers draw it, so no new three.js file exists. Pure; every number goes through
// `lib/expr` (the `program`), and a matrix is data: it is never evaluated as code.
//
// The picture shows M(p) = I + p (M - I): p = 0 is the original, p = 1 is the matrix, anything between is the morph. The
// determinant and the sizes are those of M(p), so the area on the screen is always det M(p) times the original area.

type Num = number | string;
export type Shape2 = 'unitSquare' | 'unitGrid' | 'triangle' | 'letterF';
export type Shape = Shape2 | 'unitCube';

export interface MatrixSceneLike {
  dim: 2 | 3;
  matrix: Num[][];
  shape: Shape;
  showBasis?: boolean;
  showDeterminant?: boolean;
  showEigen?: boolean;
  progress?: Num;
  range?: Num;
}

export type Mat = number[][];
export type P2 = readonly [number, number];

export const DEFAULT_RANGE = 4;
const MAX_RANGE = 50;
/** Nothing is drawn farther than this many ranges from the origin, so a huge entry cannot reach the renderer. */
const REACH = 50;
/** The grid is drawn this far each way (in cells), whatever the window. */
const GRID = 6;

// ---- the arithmetic ----

export const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/** The matrix at morph position p: I + p (M - I). */
export const morph = (m: Mat, p: number): Mat => m.map((row, i) => row.map((v, j) => (i === j ? 1 : 0) + p * (v - (i === j ? 1 : 0))));

export function det(m: Mat): number {
  if (m.length === 2) return m[0]![0]! * m[1]![1]! - m[0]![1]! * m[1]![0]!;
  const [a, b, c] = m[0]!;
  const [d, e, f] = m[1]!;
  const [g, h, i] = m[2]!;
  return a! * (e! * i! - f! * h!) - b! * (d! * i! - f! * g!) + c! * (d! * h! - e! * g!);
}

export function apply2(m: Mat, p: P2): [number, number] {
  return [m[0]![0]! * p[0] + m[0]![1]! * p[1], m[1]![0]! * p[0] + m[1]![1]! * p[1]];
}
export function apply3(m: Mat, p: Vec3): Vec3 {
  return [0, 1, 2].map((i) => m[i]![0]! * p[0] + m[i]![1]! * p[1] + m[i]![2]! * p[2]) as unknown as Vec3;
}

/** The area of a polygon by the shoelace formula, signed (negative when it runs clockwise). */
export function shoelace(points: readonly P2[]): number {
  let s = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]!;
    s += p[0] * q[1] - q[0] * p[1];
  });
  return s / 2;
}

export type Eigen =
  | { kind: 'real'; pairs: { value: number; vector: P2 }[] }
  | { kind: 'all'; value: number }
  | { kind: 'complex' };

/** The eigenvalues and eigenvectors of a 2 by 2 matrix, in closed form. Vectors are unit length, the first nonzero part positive. */
export function eigen2(m: Mat): Eigen {
  const [a, b] = m[0]! as [number, number];
  const [c, d] = m[1]! as [number, number];
  const scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  const tol = 1e-9 * scale;
  if (Math.abs(b) <= tol && Math.abs(c) <= tol && Math.abs(a - d) <= tol) return { kind: 'all', value: a };
  const tr = a + d;
  const disc = tr * tr - 4 * (a * d - b * c);
  if (disc < -1e-9 * scale * scale) return { kind: 'complex' };
  const root = Math.sqrt(Math.max(0, disc));
  const values = root <= 1e-9 * scale ? [tr / 2] : [(tr + root) / 2, (tr - root) / 2];
  const vectorFor = (l: number): P2 => {
    let v: [number, number];
    if (Math.abs(c) > tol) v = [l - d, c];
    else if (Math.abs(b) > tol) v = [b, l - a];
    else v = Math.abs(l - a) <= Math.abs(l - d) ? [1, 0] : [0, 1];
    const len = Math.hypot(v[0], v[1]) || 1;
    const u: [number, number] = [v[0] / len, v[1] / len];
    const lead = Math.abs(u[0]) > 1e-12 ? u[0] : u[1];
    return lead < 0 ? [-u[0], -u[1]] : u;
  };
  return { kind: 'real', pairs: values.map((value) => ({ value, vector: vectorFor(value) })) };
}

// ---- the shapes ----

const F_POINTS: readonly P2[] = [[0, 0], [0.3, 0], [0.3, 0.4], [0.7, 0.4], [0.7, 0.6], [0.3, 0.6], [0.3, 0.8], [0.9, 0.8], [0.9, 1], [0, 1]];
const POLYGONS: Record<Exclude<Shape2, 'unitGrid'>, readonly P2[]> = {
  unitSquare: [[0, 0], [1, 0], [1, 1], [0, 1]],
  triangle: [[0, 0], [1, 0], [0.5, 1]],
  letterF: F_POINTS,
};

// ---- the model ----

export interface Poly2 {
  id: string;
  points: P2[];
  closed: boolean;
}

/** What a flat picture draws: the ghost and the result, the basis arrows, the eigen lines, the window. */
export interface Plane {
  range: number;
  grid: boolean;
  ghost: Poly2[];
  result: Poly2[];
  /** The image of the original shape's size cell (the unit square), filled to show the area. */
  area: P2[] | null;
  basis: { id: string; to: P2; text: string }[];
  eigenLines: { id: string; vector: P2; value: number; text: string }[];
}

export interface MatrixFacts {
  dim: 2 | 3;
  /** The matrix as written (at progress 1). */
  matrix: Mat;
  progress: number;
  /** The columns of M(p): where e1, e2 (e3) go. */
  images: number[][];
  det: number;
  flips: boolean;
  flat: boolean;
  /** Area (2D) or volume (3D) of the original shape and of the picture. */
  before: number;
  after: number;
  measure: 'area' | 'volume';
  showBasis: boolean;
  showDet: boolean;
  eigen: Eigen | null;
}

export interface MatrixModel {
  facts: MatrixFacts | null;
  /** Why nothing is drawn: an entry that is not a number. */
  skipped: 'notFinite' | null;
  plane: Plane | null;
  space: SpaceModel | null;
}

export interface BuildInput {
  scene: MatrixSceneLike;
  program: Program;
  scope: Scope;
  /** Parts a step has hidden: `shape`, `basis`, `determinant`, `eigen`, `grid`. */
  hidden?: ReadonlySet<string>;
}

const EMPTY: MatrixModel = { facts: null, skipped: 'notFinite', plane: null, space: null };

export function buildMatrix({ scene, program, scope, hidden }: BuildInput): MatrixModel {
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const shown = (id: string) => !hidden?.has(id);
  const n = scene.dim;
  if (scene.matrix.length !== n || scene.matrix.some((row) => row.length !== n)) return EMPTY;
  const m: Mat = scene.matrix.map((row) => row.map((v) => num(v)));
  if (m.some((row) => row.some((v) => !Number.isFinite(v)))) return EMPTY;
  const rawP = scene.progress === undefined ? 1 : num(scene.progress);
  const p = Number.isFinite(rawP) ? Math.min(1, Math.max(0, rawP)) : 1;
  const rawRange = num(scene.range ?? DEFAULT_RANGE);
  const range = Number.isFinite(rawRange) ? Math.min(MAX_RANGE, Math.max(1, rawRange)) : DEFAULT_RANGE;
  const reach = range * REACH;
  const clamp = (x: number) => Math.min(reach, Math.max(-reach, x));

  const mp = morph(m, p);
  const d = det(mp);
  if (!Number.isFinite(d)) return EMPTY;
  const flat = Math.abs(d) < 1e-9 * Math.max(1, ...mp.flat().map(Math.abs)) ** n;
  const showBasis = scene.showBasis === true && shown('basis');
  const showDet = scene.showDeterminant === true && shown('determinant');
  const images = Array.from({ length: n }, (_, j) => mp.map((row) => row[j]!));

  const factsBase = { dim: n, matrix: m, progress: p, images, det: d, flips: d < 0, flat, showBasis, showDet };

  if (n === 2) {
    const before = scene.shape === 'unitGrid' ? 1 : Math.abs(shoelace(POLYGONS[scene.shape as Exclude<Shape2, 'unitGrid'>] ?? POLYGONS.unitSquare));
    const eigen = scene.showEigen === true && shown('eigen') ? eigen2(mp) : null;
    const facts: MatrixFacts = { ...factsBase, dim: 2, before, after: Math.abs(d) * before, measure: 'area', eigen };
    const at = (q: P2): P2 => {
      const r = apply2(mp, q);
      return [clamp(r[0]), clamp(r[1])];
    };
    const ghost: Poly2[] = [];
    const result: Poly2[] = [];
    let area: P2[] | null = null;
    if (shown('shape')) {
      if (scene.shape === 'unitGrid') {
        const lines: Poly2[] = [];
        for (let i = -GRID; i <= GRID; i++) {
          lines.push({ id: 'shape', points: [[i, -GRID], [i, GRID]], closed: false });
          lines.push({ id: 'shape', points: [[-GRID, i], [GRID, i]], closed: false });
        }
        for (const l of lines) {
          ghost.push(l);
          result.push({ ...l, points: l.points.map(at) });
        }
        const cell = POLYGONS.unitSquare;
        if (showDet) area = cell.map(at);
      } else {
        const poly = POLYGONS[scene.shape as Exclude<Shape2, 'unitGrid'>] ?? POLYGONS.unitSquare;
        ghost.push({ id: 'shape', points: [...poly], closed: true });
        result.push({ id: 'shape', points: poly.map(at), closed: true });
        if (showDet) area = poly.map(at);
      }
    }
    const basis = showBasis
      ? images.map((col, j) => ({ id: `e${j + 1}`, to: [clamp(col[0]!), clamp(col[1]!)] as P2, text: `e${j + 1}` }))
      : [];
    const eigenLines = eigen?.kind === 'real' ? eigen.pairs.map((e, i) => ({ id: `eigen-${i}`, vector: e.vector, value: e.value, text: `λ = ${Math.round(e.value * 1000) / 1000}` })) : [];
    return { facts, skipped: null, plane: { range, grid: shown('grid'), ghost, result, area, basis, eigenLines }, space: null };
  }

  // ---- 3D: a SpaceModel, so the space3d renderers draw it ----
  const facts: MatrixFacts = { ...factsBase, dim: 3, before: 1, after: Math.abs(d), measure: 'volume', eigen: null };
  const base = buildSpace({
    scene: { range, elements: [] },
    program,
    scope,
    hidden: new Set(['box', ...(shown('grid') ? [] : ['grid'])]),
    labelOf: (_label, id) => id,
  });
  const segments: Seg[] = [...base.segments];
  const patches: Patch[] = [...base.patches];
  const marks: Mark[] = [...base.marks];
  const tags: Tag[] = [...base.tags];
  const at3 = (q: Vec3): Vec3 => {
    const r = apply3(mp, q);
    return [clamp(r[0]), clamp(r[1]), clamp(r[2])];
  };
  const seg = (id: string, a: Vec3, b: Vec3, token: SpaceToken, dash: Dash, weight: 1 | 2) => segments.push({ id, a: toScene(a), b: toScene(b), token, dash, weight });
  if (shown('shape')) {
    if (scene.shape === 'unitCube') {
      const corner = (i: number): Vec3 => [i & 1 ? 1 : 0, i & 2 ? 1 : 0, i & 4 ? 1 : 0];
      for (let i = 0; i < 8; i++)
        for (const bit of [1, 2, 4])
          if (!(i & bit)) {
            seg('shape', corner(i), corner(i | bit), 'edge', 'dashed', 1);
            seg('shape', at3(corner(i)), at3(corner(i | bit)), 'curve1', 'solid', 2);
          }
      // The six faces of the result, faint, so the volume reads as a solid.
      const faces: number[][] = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
      faces.forEach((f) => patches.push({ id: 'shape', points: f.map((i) => toScene(at3(corner(i)))), token: showDet ? 'accent' : 'curve1', opacity: 0.14 }));
    } else {
      // The unit grid in 3D: the three coordinate planes, from -2 to 2.
      const G = 2;
      for (let i = -G; i <= G; i++)
        for (const line of [
          [[i, -G, 0], [i, G, 0]], [[-G, i, 0], [G, i, 0]],
          [[i, 0, -G], [i, 0, G]], [[-G, 0, i], [G, 0, i]],
          [[0, i, -G], [0, i, G]], [[0, -G, i], [0, G, i]],
        ] as Vec3[][]) {
          seg('shape', line[0]!, line[1]!, 'grid', 'solid', 1);
          seg('shape', at3(line[0]!), at3(line[1]!), 'curve2', 'solid', 1);
        }
    }
  }
  if (showBasis) {
    images.forEach((col, j) => {
      const tip: Vec3 = [clamp(col[0]!), clamp(col[1]!), clamp(col[2]!)];
      seg(`e${j + 1}`, [0, 0, 0], tip, j === 0 ? 'curve1' : j === 1 ? 'curve2' : 'accent', 'solid', 2);
      marks.push({ id: `e${j + 1}`, at: toScene(tip), token: j === 0 ? 'curve1' : j === 1 ? 'curve2' : 'accent' });
      tags.push({ id: `e${j + 1}`, at: toScene(tip), text: `e${j + 1}` });
    });
  }
  const space: SpaceModel = { range, fit: base.fit, segments, patches, marks, tags, facts: [] };
  return { facts, skipped: null, plane: null, space };
}
