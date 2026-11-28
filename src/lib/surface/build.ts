import { slopeAt } from '../graph/calculus';
import type { Program, Scope } from '../params';
import type { Vec3 } from '../solid/kinds';
import { buildSpace, toScene, type Dash, type Mark, type Patch, type Seg, type SpaceModel, type SpaceToken, type Tag } from '../space';

// The drawing model of a `surface3d@1` scene at one set of parameter values (Story 4.5, FR-3.23): z = f(x, y) sampled on a
// grid as quads and a wire, an optional probe point with z and the two slopes, and the numbers behind them as `facts`. The
// `space3d` renderers draw the `SpaceModel` (three.js in Tier A, SVG in B and C), so no new three.js file exists. Pure; the
// expression goes through `lib/expr` (the `program`) and is data: it is never evaluated as code.
//
// A point where f is not a number is a hole: the quads around it are left out and the holes are counted. A z outside the
// axes box is clamped to the box and counted, so no huge or infinite value reaches the renderer.

type Num = number | string;

export interface SurfaceSceneLike {
  expr: string;
  x?: [Num, Num];
  y?: [Num, Num];
  grid?: number;
  range?: Num;
  probe?: { x: Num; y: Num };
  showWire?: boolean;
}

export const DEFAULT_WINDOW: readonly [number, number] = [-3, 3];
export const DEFAULT_GRID = 20;
export const DEFAULT_RANGE = 6;
const MAX_RANGE = 50;
/** Nothing is drawn farther than this many ranges from the origin. */
const REACH = 50;

export interface Probe {
  x: number;
  y: number;
  z: number;
  /** The slope along x and along y; null where there is no tangent (a hole, a corner, a jump). */
  dzdx: number | null;
  dzdy: number | null;
  /** z is outside the axes box, so the mark is drawn at the box. */
  clamped: boolean;
}

export interface SurfaceFacts {
  /** The window actually used, and whether a bad one was replaced by the default. */
  x: readonly [number, number];
  y: readonly [number, number];
  windowDefaulted: boolean;
  grid: number;
  /** Lowest and highest z over the points that are numbers; null if there is none. */
  zMin: number | null;
  zMax: number | null;
  holes: number;
  clamped: number;
  probe: Probe | null;
  /** The probe was asked for but f has no value there. */
  probeMissing: boolean;
}

export interface SurfaceModel {
  facts: SurfaceFacts;
  space: SpaceModel;
}

export interface BuildInput {
  scene: SurfaceSceneLike;
  program: Program;
  scope: Scope;
  /** Parts a step has hidden: `surface`, `wire`, `probe`, `axes`, `grid`, `box`. */
  hidden?: ReadonlySet<string>;
}

const window2 = (a: number, b: number, reach: number): readonly [number, number] | null => {
  if (!(Number.isFinite(a) && Number.isFinite(b)) || a >= b) return null;
  const lo = Math.max(-reach, a);
  const hi = Math.min(reach, b);
  return lo < hi ? [lo, hi] : null;
};

export function buildSurface({ scene, program, scope, hidden }: BuildInput): SurfaceModel {
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const shown = (id: string) => !hidden?.has(id);
  const rawRange = num(scene.range ?? DEFAULT_RANGE);
  const range = Number.isFinite(rawRange) ? Math.min(MAX_RANGE, Math.max(1, rawRange)) : DEFAULT_RANGE;
  const reach = range * REACH;
  const n = Math.min(32, Math.max(6, Math.round(scene.grid ?? DEFAULT_GRID)));

  const wx = scene.x ? window2(num(scene.x[0]), num(scene.x[1]), reach) : DEFAULT_WINDOW;
  const wy = scene.y ? window2(num(scene.y[0]), num(scene.y[1]), reach) : DEFAULT_WINDOW;
  const windowDefaulted = wx === null || wy === null;
  const xs = wx ?? DEFAULT_WINDOW;
  const ys = wy ?? DEFAULT_WINDOW;

  const f = program.fn2(scene.expr, ['x', 'y'], scope);
  const clampZ = (z: number) => Math.min(range, Math.max(-range, z));

  // ---- the samples ----
  const px = (i: number) => xs[0] + ((xs[1] - xs[0]) * i) / n;
  const py = (j: number) => ys[0] + ((ys[1] - ys[0]) * j) / n;
  const z: number[][] = [];
  let holes = 0;
  let clamped = 0;
  let zMin: number | null = null;
  let zMax: number | null = null;
  for (let i = 0; i <= n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= n; j++) {
      const v = f(px(i), py(j));
      if (!Number.isFinite(v)) {
        holes++;
        row.push(NaN);
        continue;
      }
      zMin = zMin === null ? v : Math.min(zMin, v);
      zMax = zMax === null ? v : Math.max(zMax, v);
      if (Math.abs(v) > range) clamped++;
      row.push(clampZ(v));
    }
    z.push(row);
  }
  const at = (i: number, j: number): Vec3 => [px(i), py(j), z[i]![j]!];

  // ---- the picture ----
  const base = buildSpace({
    scene: { range, elements: [] },
    program,
    scope,
    hidden: new Set([...(shown('axes') ? [] : ['axes']), ...(shown('grid') ? [] : ['grid']), ...(shown('box') ? [] : ['box'])]),
    labelOf: (_label, id) => id,
  });
  const segments: Seg[] = [...base.segments];
  const patches: Patch[] = [...base.patches];
  const marks: Mark[] = [...base.marks];
  const tags: Tag[] = [...base.tags];
  const seg = (id: string, a: Vec3, b: Vec3, token: SpaceToken, dash: Dash, weight: 1 | 2) => segments.push({ id, a: toScene(a), b: toScene(b), token, dash, weight });

  const showSurface = shown('surface');
  if (showSurface) {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        if (corners.some((c) => !Number.isFinite(c[2]))) continue;
        patches.push({ id: 'surface', points: corners.map(toScene), token: 'curve1', opacity: 0.38 });
      }
  }
  if (showSurface && scene.showWire !== false && shown('wire')) {
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) {
        const a = at(i, j);
        if (!Number.isFinite(a[2])) continue;
        if (i < n && Number.isFinite(z[i + 1]![j]!)) seg('wire', a, at(i + 1, j), 'curve2', 'solid', 1);
        if (j < n && Number.isFinite(z[i]![j + 1]!)) seg('wire', a, at(i, j + 1), 'curve2', 'solid', 1);
      }
  }

  // ---- the probe ----
  let probe: Probe | null = null;
  let probeMissing = false;
  if (scene.probe && shown('probe')) {
    const x0 = num(scene.probe.x);
    const y0 = num(scene.probe.y);
    const z0 = Number.isFinite(x0) && Number.isFinite(y0) ? f(x0, y0) : NaN;
    if (Number.isFinite(z0)) {
      const zc = clampZ(z0);
      const cx = Math.min(reach, Math.max(-reach, x0));
      const cy = Math.min(reach, Math.max(-reach, y0));
      probe = {
        x: x0,
        y: y0,
        z: z0,
        dzdx: slopeAt((t) => f(t, y0), x0),
        dzdy: slopeAt((t) => f(x0, t), y0),
        clamped: Math.abs(z0) > range,
      };
      seg('probe', [cx, cy, 0], [cx, cy, zc], 'accent', 'dashed', 1);
      marks.push({ id: 'probe', at: toScene([cx, cy, zc]), token: 'accent' });
      tags.push({ id: 'probe', at: toScene([cx, cy, zc]), text: 'P' });
    } else probeMissing = true;
  }

  const facts: SurfaceFacts = { x: xs, y: ys, windowDefaulted, grid: n, zMin, zMax, holes, clamped, probe, probeMissing };
  const space: SpaceModel = { range, fit: base.fit, segments, patches, marks, tags, facts: [] };
  return { facts, space };
}
