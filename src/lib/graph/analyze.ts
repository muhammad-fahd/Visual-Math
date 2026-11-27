// The features of a graph worth marking (FR-3.17): where it crosses the axes, where it turns, and the lines
// it approaches. Found numerically on the shown domain: a root is a sign change refined by bisection (a sign
// change that does not shrink to zero is a pole, an asymptote); a turning point is a change of slope refined
// by golden-section search. Pure; every evaluation is a closure of `lib/expr`, so a hostile function costs
// its budget and gives NaN, never a crash.

export type Fn = (x: number) => number;

export interface Turning {
  readonly x: number;
  readonly y: number;
  readonly kind: 'min' | 'max';
}

export interface Features {
  /** Where y = 0 (x-intercepts), ascending. */
  readonly roots: readonly number[];
  /** y at x = 0, when 0 is in the domain and the value exists. */
  readonly yIntercept: number | null;
  readonly turning: readonly Turning[];
  /** x of vertical asymptotes. */
  readonly vertical: readonly number[];
  /** y of horizontal asymptotes (at most one on each side, equal ones merged). */
  readonly horizontal: readonly number[];
}

const SAMPLES = 600;
const ROOT_TOLERANCE = 1e-6;

const finite = Number.isFinite;

function bisect(f: Fn, a: number, b: number): { x: number; y: number } {
  let lo = a;
  let hi = b;
  let flo = f(lo);
  let fhi = f(hi);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (!finite(fm)) break; // beyond what lib/expr will give (a pole): stop with the bracket we have
    if (fm === 0) return { x: mid, y: 0 };
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else {
      hi = mid;
      fhi = fm;
    }
  }
  const x = (lo + hi) / 2;
  const y = f(x);
  // At a pole the value itself may be too large to give: the larger end of the bracket stands for it.
  return { x, y: finite(y) ? y : Math.abs(flo) > Math.abs(fhi) ? flo : fhi };
}

function golden(f: Fn, a: number, b: number, maximize: boolean): { x: number; y: number } {
  const sign = maximize ? -1 : 1;
  const g = (x: number) => sign * f(x);
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let c = hi - phi * (hi - lo);
  let d = lo + phi * (hi - lo);
  for (let i = 0; i < 60; i++) {
    const gc = g(c);
    const gd = g(d);
    if (!finite(gc) || !finite(gd)) break;
    if (gc < gd) {
      hi = d;
      d = c;
      c = hi - phi * (hi - lo);
    } else {
      lo = c;
      c = d;
      d = lo + phi * (hi - lo);
    }
  }
  const x = (lo + hi) / 2;
  return { x, y: f(x) };
}

const dedupe = (values: number[], tolerance: number): number[] => {
  const sorted = [...values].sort((p, q) => p - q);
  const out: number[] = [];
  for (const v of sorted) if (out.length === 0 || Math.abs(v - out[out.length - 1]!) > tolerance) out.push(v);
  return out;
};

export function analyze(f: Fn, x0: number, x1: number): Features {
  const none: Features = { roots: [], yIntercept: null, turning: [], vertical: [], horizontal: [] };
  if (!(finite(x0) && finite(x1) && x1 > x0)) return none;
  const w = x1 - x0;
  const xsamples = Array.from({ length: SAMPLES + 1 }, (_, i) => x0 + (w * i) / SAMPLES);
  const ys = xsamples.map((x) => f(x));

  // Size of the values on the screen: the scale that "small" and "large" are judged by.
  const finiteYs = ys.filter(finite).map(Math.abs).sort((p, q) => p - q);
  const typical = finiteYs.length > 0 ? Math.max(1, finiteYs[Math.floor(finiteYs.length * 0.9)]!) : 1;

  const roots: number[] = [];
  const vertical: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = ys[i]!;
    const b = ys[i + 1]!;
    if (!finite(a) || !finite(b)) {
      // The edge of the domain: an asymptote only if the value grows without bound toward it.
      if (finite(a) !== finite(b)) {
        const inside = finite(a) ? xsamples[i]! : xsamples[i + 1]!;
        const outside = finite(a) ? xsamples[i + 1]! : xsamples[i]!;
        // Walk toward the edge by halving the gap: find the last x where the function exists.
        let ok = inside;
        let bad = outside;
        for (let k = 0; k < 50; k++) {
          const mid = (ok + bad) / 2;
          if (finite(f(mid))) ok = mid;
          else bad = mid;
        }
        // From the edge into the domain: compare the value a little in with the value very close to the edge.
        const dir = inside > ok ? 1 : -1;
        const span = Math.abs(inside - ok);
        const v1 = Math.abs(f(ok + dir * Math.max(span * 1e-3, 1e-9)));
        const v2 = Math.abs(f(ok + dir * Math.max(span * 1e-9, 1e-12)));
        if (finite(v1) && finite(v2) && v2 > 2 * v1 && v2 > 5 * typical) vertical.push(ok);
      }
      continue;
    }
    if (a === 0) roots.push(xsamples[i]!);
    else if (Math.sign(a) !== Math.sign(b) && b !== 0) {
      const r = bisect(f, xsamples[i]!, xsamples[i + 1]!);
      if (!finite(r.y)) continue;
      if (Math.abs(r.y) <= ROOT_TOLERANCE * typical) roots.push(r.x);
      else if (Math.abs(r.y) > 10 * typical) vertical.push(r.x); // a sign change that does not close up: a pole
    }
  }
  if (ys[SAMPLES] === 0) roots.push(x1);

  // Turning points: the slope changes sign. A step of zero (two samples at the same height either side of a
  // peak) is skipped, so the change is found between the last step up or down and the next one.
  const turning: Turning[] = [];
  const near = (x: number) => turning.some((t) => Math.abs(t.x - x) < w * 1e-3);
  const noise = 1e-12 * typical;
  let before = 0;
  let from = -1;
  for (let i = 0; i < SAMPLES; i++) {
    const a = ys[i]!;
    const b = ys[i + 1]!;
    if (!(finite(a) && finite(b))) {
      before = 0;
      continue;
    }
    const d = b - a;
    const now = Math.abs(d) > noise ? Math.sign(d) : 0;
    if (now === 0) continue;
    if (before !== 0 && now !== before) {
      const maximum = before > 0;
      const r = golden(f, xsamples[from]!, xsamples[i + 1]!, maximum);
      if (finite(r.y) && Math.abs(r.y) < 1e6 * typical && !near(r.x)) turning.push({ x: r.x, y: r.y, kind: maximum ? 'max' : 'min' });
    }
    before = now;
    from = i;
  }
  // A "turning point" beside a pole is the function running to infinity and back: not a turning point.
  const realTurning = turning.filter((t) => !vertical.some((v) => Math.abs(v - t.x) < w * 0.01));

  // Horizontal asymptotes: the values settle as x grows without bound, to the left and to the right.
  const horizontal: number[] = [];
  for (const sign of [1, -1]) {
    const a = f(sign * 1e4);
    const b = f(sign * 1e5);
    const c = f(sign * 1e6);
    if (finite(a) && finite(b) && finite(c) && Math.abs(c) < 1e6 && Math.abs(c - b) <= 1e-3 * (1 + Math.abs(c)) && Math.abs(b - a) <= 1e-2 * (1 + Math.abs(b)) && Math.abs(c - b) < Math.abs(b - a) + 1e-12) {
      // The error shrinks like 1/x: the next step of the same ratio estimates the limit (rounded to 6 places).
      horizontal.push(Math.round((c - (b - c) / 9) * 1e6) / 1e6 + 0);
    }
  }

  let yIntercept: number | null = null;
  if (x0 <= 0 && x1 >= 0) {
    const y = f(0);
    if (finite(y)) yIntercept = y;
  }

  return {
    roots: dedupe(roots, w * 1e-6),
    yIntercept,
    turning: realTurning.sort((p, q) => p.x - q.x),
    vertical: dedupe(vertical, w * 1e-6),
    horizontal: dedupe(horizontal, 1e-9),
  };
}
