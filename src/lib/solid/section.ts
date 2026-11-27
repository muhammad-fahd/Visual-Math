import { basis, clipBelow, dot, planeFrom, type Plane, type Poly } from './clip';
import type { Geometry, Kind, Vec3 } from './kinds';

// The cross-section of a solid (FR-3.10): the flat shape a plane cuts out of it, named in words and
// measured in numbers. Offsets are measured from the centre of the solid. Pure.

export interface SectionSpec {
  /** Anything but 0 (or not a number) means shown. */
  readonly enabled: number;
  readonly plane?: { readonly axis: 'x' | 'y' | 'z'; readonly offset: number };
  readonly normal?: Vec3;
  readonly d?: number;
}

export type ShapeName = 'circle' | 'ellipse' | 'rectangle' | 'square' | 'triangle' | 'polygon' | 'curved';

export interface Measure {
  readonly id: 'radius' | 'semiMajor' | 'semiMinor' | 'width' | 'height' | 'side' | 'base' | 'sides' | 'area' | 'perimeter';
  readonly value: number;
}

export interface Section {
  readonly plane: Plane;
  /** Where the plane meets the solid, in 3D. */
  readonly polygon3: readonly Vec3[];
  /** The same points flat, in the plane's own axes, centred on their middle. */
  readonly polygon2: readonly (readonly [number, number])[];
  readonly shape: ShapeName;
  /** Corners of a polygon (for the word "5-sided shape"). */
  readonly corners: number;
  readonly measures: readonly Measure[];
}

const CURVED: ReadonlySet<Kind> = new Set(['cylinder', 'cone', 'sphere', 'hemisphere', 'frustum']);

/** The plane a `section` field describes, or null when it is off or cannot be a plane. */
export function sectionPlane(spec: SectionSpec | undefined): Plane | null {
  if (!spec || !Number.isFinite(spec.enabled) || spec.enabled === 0) return null;
  if (spec.plane) {
    const { axis, offset } = spec.plane;
    const normal: Vec3 = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    return planeFrom(normal, offset);
  }
  if (spec.normal) return planeFrom(spec.normal, spec.d ?? 0);
  return null;
}

const polys = (g: Geometry): Poly[] => g.faces.map((f) => f.map((i) => g.vertices[i]!));

/** The cut of `g` by `plane`, or null when the plane does not touch the solid. */
export function crossSection(g: Geometry, kind: Kind, plane: Plane): Section | null {
  const { cut } = clipBelow(polys(g), plane, g.radius);
  if (!cut) return null;
  const { u, v } = basis(plane.n);
  const c3 = cut.reduce<Vec3>((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
  const centre: Vec3 = [c3[0] / cut.length, c3[1] / cut.length, c3[2] / cut.length];
  const flat = cut.map((p) => [dot([p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]], u), dot([p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]], v)] as const);
  const { shape, measures } = describe(flat, CURVED.has(kind));
  return { plane, polygon3: cut, polygon2: flat, shape, corners: flat.length, measures };
}

type P2 = readonly [number, number];

const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function polygonArea(p: readonly P2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]!;
    a += p[i]![0] * q[1] - q[0] * p[i]![1];
  }
  return Math.abs(a) / 2;
}

function describe(p: readonly P2[], curved: boolean): { shape: ShapeName; measures: Measure[] } {
  const n = p.length;
  const centre: P2 = [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n];
  const radii = p.map((q) => dist(q, centre));
  const rMax = Math.max(...radii);
  const rMin = Math.min(...radii);
  const perimeter = p.reduce((s, q, i) => s + dist(q, p[(i + 1) % n]!), 0);
  const area = polygonArea(p);
  const scale = Math.max(rMax, 1e-9);

  if (curved && n >= 12) {
    if (rMax - rMin <= 0.02 * scale) {
      const r = radii.reduce((s, x) => s + x, 0) / n;
      return { shape: 'circle', measures: [{ id: 'radius', value: r }, { id: 'area', value: Math.PI * r * r }, { id: 'perimeter', value: 2 * Math.PI * r }] };
    }
    // An ellipse is symmetric about its centre: every point has a partner opposite it.
    const symmetric = p.every((q) => p.some((o) => dist([2 * centre[0] - q[0], 2 * centre[1] - q[1]], o) <= 0.04 * scale));
    if (symmetric) {
      return { shape: 'ellipse', measures: [{ id: 'semiMajor', value: rMax }, { id: 'semiMinor', value: rMin }, { id: 'area', value: Math.PI * rMax * rMin }] };
    }
    return { shape: 'curved', measures: [{ id: 'area', value: area }, { id: 'perimeter', value: perimeter }] };
  }

  if (n === 3) {
    const sides = [dist(p[0]!, p[1]!), dist(p[1]!, p[2]!), dist(p[2]!, p[0]!)];
    // An isosceles triangle (a cone cut through its axis) stands on its odd side; otherwise the longest side is the base.
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.01 * Math.max(a, b);
    const odd = near(sides[0]!, sides[1]!) ? sides[2]! : near(sides[1]!, sides[2]!) ? sides[0]! : near(sides[2]!, sides[0]!) ? sides[1]! : Math.max(...sides);
    const base = odd;
    return { shape: 'triangle', measures: [{ id: 'base', value: base }, { id: 'height', value: (2 * area) / Math.max(base, 1e-12) }, { id: 'area', value: area }] };
  }
  if (n === 4) {
    const e = [0, 1, 2, 3].map((i) => [p[(i + 1) % 4]![0] - p[i]![0], p[(i + 1) % 4]![1] - p[i]![1]] as const);
    const rightAngles = [0, 1, 2, 3].every((i) => {
      const a = e[i]!;
      const b = e[(i + 1) % 4]!;
      return Math.abs(a[0] * b[0] + a[1] * b[1]) <= 0.02 * Math.hypot(...a) * Math.hypot(...b);
    });
    if (rightAngles) {
      const w = Math.hypot(...e[0]!);
      const h = Math.hypot(...e[1]!);
      if (Math.abs(w - h) <= 0.005 * Math.max(w, h)) return { shape: 'square', measures: [{ id: 'side', value: (w + h) / 2 }, { id: 'area', value: area }] };
      return { shape: 'rectangle', measures: [{ id: 'width', value: Math.max(w, h) }, { id: 'height', value: Math.min(w, h) }, { id: 'area', value: w * h }] };
    }
  }
  return { shape: 'polygon', measures: [{ id: 'sides', value: n }, { id: 'area', value: area }, { id: 'perimeter', value: perimeter }] };
}
