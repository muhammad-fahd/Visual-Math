import { format } from '../expr';
import { niceTicks } from '../graph';
import type { Label, Prim, Sentence } from '../numbermodel';
import type { Program, Scope } from '../params';
import { generate, outcomes } from './rng';
import { bin, regress, summarize } from './summary';

// What a `stats` scene is made of at one moment (FR-3.26, topic-format 2.11): each chart as the flat prims the
// other number models use (rectangles, lines, dots, a polyline, a filled polygon and text in a 400 by 300 box),
// and the sentences that say the same in words. Chance is a seeded generator, so a chart is a pure function of the
// scene and its parameters. Probabilities come from `lib/expr` (`normcdf`, `normpdf`, `binompmf`).

type Num = number | string;

export type Data = number[] | { gen: { n: Num; dist: 'normal' | 'uniform'; mean?: Num; sd?: Num; seed: number } };

export type Chart =
  | { kind: 'dotPlot'; data: Data }
  | { kind: 'histogram'; data: Data; bins: Num; showMean?: boolean; showMedian?: boolean }
  | { kind: 'boxplot'; data: Data; showOutliers?: boolean }
  | { kind: 'scatter'; points: [Num, Num][]; fit?: 'linear'; showResiduals?: boolean }
  | { kind: 'bar'; categories: Label[]; values: Num[] }
  | { kind: 'distribution'; dist: 'normal' | 'binomial' | 'uniform'; params: Record<string, Num>; shade?: { from: Num; to: Num } }
  | { kind: 'simulation'; sim: 'coin' | 'die' | 'spinner'; trials: Num; seed: number; sectors?: Num };

export interface Built {
  prims: Prim[];
  sentences: Sentence[];
}

export interface BuildOptions {
  chart: Chart;
  program: Program;
  scope: Scope;
  /** Part ids a step has hidden: `mean`, `median`, `fit`, `residuals`, `shade`, `expected`, `labels`. */
  hidden?: ReadonlySet<string>;
  /** The words of a label in the visitor's language. */
  text?: (label: Label) => string;
  /** The letters under the two bars of a coin, in the visitor's language. */
  words?: { heads: string; tails: string };
}

export const LIMITS = { dotPlot: 100, data: 500, scatter: 100, categories: 12, trials: 1000, binomialN: 100 } as const;

const X0 = 50;
const X1 = 380;
const Y0 = 30;
const Y1 = 250;
const finite = (n: number) => Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const trim = (n: number, d = 4) => format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
const pct = (f: number) => trim(f * 100, 1);
/** A probability to 4 decimals; a real but tiny one is "<0.0001", never a bare 0 (zero is impossible). */
const probText = (p: number) => (p > 0 && p < 0.00005 ? '<0.0001' : trim(p));
/** The free variable of a density: a name longer than any topic parameter can be (16), so it can never be shadowed. */
const FREE = 'statsfreevariable1';
/** At most `max` characters of a label, cut between characters (a combining mark or a surrogate pair stays whole). */
const cut = (label: string, max: number): string => {
  const parts = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? Array.from(new Intl.Segmenter().segment(label), (g) => g.segment) : Array.from(label);
  return parts.slice(0, max).join('');
};

/** An expression's source text as a piece of a larger expression: a number as itself, a name or formula in parentheses. */
const src = (v: Num | undefined): string => (typeof v === 'number' ? String(v) : `(${v ?? 'nan'})`);

export function buildChart(o: BuildOptions): Built {
  const { chart, program, scope, hidden } = o;
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const show = (part: string) => !hidden?.has(part);
  const out: Built = { prims: [], sentences: [] };
  const { prims } = out;
  const say = (key: string, values: Record<string, string | number> = {}) => out.sentences.push({ key, values });
  const txt = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', size = 10, tone: 'axis' | 'muted' | 'accent' | 'curve1' | 'curve2' = 'muted', bold = false) =>
    prims.push({ t: 'text', x, y, text, anchor, size, tone, bold });
  const line = (x1: number, y1: number, x2: number, y2: number, tone: 'axis' | 'grid' | 'accent' | 'curve1' | 'curve2' | 'muted' = 'axis', width = 1, dash = false) =>
    prims.push({ t: 'line', x1, y1, x2, y2, tone, width, ...(dash ? { dash: true } : {}) });

  const sx = (lo: number, hi: number) => (v: number) => X0 + ((v - lo) / (hi - lo)) * (X1 - X0);
  const sy = (lo: number, hi: number) => (v: number) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);

  /** The x axis with its numbers, and (when `yTicks`) the y axis with its numbers and light grid lines. */
  const axes = (lo: number, hi: number, yLo = 0, yHi = 0, yTicks: number[] | null = null, yLabel = (v: number) => trim(v)) => {
    const X = sx(lo, hi);
    line(X0, Y1, X1, Y1, 'axis', 1.4);
    for (const t of niceTicks(lo, hi, 6)) {
      line(X(t), Y1, X(t), Y1 + 4, 'axis', 1);
      if (show('labels')) txt(X(t), Y1 + 16, trim(t));
    }
    if (yTicks) {
      const Y = sy(yLo, yHi);
      line(X0, Y0, X0, Y1, 'axis', 1.4);
      for (const t of yTicks) {
        line(X0, Y(t), X1, Y(t), 'grid', 0.6);
        if (show('labels')) txt(X0 - 5, Y(t) + 3, yLabel(t), 'end');
      }
    }
  };

  /** The numbers of a `data` field: a list of numbers (non-numbers left out) or a generated sample. */
  const resolve = (data: Data, cap: number): number[] | null => {
    if (Array.isArray(data)) {
      const good = data.filter((v) => typeof v === 'number' && finite(v));
      if (good.length < data.length) say('dropped', { k: data.length - good.length });
      return good.slice(0, cap);
    }
    const g = data.gen;
    const values = generate({ n: num(g.n), dist: g.dist, mean: g.mean === undefined ? 0 : num(g.mean), sd: g.sd === undefined ? 1 : num(g.sd), seed: g.seed });
    return values.length === 0 ? null : values.slice(0, cap);
  };

  switch (chart.kind) {
    case 'dotPlot': {
      const data = resolve(chart.data, LIMITS.dotPlot);
      const s = data && summarize(data);
      if (!data || !s) return out;
      const pad = (s.max - s.min) * 0.06 || 1;
      const lo = s.min - pad;
      const hi = s.max + pad;
      const X = sx(lo, hi);
      axes(lo, hi);
      const stacks = new Map<number, number>();
      for (const v of data) {
        const key = Number(v.toFixed(6));
        stacks.set(key, (stacks.get(key) ?? 0) + 1);
      }
      const tallest = Math.max(...stacks.values());
      const r = Math.min(9, (Y1 - Y0 - 10) / (2 * tallest), (X1 - X0) / (2 * Math.max(1, stacks.size)));
      for (const [v, k] of stacks) for (let j = 0; j < k; j++) prims.push({ t: 'dot', x: X(v), y: Y1 - r - 2 - j * 2 * r, r: Math.max(2, r - 0.5), tone: 'curve1' });
      say('dotPlot', { n: data.length, min: trim(s.min), max: trim(s.max), median: trim(s.median) });
      return out;
    }

    case 'histogram': {
      const data = resolve(chart.data, LIMITS.data);
      const s = data && summarize(data);
      const bins = clamp(Math.round(num(chart.bins)), 2, 40);
      if (!data || !s || !finite(bins)) return out;
      const { edges, counts } = bin(data, bins);
      const top = Math.max(...counts);
      const ticks = niceTicks(0, top, 5).filter((t) => Number.isInteger(t));
      const yHi = top * 1.1;
      const lo = edges[0]!;
      const hi = edges[edges.length - 1]!;
      const X = sx(lo, hi);
      const Y = sy(0, yHi);
      axes(lo, hi, 0, yHi, ticks);
      counts.forEach((c, i) => {
        if (c > 0) prims.push({ t: 'rect', x: X(edges[i]!), y: Y(c), w: X(edges[i + 1]!) - X(edges[i]!), h: Y1 - Y(c), tone: 'curve1', fill: 'medium' });
      });
      say('histogram', { n: data.length, bins: counts.length, tallest: top, from: trim(lo), to: trim(hi) });
      if (chart.showMean && show('mean')) {
        line(X(s.mean), Y0, X(s.mean), Y1, 'accent', 2, true);
        say('mean', { v: trim(s.mean) });
      }
      if (chart.showMedian && show('median')) {
        line(X(s.median), Y0, X(s.median), Y1, 'curve2', 2);
        say('median', { v: trim(s.median) });
      }
      say('spread', { sd: trim(s.sd) });
      return out;
    }

    case 'boxplot': {
      const data = resolve(chart.data, LIMITS.data);
      const s = data && summarize(data);
      if (!data || !s) return out;
      const showOut = chart.showOutliers === true;
      const lowEnd = showOut ? s.whiskerLow : s.min;
      const highEnd = showOut ? s.whiskerHigh : s.max;
      const pad = (s.max - s.min) * 0.06 || 1;
      const lo = s.min - pad;
      const hi = s.max + pad;
      const X = sx(lo, hi);
      axes(lo, hi);
      const cy = 140;
      prims.push({ t: 'rect', x: X(s.q1), y: cy - 30, w: Math.max(1, X(s.q3) - X(s.q1)), h: 60, tone: 'curve1', fill: 'light' });
      line(X(s.median), cy - 30, X(s.median), cy + 30, 'curve2', 3);
      line(X(lowEnd), cy, X(s.q1), cy, 'axis', 1.6);
      line(X(s.q3), cy, X(highEnd), cy, 'axis', 1.6);
      line(X(lowEnd), cy - 12, X(lowEnd), cy + 12, 'axis', 1.6);
      line(X(highEnd), cy - 12, X(highEnd), cy + 12, 'axis', 1.6);
      if (showOut) for (const v of s.outliers) prims.push({ t: 'dot', x: X(v), y: cy, r: 4, tone: 'accent' });
      say('boxplot', { min: trim(s.min), q1: trim(s.q1), median: trim(s.median), q3: trim(s.q3), max: trim(s.max), iqr: trim(s.iqr), n: data.length });
      if (showOut && s.outliers.length > 0) say('outliers', { values: s.outliers.map((v) => trim(v)).join(', ') });
      return out;
    }

    case 'scatter': {
      const pts: [number, number][] = [];
      const given = chart.points.slice(0, LIMITS.scatter);
      for (const [a, b] of given) {
        const x = num(a);
        const y = num(b);
        if (finite(x) && finite(y)) pts.push([x, y]);
      }
      if (given.length > pts.length) say('dropped', { k: given.length - pts.length });
      if (pts.length === 0) return out;
      const xs = pts.map(([x]) => x);
      const ys = pts.map(([, y]) => y);
      const pad = (a: number[]) => (Math.max(...a) - Math.min(...a)) * 0.1 || 1;
      const xLo = Math.min(...xs) - pad(xs);
      const xHi = Math.max(...xs) + pad(xs);
      const yLo = Math.min(...ys) - pad(ys);
      const yHi = Math.max(...ys) + pad(ys);
      const X = sx(xLo, xHi);
      const Y = sy(yLo, yHi);
      axes(xLo, xHi, yLo, yHi, niceTicks(yLo, yHi, 5));
      const fit = chart.fit === 'linear' ? regress(pts) : null;
      if (fit && chart.showResiduals && show('residuals')) {
        for (const [x, y] of pts) line(X(x), Y(y), X(x), Y(fit.slope * x + fit.intercept), 'muted', 1, true);
        say('residuals', { sse: trim(pts.reduce((a, [x, y]) => a + (y - (fit.slope * x + fit.intercept)) ** 2, 0)) });
      }
      for (const [x, y] of pts) prims.push({ t: 'dot', x: X(x), y: Y(y), r: 4, tone: 'curve1' });
      say('scatter', { n: pts.length });
      if (chart.fit === 'linear') {
        if (!fit) say('noFit');
        else if (show('fit')) {
          // The line across the plot, cut where it leaves the box (solved for x, so its slope stays the true slope).
          let a = xLo;
          let b = xHi;
          if (fit.slope !== 0) {
            const x1 = (yLo - fit.intercept) / fit.slope;
            const x2 = (yHi - fit.intercept) / fit.slope;
            a = Math.max(a, Math.min(x1, x2));
            b = Math.min(b, Math.max(x1, x2));
          }
          if (b > a) prims.push({ t: 'path', points: [[X(a), Y(fit.slope * a + fit.intercept)], [X(b), Y(fit.slope * b + fit.intercept)]], tone: 'accent', width: 2 });
          say('fit', { slope: trim(fit.slope), intercept: trim(fit.intercept), r: fit.r === null ? '—' : trim(fit.r) });
        }
      }
      return out;
    }

    case 'bar': {
      const n = Math.min(chart.categories.length, chart.values.length, LIMITS.categories);
      const vals = chart.values.slice(0, n).map(num);
      if (n === 0 || !vals.every(finite)) return out;
      const lo = Math.min(0, ...vals);
      const hi = Math.max(0, ...vals) || 1;
      const Y = sy(lo, hi * 1.08);
      const ticks = niceTicks(lo, hi, 5);
      line(X0, Y0, X0, Y1, 'axis', 1.4);
      line(X0, Y(0), X1, Y(0), 'axis', 1.4);
      for (const t of ticks) {
        line(X0, Y(t), X1, Y(t), 'grid', 0.6);
        if (show('labels')) txt(X0 - 5, Y(t) + 3, trim(t), 'end');
      }
      const slot = (X1 - X0) / n;
      vals.forEach((v, i) => {
        const x = X0 + slot * i + slot * 0.15;
        prims.push({ t: 'rect', x, y: Math.min(Y(v), Y(0)), w: slot * 0.7, h: Math.abs(Y(v) - Y(0)), tone: 'curve1', fill: 'medium' });
        const label = o.text ? o.text(chart.categories[i]!) : '';
        if (show('labels')) txt(x + slot * 0.35, Y1 + 16, cut(label, 12));
        say('barItem', { label, value: trim(v) });
      });
      return out;
    }

    case 'distribution': {
      const p = chart.params;
      const sh = chart.shade && show('shade') ? { from: num(chart.shade.from), to: num(chart.shade.to) } : null;
      const shaded = sh && finite(sh.from) && finite(sh.to) && sh.to >= sh.from ? sh : null;
      if (chart.dist === 'binomial') {
        const n = clamp(Math.round(num(p['n'])), 1, LIMITS.binomialN);
        const prob = num(p['p']);
        if (!finite(n) || !(prob >= 0 && prob <= 1)) return out;
        const pmf = program.fn(`binompmf(${n}, ${FREE}, ${src(p['p'])})`, FREE, scope);
        const values = Array.from({ length: n + 1 }, (_, k) => pmf(k));
        if (!values.every(finite)) return out;
        const top = Math.max(...values);
        const X = sx(-0.5, n + 0.5);
        const Y = sy(0, top * 1.1);
        axes(-0.5, n + 0.5, 0, top * 1.1, niceTicks(0, top, 5));
        const inside = (k: number) => shaded !== null && k >= Math.round(shaded.from) && k <= Math.round(shaded.to);
        values.forEach((v, k) => prims.push({ t: 'rect', x: X(k - 0.45), y: Y(v), w: X(k + 0.45) - X(k - 0.45), h: Y1 - Y(v), tone: inside(k) ? 'accent' : 'curve1', fill: inside(k) ? 'solid' : 'medium' }));
        say('binomial', { n, p: trim(prob) });
        if (shaded) {
          const total = values.reduce((a, v, k) => a + (inside(k) ? v : 0), 0);
          say('probability', { from: trim(Math.round(shaded.from)), to: trim(Math.round(shaded.to)), p: probText(total) });
        }
        return out;
      }
      if (chart.dist === 'uniform') {
        const a = num(p['a']);
        const b = num(p['b']);
        if (!(finite(a) && finite(b) && b > a)) return out;
        const w = b - a;
        const lo = a - w * 0.5;
        const hi = b + w * 0.5;
        const X = sx(lo, hi);
        const Y = sy(0, (1 / w) * 1.3);
        axes(lo, hi);
        const density = 1 / w;
        if (shaded) {
          const f = Math.max(a, shaded.from);
          const t = Math.min(b, shaded.to);
          if (t > f) prims.push({ t: 'poly', points: [[X(f), Y1], [X(f), Y(density)], [X(t), Y(density)], [X(t), Y1]], tone: 'accent', fill: 'medium' });
        }
        prims.push({ t: 'path', points: [[X(lo), Y1], [X(a), Y1], [X(a), Y(density)], [X(b), Y(density)], [X(b), Y1], [X(hi), Y1]], tone: 'curve1', width: 2.5 });
        say('uniform', { a: trim(a), b: trim(b) });
        if (shaded) say('probability', { from: trim(shaded.from), to: trim(shaded.to), p: probText(Math.max(0, Math.min(b, shaded.to) - Math.max(a, shaded.from)) / w) });
        return out;
      }
      // normal
      const m = num(p['mean']);
      const sd = num(p['sd']);
      if (!(finite(m) && finite(sd) && sd > 0)) return out;
      const pdf = program.fn(`normpdf(${FREE}, ${src(p['mean'])}, ${src(p['sd'])})`, FREE, scope);
      const lo = m - 4 * sd;
      const hi = m + 4 * sd;
      const top = pdf(m) * 1.12;
      if (!finite(top) || !(top > 0)) return out; // a standard deviation so small that the peak overflows
      const X = sx(lo, hi);
      const Y = sy(0, top);
      axes(lo, hi);
      const N = 120;
      const curve: [number, number][] = Array.from({ length: N + 1 }, (_, i) => {
        const x = lo + ((hi - lo) * i) / N;
        return [X(x), Y(pdf(x))];
      });
      if (shaded) {
        const f = clamp(shaded.from, lo, hi);
        const t = clamp(shaded.to, lo, hi);
        if (t > f) {
          // The area: up the left edge, along the curve between the edges, down the right edge.
          const inner: [number, number][] = [];
          for (let i = 0; i <= N; i++) {
            const x = lo + ((hi - lo) * i) / N;
            if (x > f && x < t) inner.push([X(x), Y(pdf(x))]);
          }
          prims.push({ t: 'poly', points: [[X(f), Y1], [X(f), Y(pdf(f))], ...inner, [X(t), Y(pdf(t))], [X(t), Y1]], tone: 'accent', fill: 'medium' });
        }
      }
      prims.push({ t: 'path', points: curve, tone: 'curve1', width: 2.5 });
      line(X(m), Y1, X(m), Y(pdf(m)), 'muted', 1, true);
      say('normal', { mean: trim(m), sd: trim(sd) });
      if (shaded) {
        const prob = program.evaluate(`normcdf(${src(chart.shade!.to)}, ${src(p['mean'])}, ${src(p['sd'])}) - normcdf(${src(chart.shade!.from)}, ${src(p['mean'])}, ${src(p['sd'])})`, scope);
        say('probability', { from: trim(shaded.from), to: trim(shaded.to), p: probText(prob) });
      }
      return out;
    }

    case 'simulation': {
      const trials = clamp(Math.round(num(chart.trials)), 1, LIMITS.trials);
      // Only a spinner has sectors: a coin or a die ignores the field.
      const sectors = chart.sim === 'spinner' && chart.sectors !== undefined ? clamp(Math.round(num(chart.sectors)), 2, 12) : 4;
      if (!finite(trials) || !finite(sectors)) return out;
      const k = chart.sim === 'coin' ? 2 : chart.sim === 'die' ? 6 : sectors;
      const results = outcomes(trials, k, chart.seed);
      const counts = Array.from({ length: k }, () => 0);
      for (const r of results) counts[r]!++;
      const freq = counts.map((c) => c / trials);
      const expected = 1 / k;
      const top = Math.max(...freq, expected) * 1.15;
      const Y = sy(0, top);
      const ticks = niceTicks(0, top * 100, 5);
      line(X0, Y0, X0, Y1, 'axis', 1.4);
      line(X0, Y1, X1, Y1, 'axis', 1.4);
      for (const t of ticks) {
        line(X0, Y(t / 100), X1, Y(t / 100), 'grid', 0.6);
        if (show('labels')) txt(X0 - 5, Y(t / 100) + 3, `${trim(t, 0)}%`, 'end');
      }
      const slot = (X1 - X0) / k;
      freq.forEach((f, i) => {
        const x = X0 + slot * i + slot * 0.15;
        prims.push({ t: 'rect', x, y: Y(f), w: slot * 0.7, h: Y1 - Y(f), tone: 'curve1', fill: 'medium' });
        if (show('labels')) txt(x + slot * 0.35, Y1 + 16, chart.sim === 'coin' ? (i === 0 ? (o.words?.heads ?? 'H') : (o.words?.tails ?? 'T')) : String(i + 1));
      });
      if (show('expected')) {
        line(X0, Y(expected), X1, Y(expected), 'accent', 2, true);
        say('expected', { percent: pct(expected) });
      }
      say(chart.sim === 'coin' ? 'simCoin' : chart.sim === 'die' ? 'simDie' : 'simSpinner', { trials, sectors: k });
      counts.forEach((c, i) => {
        if (chart.sim === 'coin') say(i === 0 ? 'outcomeHeads' : 'outcomeTails', { count: c, percent: pct(c / trials) });
        else say('outcome', { label: i + 1, count: c, percent: pct(c / trials) });
      });
      return out;
    }
  }
}
