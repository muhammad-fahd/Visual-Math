import type { Pt } from './sample';
import type { Viewport } from './viewport';

// The measures and transformations of 2D geometry (FR-3.18, Story 3.2): pure functions of numbers. A result
// that cannot be computed is `null` (or NaN for a lone number), never a throw, so a renderer draws nothing.

export type P = readonly [number, number];

const finite = (p: P): boolean => Number.isFinite(p[0]) && Number.isFinite(p[1]);

export const distance = (a: P, b: P): number => (finite(a) && finite(b) ? Math.hypot(b[0] - a[0], b[1] - a[1]) : NaN);

/** The angle at `o` between the rays to `a` and `b`, in degrees from 0 to 180; null when a ray has no length. */
export function angleAt(a: P, o: P, b: P): number | null {
  if (!(finite(a) && finite(o) && finite(b))) return null;
  const ux = a[0] - o[0];
  const uy = a[1] - o[1];
  const vx = b[0] - o[0];
  const vy = b[1] - o[1];
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(vx, vy);
  if (lu === 0 || lv === 0) return null;
  // acos of a rounded ratio just outside [-1, 1] would be NaN: clamp first.
  const c = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** The area inside a polygon by the shoelace sum (always >= 0); NaN when a vertex is not a number. */
export function polygonArea(pts: readonly P[]): number {
  if (pts.length < 3 || !pts.every(finite)) return NaN;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** The length of the boundary; a closed one returns to the first point. */
export function perimeter(pts: readonly P[], closed = true): number {
  if (pts.length < 2 || !pts.every(finite)) return NaN;
  let s = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) s += distance(pts[i]!, pts[(i + 1) % pts.length]!);
  return s;
}

/** Where a line, ray or segment through `a` and `b` crosses the window: its two end points, or null if it misses it. */
export function clipLine(a: P, b: P, window: Viewport, mode: 'line' | 'ray' | 'segment'): [Pt, Pt] | null {
  if (!(finite(a) && finite(b)) || (a[0] === b[0] && a[1] === b[1])) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  // Liang-Barsky over the parameter t of a + t(b - a): the window is a little larger so the ends are off screen.
  const padX = (window.xMax - window.xMin) * 0.02;
  const padY = (window.yMax - window.yMin) * 0.02;
  let t0 = mode === 'line' ? -Infinity : 0;
  let t1 = mode === 'segment' ? 1 : Infinity;
  const edges: [number, number][] = [
    [-dx, a[0] - (window.xMin - padX)],
    [dx, window.xMax + padX - a[0]],
    [-dy, a[1] - (window.yMin - padY)],
    [dy, window.yMax + padY - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null; // parallel to this edge and outside it
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  if (!(t0 <= t1) || !Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

/** The length around a circle and the area inside it. */
export const circumference = (r: number): number => 2 * Math.PI * r;
export const circleArea = (r: number): number => Math.PI * r * r;

export const reflectX = (p: P): P => [p[0], -p[1]]; // over the x-axis
export const reflectY = (p: P): P => [-p[0], p[1]]; // over the y-axis

/** The mirror image of `p` in the line through `a` and `b`; null if the line has no direction. */
export function reflectLine(p: P, a: P, b: P): P | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d2 = dx * dx + dy * dy;
  if (!(d2 > 0) || !(finite(p) && finite(a) && finite(b))) return null;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d2;
  const fx = a[0] + t * dx;
  const fy = a[1] + t * dy;
  return [2 * fx - p[0], 2 * fy - p[1]];
}

/** `p` turned about `c` by `degrees`, counter-clockwise. */
export function rotate(p: P, c: P, degrees: number): P {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * cos - y * sin, c[1] + x * sin + y * cos];
}

export const translate = (p: P, dx: number, dy: number): P => [p[0] + dx, p[1] + dy];

/** `p` moved to `k` times its distance from `c`; k = 0 gives `c`. */
export const scaleAbout = (p: P, c: P, k: number): P => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k];
