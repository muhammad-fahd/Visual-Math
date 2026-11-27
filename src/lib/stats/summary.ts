// The numbers of descriptive statistics (FR-3.26), with fixed definitions that the pictures state in words:
// quartiles are the medians of the lower and upper halves (the middle value left out when n is odd); an outlier
// lies more than 1.5 times the interquartile range beyond a quartile; the fitted line is least squares.

const sum = (a: readonly number[]) => a.reduce((s, v) => s + v, 0);

export const mean = (a: readonly number[]): number => (a.length === 0 ? NaN : sum(a) / a.length);

/** The median of an already sorted list. */
const medianOfSorted = (s: readonly number[]): number => {
  if (s.length === 0) return NaN;
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const median = (a: readonly number[]): number => medianOfSorted([...a].sort((x, y) => x - y));

export interface Summary {
  n: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
  /** The sample standard deviation (n - 1); 0 for one value. */
  sd: number;
  outliers: number[];
  /** The furthest values that are not outliers. */
  whiskerLow: number;
  whiskerHigh: number;
}

/** Null for no data. */
export function summarize(data: readonly number[]): Summary | null {
  const s = data.filter(Number.isFinite).sort((x, y) => x - y);
  const n = s.length;
  if (n === 0) return null;
  const half = n >> 1;
  const lower = s.slice(0, half);
  const upper = s.slice(n % 2 === 1 ? half + 1 : half);
  const q1 = n === 1 ? s[0]! : medianOfSorted(lower);
  const q3 = n === 1 ? s[0]! : medianOfSorted(upper);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= lowFence && v <= highFence);
  const m = mean(s);
  return {
    n,
    mean: m,
    median: medianOfSorted(s),
    q1,
    q3,
    iqr,
    min: s[0]!,
    max: s[n - 1]!,
    sd: n === 1 ? 0 : Math.sqrt(sum(s.map((v) => (v - m) ** 2)) / (n - 1)),
    outliers: s.filter((v) => v < lowFence || v > highFence),
    whiskerLow: inside[0] ?? s[0]!,
    whiskerHigh: inside[inside.length - 1] ?? s[n - 1]!,
  };
}

export interface Fit {
  slope: number;
  intercept: number;
  /** The correlation; null when y does not vary (it is undefined then). */
  r: number | null;
}

/** The least-squares line through the points; null for fewer than 2 points or no spread in x. */
export function regress(points: readonly (readonly [number, number])[]): Fit | null {
  const p = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (p.length < 2) return null;
  const mx = mean(p.map(([x]) => x));
  const my = mean(p.map(([, y]) => y));
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of p) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r: syy > 0 ? sxy / Math.sqrt(sxx * syy) : null };
}

/**
 * `bins` equal bins from the smallest to the largest value; the largest value falls in the last bin. All values equal
 * is one bin of width 1 around them.
 */
export function bin(data: readonly number[], bins: number): { edges: number[]; counts: number[] } {
  const v = data.filter(Number.isFinite);
  if (v.length === 0) return { edges: [], counts: [] };
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  if (hi === lo) return { edges: [lo - 0.5, lo + 0.5], counts: [v.length] };
  const k = Math.max(1, Math.round(bins));
  const w = (hi - lo) / k;
  const counts = Array.from({ length: k }, () => 0);
  for (const x of v) counts[Math.min(k - 1, Math.floor((x - lo) / w))]!++;
  return { edges: Array.from({ length: k + 1 }, (_, i) => (i === k ? hi : lo + i * w)), counts };
}
