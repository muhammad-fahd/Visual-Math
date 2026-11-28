// The numerics of the calculus elements (FR-3.25, Story 4.3): a derivative, an integral, Riemann sums and a limit estimate
// of a function given as a closure (`program.fn`). Pure; a result that cannot be computed is `null` (or NaN for a lone
// number), never a throw, so a renderer draws nothing and the text says "not defined".

export type Fn = (x: number) => number;

/** The step of the central difference (topic-format 2.3: h = 1e-5). */
export const H = 1e-5;

/** f'(x) by the central difference; null where f is not defined near x or the two sides give no number. */
export function derivativeAt(f: Fn, x: number): number | null {
  if (!Number.isFinite(x)) return null;
  const a = f(x - H);
  const b = f(x + H);
  if (!(Number.isFinite(a) && Number.isFinite(b))) return null;
  const d = (b - a) / (2 * H);
  return Number.isFinite(d) ? d : null;
}

/**
 * The slope of the tangent at x: the derivative, but null where f is not defined at x, or where the slopes from the left and
 * from the right differ (a corner like |x| at 0, a jump), because there is no tangent there.
 */
export function slopeAt(f: Fn, x: number): number | null {
  const y = f(x);
  if (!Number.isFinite(y)) return null;
  const m = derivativeAt(f, x);
  if (m === null) return null;
  // The slope from each side at two distances. On a smooth curve the slopes at both distances agree, however steep it is
  // (1000x). At a jump the slope grows as the distance shrinks (sign(x) at 0), and at a corner the two sides differ (|x|).
  const side = (sign: 1 | -1) => {
    const s1 = (sign * (f(x + sign * 1e-4) - y)) / 1e-4;
    const s2 = (sign * (f(x + sign * 1e-5) - y)) / 1e-5;
    return Number.isFinite(s1) && Number.isFinite(s2) ? ([s1, s2] as const) : null;
  };
  const left = side(-1);
  const right = side(1);
  if (!left || !right) return null;
  const same = (a: number, b: number) => Math.abs(a - b) <= 0.05 * Math.max(1, Math.abs(a), Math.abs(b));
  if (!same(left[0], left[1]) || !same(right[0], right[1])) return null;
  return same(left[1], right[1]) ? m : null;
}

/** The integral of f from a to b by composite Simpson with `n` intervals (even); NaN if f is not a number anywhere on it. */
export function integral(f: Fn, a: number, b: number, n = 1000): number {
  if (!(Number.isFinite(a) && Number.isFinite(b))) return NaN;
  if (a === b) return 0;
  const intervals = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / intervals;
  let sum = f(a) + f(b);
  for (let i = 1; i < intervals; i++) sum += f(a + i * h) * (i % 2 === 1 ? 4 : 2);
  const value = (sum * h) / 3;
  return Number.isFinite(value) ? value : NaN;
}

export type Method = 'left' | 'right' | 'mid' | 'trapezoid';

export interface Slice {
  /** The left and right x of the slice and the heights at the two ends (a trapezoid) or the one height (a rectangle). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The n slices of a Riemann sum over [a, b]: rectangles take one height, trapezoids two. Empty if f is not a number at a point it needs. */
export function slices(f: Fn, a: number, b: number, n: number, method: Method): Slice[] {
  if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isInteger(n) && n >= 1)) return [];
  const width = (b - a) / n;
  const out: Slice[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = a + i * width;
    const x1 = i === n - 1 ? b : a + (i + 1) * width;
    let y0: number;
    let y1: number;
    if (method === 'trapezoid') {
      y0 = f(x0);
      y1 = f(x1);
    } else {
      const at = method === 'left' ? x0 : method === 'right' ? x1 : (x0 + x1) / 2;
      y0 = y1 = f(at);
    }
    if (!(Number.isFinite(y0) && Number.isFinite(y1))) return [];
    out.push({ x0, x1, y0, y1 });
  }
  return out;
}

/** The sum of the slices' areas (signed: a height below the axis counts negative). */
export const sumOf = (list: readonly Slice[]): number => list.reduce((s, c) => s + ((c.x1 - c.x0) * (c.y0 + c.y1)) / 2, 0);

export interface Limit {
  left: number;
  right: number;
  /** The common value when both sides agree, else null. */
  limit: number | null;
  /** f at the point itself, or null where it is not defined (the open circle of a hole). */
  atPoint: number | null;
}

/**
 * The limit of f as x approaches a, estimated from both sides at the distance `h` (what is shown) and at a thousandth of it
 * (what decides whether the sides agree). Null when f is not defined on a side at that distance.
 */
export function limitOf(f: Fn, a: number, h: number): Limit | null {
  if (!(Number.isFinite(a) && Number.isFinite(h) && h > 0)) return null;
  const left = f(a - h);
  const right = f(a + h);
  if (!(Number.isFinite(left) && Number.isFinite(right))) return null;
  const tiny = h / 1000;
  // Each side is read at two distances and extrapolated straight to the point, so a slope (f(x) = x with a large h) does not
  // make the two sides look different; a jump still does.
  const reach = (sign: 1 | -1) => {
    const far = f(a + sign * tiny);
    const near = f(a + sign * (tiny / 10));
    return Number.isFinite(far) && Number.isFinite(near) ? near + (near - far) / 9 : NaN;
  };
  const l = reach(-1);
  const r = reach(1);
  const at = f(a);
  const agree = Number.isFinite(l) && Number.isFinite(r) && Math.max(Math.abs(l), Math.abs(r)) < 1e6 && Math.abs(l - r) <= 1e-3 * Math.max(1, Math.abs(l), Math.abs(r));
  return { left, right, limit: agree ? (l + r) / 2 : null, atPoint: Number.isFinite(at) ? at : null };
}
