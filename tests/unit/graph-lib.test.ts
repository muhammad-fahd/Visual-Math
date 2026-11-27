import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compile, parse } from '../../src/lib/expr';
import { H, MAX_SAMPLES, W, analyze, effectiveViewport, fromX, fromY, niceTicks, sampleFunction, sampleParametric, sane, tickDecimals, toX, toY, type Fn } from '../../src/lib/graph';

// Graphs against values worked out by hand (NFR-6.2): marked features, breaks instead of spikes, the window.

/** A function of x from an expression of `lib/expr`, with the parameters given. */
const fn = (src: string, params: Record<string, number> = {}): Fn => {
  const r = parse(src, { scope: ['x', ...Object.keys(params)] });
  if (!r.ok) throw new Error(`bad expression ${src}`);
  const run = compile(r.value);
  return (x) => run({ x, ...params });
};
const VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
const near = (a: number, b: number, d = 1e-5) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThan(d);

describe('marked features (FR-3.17)', () => {
  it('a quadratic: roots -1 and 3, y-intercept -3, one minimum at (1, -4)', () => {
    const f = analyze(fn('x^2 - 2*x - 3'), -10, 10);
    expect(f.roots).toHaveLength(2);
    near(f.roots[0]!, -1);
    near(f.roots[1]!, 3);
    near(f.yIntercept!, -3, 1e-12);
    expect(f.turning).toHaveLength(1);
    expect(f.turning[0]!.kind).toBe('min');
    near(f.turning[0]!.x, 1, 1e-4);
    near(f.turning[0]!.y, -4, 1e-6);
    expect(f.vertical).toEqual([]);
    expect(f.horizontal).toEqual([]);
  });
  it('follows its parameters: a x^2 + b x + c', () => {
    const f = analyze(fn('a*x^2 + b*x + c', { a: -1, b: 0, c: 4 }), -10, 10);
    near(f.roots[0]!, -2);
    near(f.roots[1]!, 2);
    expect(f.turning[0]).toMatchObject({ kind: 'max' });
    near(f.turning[0]!.y, 4, 1e-6);
  });
  it('a cubic: three roots, a maximum at (-1, 2) and a minimum at (1, -2)', () => {
    const f = analyze(fn('x^3 - 3*x'), -5, 5);
    expect(f.roots).toHaveLength(3);
    near(f.roots[0]!, -Math.sqrt(3));
    near(f.roots[1]!, 0, 1e-9);
    near(f.roots[2]!, Math.sqrt(3));
    expect(f.turning.map((t) => t.kind)).toEqual(['max', 'min']);
    near(f.turning[0]!.x, -1, 1e-4);
    near(f.turning[1]!.y, -2, 1e-6);
  });
  it('sine: a root at every multiple of pi and turning points of height 1', () => {
    const f = analyze(fn('sin(x)'), -7, 7);
    expect(f.roots.map((r) => Math.round(r / Math.PI))).toEqual([-2, -1, 0, 1, 2]);
    for (const r of f.roots) near(r / Math.PI, Math.round(r / Math.PI), 1e-5);
    expect(f.turning.every((t) => Math.abs(Math.abs(t.y) - 1) < 1e-6)).toBe(true);
    expect(f.turning).toHaveLength(4);
    expect(f.horizontal).toEqual([]); // it does not settle
  });
  it('1/x: a vertical asymptote at 0, a horizontal one at 0, no roots and no turning points', () => {
    const f = analyze(fn('1/x'), -5, 5);
    expect(f.vertical).toHaveLength(1);
    near(f.vertical[0]!, 0, 1e-6);
    expect(f.horizontal).toEqual([0]);
    expect(f.roots).toEqual([]);
    expect(f.turning).toEqual([]);
    expect(f.yIntercept).toBeNull(); // not defined at 0
  });
  it('tan: an asymptote at each pole, roots between them, no turning points', () => {
    const f = analyze(fn('tan(x)'), -4, 4);
    expect(f.vertical).toHaveLength(2);
    near(Math.abs(f.vertical[0]!), Math.PI / 2, 1e-5);
    near(f.vertical[1]!, Math.PI / 2, 1e-5);
    expect(f.roots.map((r) => Math.round(r / Math.PI))).toEqual([-1, 0, 1]);
    expect(f.turning).toEqual([]);
  });
  it('x/(x+1): a vertical asymptote at -1 and a horizontal one at 1', () => {
    const f = analyze(fn('x/(x+1)'), -6, 6);
    near(f.vertical[0]!, -1, 1e-6);
    expect(f.horizontal).toEqual([1]);
    near(f.roots[0]!, 0, 1e-9);
  });
  it('exp(-x) settles to 0 on the right only; sqrt has no vertical asymptote; 1/sqrt(x) has one', () => {
    expect(analyze(fn('exp(-x)'), -5, 5).horizontal).toEqual([0]);
    expect(analyze(fn('sqrt(x)'), -5, 5).vertical).toEqual([]);
    expect(analyze(fn('1/sqrt(x)'), -5, 5).vertical).toHaveLength(1);
  });
  it('abs(x) turns at 0 (a corner); a constant and a line turn nowhere', () => {
    const corner = analyze(fn('abs(x)'), -5, 5);
    expect(corner.turning).toHaveLength(1);
    near(corner.turning[0]!.x, 0, 1e-3);
    expect(analyze(fn('5'), -5, 5)).toMatchObject({ roots: [], turning: [], vertical: [] });
    expect(analyze(fn('2*x + 1'), -5, 5).turning).toEqual([]);
    near(analyze(fn('2*x + 1'), -5, 5).roots[0]!, -0.5);
  });
  it('a function that exists nowhere, and a hostile one, give nothing and never throw', () => {
    expect(analyze(fn('sqrt(-1 - x^2)'), -5, 5)).toEqual({ roots: [], yIntercept: null, turning: [], vertical: [], horizontal: [] });
    expect(() => analyze(fn('1e300*x'), -5, 5)).not.toThrow();
    expect(() => analyze(fn('x^100'), -5, 5)).not.toThrow();
    expect(() => analyze(() => NaN, -5, 5)).not.toThrow();
    expect(() => analyze(() => { throw new Error('x'); }, -5, 5)).toThrow(); // a closure from lib/expr never throws; a bare function is the caller's problem
    expect(analyze(fn('x'), 5, -5)).toEqual({ roots: [], yIntercept: null, turning: [], vertical: [], horizontal: [] });
    expect(analyze(fn('x'), NaN, 5).roots).toEqual([]);
  });
  it('a y-intercept needs 0 in the shown domain', () => {
    expect(analyze(fn('x + 1'), 1, 5).yIntercept).toBeNull();
    expect(analyze(fn('x + 1'), -5, 5).yIntercept).toBe(1);
  });
});

describe('sampling: a line breaks, it never spikes', () => {
  const allFinite = (segs: ReturnType<typeof sampleFunction>) => segs.every((s) => s.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  it('1/x is two branches; tan is a branch between each pair of poles', () => {
    expect(sampleFunction(fn('1/x'), -5, 5, VIEW)).toHaveLength(2);
    expect(sampleFunction(fn('tan(x)'), -4, 4, VIEW).length).toBeGreaterThanOrEqual(3);
  });
  it('no segment of tan crosses a pole: consecutive points never leap across the window', () => {
    for (const seg of sampleFunction(fn('tan(x)'), -10, 10, VIEW, 1000)) {
      for (let i = 1; i < seg.length; i++) {
        const [, a] = seg[i - 1]!;
        const [, b] = seg[i]!;
        expect(Math.abs(b - a) > 80 && Math.sign(a) !== Math.sign(b)).toBe(false);
      }
    }
  });
  it('a domain: sqrt starts where it exists, ln too, and a function nowhere defined is nothing', () => {
    const s = sampleFunction(fn('sqrt(x)'), -5, 5, VIEW);
    expect(s).toHaveLength(1);
    expect(s[0]![0]![0]).toBeGreaterThanOrEqual(0);
    expect(sampleFunction(fn('ln(x)'), -5, 5, VIEW)[0]![0]![0]).toBeGreaterThan(0);
    expect(sampleFunction(fn('sqrt(-1 - x^2)'), -5, 5, VIEW)).toEqual([]);
  });
  it('a smooth steep curve is one line, clamped, not broken (x^100)', () => {
    const s = sampleFunction(fn('x^100'), -5, 5, VIEW);
    expect(allFinite(s)).toBe(true);
    expect(s.length).toBeLessThanOrEqual(2);
    for (const seg of s) for (const [, y] of seg) expect(Math.abs(y)).toBeLessThanOrEqual(10 + 50 * 20);
  });
  it('the number of samples is capped, and a bad count falls back', () => {
    const count = (n: number | undefined) => sampleFunction(fn('x'), 0, 1, VIEW, n).reduce((s, seg) => s + seg.length, 0);
    expect(count(1e9)).toBe(MAX_SAMPLES + 1);
    expect(count(undefined)).toBe(401);
    expect(count(NaN)).toBe(401);
    expect(count(-5)).toBe(11);
  });
  it('a window that is not a window cannot make a point that is not a number', () => {
    for (const bad of [{ xMin: 0, xMax: 1, yMin: NaN, yMax: 1 }, { xMin: 0, xMax: 1, yMin: 0, yMax: 0 }, { xMin: 5, xMax: 1, yMin: 0, yMax: 1 }]) {
      for (const seg of sampleFunction(fn('1/x + x'), -3, 3, bad)) for (const [x, y] of seg) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
  });
  it('a reversed, empty or non-finite domain is nothing', () => {
    expect(sampleFunction(fn('x'), 5, 1, VIEW)).toEqual([]);
    expect(sampleFunction(fn('x'), 1, 1, VIEW)).toEqual([]);
    expect(sampleFunction(fn('x'), NaN, 1, VIEW)).toEqual([]);
    expect(sampleFunction(fn('x'), 0, Infinity, VIEW)).toEqual([]);
  });
  it('a parametric circle is one closed path; the sine trace is one path; a NaN splits it', () => {
    const circle = sampleParametric((t) => Math.cos(t), (t) => Math.sin(t), 0, 2 * Math.PI, VIEW);
    expect(circle).toHaveLength(1);
    const path = circle[0]!;
    near(path[0]![0], path[path.length - 1]![0], 1e-9);
    near(path[0]![1], path[path.length - 1]![1], 1e-9);
    for (const [x, y] of path) near(Math.hypot(x, y), 1, 1e-9);
    expect(sampleParametric((t) => t, (t) => Math.sin(t), 0, 10, VIEW)).toHaveLength(1);
    expect(sampleParametric((t) => t, (t) => Math.sqrt(t - 5), 0, 10, VIEW)).toHaveLength(1); // defined from 5 on
    expect(sampleParametric((t) => t, (t) => (Math.abs(t - 5) < 0.1 ? NaN : t), 0, 10, VIEW).length).toBe(2);
  });
  it('property: whatever the function, the viewport and the count, every point is finite and the line is made of runs', () => {
    const expressions = ['x', '1/x', 'tan(x)', 'sqrt(x)', 'ln(x)', 'x^50', 'sin(1/x)', 'exp(x*10)', '1e300*x', 'abs(x) - floor(x)', '0/x'];
    fc.assert(
      fc.property(
        fc.constantFrom(...expressions),
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        fc.double({ min: 1e-3, max: 1e4, noNaN: true }),
        fc.double({ min: 1e-3, max: 1e6, noNaN: true }),
        fc.integer({ min: -5, max: 2000 }),
        (src, x0, width, height, samples) => {
          const view = { xMin: x0, xMax: x0 + width, yMin: -height, yMax: height };
          const segs = sampleFunction(fn(src), view.xMin, view.xMax, view, samples);
          let total = 0;
          for (const seg of segs) {
            expect(seg.length).toBeGreaterThan(1);
            total += seg.length;
            for (const [x, y] of seg) {
              expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
              expect(Math.abs(y)).toBeLessThanOrEqual((height + 50 * 2 * height) * (1 + 1e-9));
            }
          }
          expect(total).toBeLessThanOrEqual(MAX_SAMPLES + 1);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('the window', () => {
  const base = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 };
  it('zoom 1 with equal aspect keeps a 4:3 window; zoom halves and doubles it about the centre', () => {
    const v = effectiveViewport(base, { scale: 1, panX: 0, panY: 0 });
    expect(v).toEqual(base);
    const zoomed = effectiveViewport(base, { scale: 2, panX: 0, panY: 0 });
    expect(zoomed).toEqual({ xMin: -4, xMax: 4, yMin: -3, yMax: 3 });
    const out = effectiveViewport(base, { scale: 0.5, panX: 0, panY: 0 });
    expect(out).toEqual({ xMin: -16, xMax: 16, yMin: -12, yMax: 12 });
  });
  it('zoom is limited to 0.25 and 8 of the declared window, and a bad zoom is 1', () => {
    expect(effectiveViewport(base, { scale: 100, panX: 0, panY: 0 }).xMax).toBe(1);
    expect(effectiveViewport(base, { scale: 0.001, panX: 0, panY: 0 }).xMax).toBe(32);
    for (const s of [NaN, 0, -2, Infinity]) expect(effectiveViewport(base, { scale: s, panX: 0, panY: 0 })).toEqual(effectiveViewport(base, { scale: 1, panX: 0, panY: 0 }));
  });
  it('a pan to the right and down moves the window left and up by that fraction of its size', () => {
    const v = effectiveViewport(base, { scale: 1, panX: 0.25, panY: 0.5 });
    expect(v.xMin).toBe(-12);
    expect(v.xMax).toBe(4);
    expect(v.yMin).toBe(0);
    expect(v.yMax).toBe(12);
  });
  it('equal aspect gives equal unit lengths on both axes; free keeps the declared window', () => {
    const wide = { xMin: 0, xMax: 100, yMin: 0, yMax: 1 };
    const eq = effectiveViewport(wide, { scale: 1, panX: 0, panY: 0 }, 'equal');
    near((eq.xMax - eq.xMin) / W, (eq.yMax - eq.yMin) / H, 1e-9);
    expect(effectiveViewport(wide, { scale: 1, panX: 0, panY: 0 }, 'free')).toEqual(wide);
  });
  it('a viewport that is not a window is replaced, never drawn', () => {
    for (const bad of [{ xMin: 1, xMax: 1, yMin: 0, yMax: 1 }, { xMin: NaN, xMax: 1, yMin: 0, yMax: 1 }, { xMin: 0, xMax: Infinity, yMin: 0, yMax: 1 }, {}]) {
      expect(sane(bad)).toEqual({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
    }
  });
  it('data and picture map to each other, with y up', () => {
    const v = { xMin: 0, xMax: 4, yMin: 0, yMax: 3 };
    expect([toX(v, 0), toX(v, 4), toY(v, 0), toY(v, 3)]).toEqual([0, W, H, 0]);
    near(fromX(v, toX(v, 1.3)), 1.3, 1e-12);
    near(fromY(v, toY(v, 2.2)), 2.2, 1e-12);
  });
  it('round ticks: steps of 1, 2 or 5 times a power of ten, in range, including zero', () => {
    expect(niceTicks(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(niceTicks(0, 20)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(niceTicks(-3, 5)).toEqual([-3, -2, -1, 0, 1, 2, 3, 4, 5]);
    expect(niceTicks(-1, 1)).toEqual([-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0, 1000)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(niceTicks(5, 5)).toEqual([]);
    expect(niceTicks(NaN, 5)).toEqual([]);
    expect(tickDecimals([0, 0.2, 0.4])).toBe(1);
    expect(tickDecimals([0, 5, 10])).toBe(0);
    expect(tickDecimals([0, 0.25])).toBe(2);
  });
  it('property: ticks are inside the range, ascending, and about as many as asked', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.double({ min: 1e-3, max: 1e6, noNaN: true }), (min, span) => {
        const t = niceTicks(min, min + span, 8);
        expect(t.length).toBeLessThanOrEqual(30);
        for (let i = 0; i < t.length; i++) {
          expect(t[i]!).toBeGreaterThanOrEqual(min - span * 1e-6);
          expect(t[i]!).toBeLessThanOrEqual(min + span + span * 1e-6);
          if (i > 0) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('review of Stories 3.1, 3.2 and 3.4: marked features', () => {
  it('a function that is 0 everywhere has no roots to mark, and still an intercept', () => {
    const f = analyze(() => 0, -8, 8);
    expect(f.roots).toEqual([]);
    expect(f.yIntercept).toBe(0);
    expect(f.turning).toEqual([]);
    expect(analyze((x) => 0 * x, -8, 8).roots).toEqual([]);
  });
  it('a stretch of zeros is one root, not one per sample', () => {
    expect(analyze((x) => Math.max(0, x), -8, 8).roots.length).toBeLessThanOrEqual(2);
  });
  it('a double root, which the curve touches without crossing, is marked: (x - 1)^2 and x^2 + 2x + 1', () => {
    const a = analyze((x) => (x - 1) ** 2, -8, 8);
    expect(a.roots).toHaveLength(1);
    expect(Math.abs(a.roots[0]! - 1)).toBeLessThan(1e-6);
    expect(a.turning).toHaveLength(1);
    const b = analyze((x) => x * x + 2 * x + 1, -8, 8);
    expect(b.roots).toHaveLength(1);
    expect(Math.abs(b.roots[0]! + 1)).toBeLessThan(1e-6);
    // a minimum above the axis is not a root
    expect(analyze((x) => (x - 1) ** 2 + 0.5, -8, 8).roots).toEqual([]);
  });
  it('a constant has no horizontal asymptote; exp(-x), which is 0 only far out, still has one; a domain turns the search off', () => {
    expect(analyze(() => 3, -8, 8).horizontal).toEqual([]);
    expect(analyze((x) => Math.exp(-x), -8, 8).horizontal).toEqual([0]);
    expect(analyze((x) => 1 / x, -8, 8).horizontal).toEqual([0]);
    expect(analyze((x) => 1 / x, -8, 8, { horizontal: false }).horizontal).toEqual([]);
  });
});
