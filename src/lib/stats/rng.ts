// A seeded random generator (Story 3.6, FR-3.26): the same seed gives the same numbers in the browser, on the
// server and in tests, so a scene with chance in it is still a pure function of its parameters. Nothing in the
// code base calls `Math.random`. mulberry32: a 32-bit state, one multiply-xorshift round per number.

/** A generator of numbers in [0, 1), from an integer seed (a seed that is not a number is 0). */
export function mulberry32(seed: number): () => number {
  let a = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAX_GENERATED = 500;

export interface Gen {
  n: number;
  dist: 'normal' | 'uniform';
  mean: number;
  sd: number;
  seed: number;
}

/**
 * `n` values (1 to 500) from a normal distribution (Box-Muller) or from a uniform one with the same mean and standard
 * deviation. The first `m` values are the same whatever `n` is, so a longer sample extends a shorter one.
 */
export function generate(g: Gen): number[] {
  const n = Number.isFinite(g.n) ? Math.min(MAX_GENERATED, Math.max(1, Math.round(g.n))) : 0;
  if (!(Number.isFinite(g.mean) && Number.isFinite(g.sd) && g.sd >= 0) || n === 0) return [];
  const next = mulberry32(g.seed);
  const out: number[] = [];
  if (g.dist === 'uniform') {
    const half = g.sd * Math.sqrt(3);
    for (let i = 0; i < n; i++) out.push(g.mean - half + 2 * half * next());
    return out;
  }
  while (out.length < n) {
    // 1 - u is in (0, 1], so the logarithm is finite.
    const r = Math.sqrt(-2 * Math.log(1 - next()));
    const t = 2 * Math.PI * next();
    out.push(g.mean + g.sd * r * Math.cos(t));
    if (out.length < n) out.push(g.mean + g.sd * r * Math.sin(t));
  }
  return out;
}

/** The first `trials` outcomes (0 to k - 1) of an experiment with k equally likely results: a prefix of any longer run. */
export function outcomes(trials: number, k: number, seed: number): number[] {
  const next = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < trials; i++) out.push(Math.min(k - 1, Math.floor(next() * k)));
  return out;
}
