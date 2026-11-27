import { sane, type Viewport } from './viewport';

// Turning a function into lines (FR-3.17). A value that cannot be computed, or one that leaps across an
// asymptote, breaks the line: it never draws a spike. Every coordinate is clamped to a finite window and the
// number of points is capped. Pure.

export type Pt = readonly [number, number];
export type Segment = readonly Pt[];

export const MAX_SAMPLES = 1000;
export const MIN_SAMPLES = 10;
/** How far outside the viewport (in viewport heights) a value may be drawn: beyond it the line is clamped. */
const OVERSHOOT = 50;

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The samples between `a` and `b`: n + 1 evenly spaced, the last exactly `b`. */
function xs(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(i === n ? b : a + ((b - a) * i) / n);
  return out;
}

const cap = (n: number | undefined, fallback: number) => Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Number.isFinite(n) ? Math.floor(n as number) : fallback));

/** y = f(x) over [x0, x1], as separate segments wherever the function is not defined or jumps. */
export function sampleFunction(f: (x: number) => number, x0: number, x1: number, window: Viewport, samples?: number): Segment[] {
  const view = sane(window); // a window that is not a window is replaced: no NaN can leave this function
  if (!(Number.isFinite(x0) && Number.isFinite(x1) && x1 > x0)) return [];
  const n = cap(samples, 400);
  const h = view.yMax - view.yMin;
  const lo = view.yMin - OVERSHOOT * h;
  const hi = view.yMax + OVERSHOOT * h;
  const out: Segment[] = [];
  let run: Pt[] = [];
  let prev: number | null = null;
  const flush = () => {
    if (run.length > 1) out.push(run);
    run = [];
  };
  for (const x of xs(x0, x1, n)) {
    const y = f(x);
    if (!Number.isFinite(y)) {
      flush();
      prev = null;
      continue;
    }
    // A leap of more than four viewport heights that changes side (tan, 1/x) is an asymptote, not a line.
    if (prev !== null && Math.abs(y - prev) > 4 * h && Math.sign(y) !== Math.sign(prev)) flush();
    run.push([x, clampTo(y, lo, hi)]);
    prev = y;
  }
  flush();
  return out;
}

/** (x(t), y(t)) over t0 to t1: one path, split where either coordinate is not a number. */
export function sampleParametric(fx: (t: number) => number, fy: (t: number) => number, t0: number, t1: number, window: Viewport, samples?: number): Segment[] {
  const view = sane(window);
  if (!(Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0)) return [];
  const n = cap(samples, 400);
  const w = view.xMax - view.xMin;
  const h = view.yMax - view.yMin;
  const out: Segment[] = [];
  let run: Pt[] = [];
  const flush = () => {
    if (run.length > 1) out.push(run);
    run = [];
  };
  for (const t of xs(t0, t1, n)) {
    const x = fx(t);
    const y = fy(t);
    if (!(Number.isFinite(x) && Number.isFinite(y))) {
      flush();
      continue;
    }
    run.push([clampTo(x, view.xMin - OVERSHOOT * w, view.xMax + OVERSHOOT * w), clampTo(y, view.yMin - OVERSHOOT * h, view.yMax + OVERSHOOT * h)]);
  }
  flush();
  return out;
}
