import type { Vec3 } from './kinds';

// Cutting a closed convex solid with a plane (FR-3.10, FR-3.12): the cut polygon for a cross-section and
// the part below the plane for a liquid. Pure. The solids here are convex, so the cut is one convex
// polygon, found by clipping each face and ordering the points where the plane crosses.

export type Poly = readonly Vec3[];

/** The points `x` with `n . x = d`; `n` has length 1. */
export interface Plane {
  readonly n: Vec3;
  readonly d: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** A plane from a normal of any length and the distance `d` along the unit normal; null for a zero or non-finite normal. */
export function planeFrom(normal: Vec3, d: number): Plane | null {
  const len = length(normal);
  if (!Number.isFinite(len) || len < 1e-12 || !Number.isFinite(d)) return null;
  return { n: [normal[0] / len, normal[1] / len, normal[2] / len], d };
}

/** Two unit vectors in the plane with `u x v = n`. */
export function basis(n: Vec3): { u: Vec3; v: Vec3 } {
  const helper: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const c = cross(n, helper);
  const l = length(c);
  const u: Vec3 = [c[0] / l, c[1] / l, c[2] / l];
  return { u, v: cross(n, u) };
}

export interface Clipped {
  /** The parts of the faces on the side `n . x <= d`, cut where they cross. */
  readonly kept: Poly[];
  /** The polygon where the plane meets the solid, counter-clockwise seen from `+n`; null if it does not. */
  readonly cut: Vec3[] | null;
}

/** Collinear or repeated points removed, so a cut through a mesh gives its true corners. */
export function simplify(points: readonly Vec3[], eps: number): Vec3[] {
  let pts = [...points];
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      const ab = sub(b, a);
      const ac = sub(c, a);
      const area = length(cross(ab, ac));
      if (length(ab) < eps || area < eps * Math.max(length(ac), eps)) {
        pts = pts.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

export function clipBelow(polys: readonly Poly[], plane: Plane, scale: number): Clipped {
  const eps = 1e-9 * Math.max(scale, 1);
  const side = (p: Vec3) => dot(plane.n, p) - plane.d;
  const kept: Poly[] = [];
  const onPlane: Vec3[] = [];
  for (const poly of polys) {
    const out: Vec3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const sa = side(a);
      const sb = side(b);
      if (sa <= eps) out.push(a);
      if (Math.abs(sa) <= eps) onPlane.push(a);
      if ((sa < -eps && sb > eps) || (sa > eps && sb < -eps)) {
        const t = sa / (sa - sb);
        const p = add(a, mul(sub(b, a), t));
        out.push(p);
        onPlane.push(p);
      }
    }
    if (out.length >= 3) kept.push(out);
  }
  if (onPlane.length < 3) return { kept, cut: null };

  // Order the points round their centre in the plane.
  const { u, v } = basis(plane.n);
  const centre = onPlane.reduce<Vec3>((s, p) => add(s, p), [0, 0, 0]);
  const c: Vec3 = mul(centre, 1 / onPlane.length);
  const angle = (p: Vec3) => Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u));
  const sorted = [...onPlane].sort((p, q) => angle(p) - angle(q));
  const unique: Vec3[] = [];
  for (const p of sorted) {
    const last = unique[unique.length - 1];
    if (!last || length(sub(p, last)) > eps * 10) unique.push(p);
  }
  if (unique.length > 1 && length(sub(unique[0]!, unique[unique.length - 1]!)) <= eps * 10) unique.pop();
  const cut = simplify(unique, eps * 10);
  return { kept, cut: cut.length >= 3 ? cut : null };
}

/** The volume enclosed by closed, outward-facing polygons (the divergence theorem). */
export function enclosedVolume(polys: readonly Poly[]): number {
  let v = 0;
  for (const poly of polys) {
    const a = poly[0]!;
    for (let i = 1; i + 1 < poly.length; i++) v += dot(a, cross(poly[i]!, poly[i + 1]!)) / 6;
  }
  return Math.abs(v);
}
