/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { StatsViewer } from '../../src/features/scene';
import { bin, buildChart, generate, mean, median, mulberry32, outcomes, regress, summarize, type Built, type Chart } from '../../src/lib/stats';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { NumberModel } from '../../src/scenes/numbermodel';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 3.6: the numbers of statistics against known data sets, the seeded generator, the seven charts as pictures
// and text, and their schema. Each row of the spec's I/O matrix has a test here.

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
const MINUS = '−';

describe('the seeded generator', () => {
  it('is mulberry32: the first numbers of seed 1 are the published ones', () => {
    const r = mulberry32(1);
    expect([r(), r(), r()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    expect(mulberry32(7)()).toBe(0.011704753153026104);
  });
  it('the same seed gives the same numbers, another seed other numbers, all in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs).not.toEqual(Array.from({ length: 1000 }, () => c()));
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
    near(mean(xs), 0.5, 0.05);
  });
  it('a seed that is not a number is 0, and a fractional seed is cut', () => {
    expect(mulberry32(NaN)()).toBe(mulberry32(0)());
    expect(mulberry32(3.9)()).toBe(mulberry32(3)());
  });
  it('generated data: the same every time, a longer sample extends a shorter one, 500 at most', () => {
    const g = { dist: 'normal' as const, mean: 50, sd: 10, seed: 3 };
    expect(generate({ n: 200, ...g })).toEqual(generate({ n: 200, ...g }));
    expect(generate({ n: 20, ...g })).toEqual(generate({ n: 11, ...g }).concat(generate({ n: 20, ...g }).slice(11)));
    expect(generate({ n: 20, ...g }).slice(0, 11)).toEqual(generate({ n: 11, ...g }));
    expect(generate({ n: 9999, ...g })).toHaveLength(500);
    expect(generate({ n: 0, ...g })).toHaveLength(1); // clamped to 1 to 500
    expect(generate({ n: NaN, ...g })).toEqual([]);
    near(mean(generate({ n: 500, ...g })), 50, 2);
    near(summarize(generate({ n: 500, ...g }))!.sd, 10, 1.5);
  });
  it('uniform data has the asked mean and spread and stays in its range; bad input is no data', () => {
    const u = generate({ n: 500, dist: 'uniform', mean: 10, sd: 2, seed: 5 });
    const half = 2 * Math.sqrt(3);
    expect(u.every((v) => v >= 10 - half && v <= 10 + half)).toBe(true);
    near(mean(u), 10, 0.4);
    expect(generate({ n: 10, dist: 'normal', mean: NaN, sd: 1, seed: 1 })).toEqual([]);
    expect(generate({ n: 10, dist: 'normal', mean: 0, sd: -1, seed: 1 })).toEqual([]);
  });
  it('the first trials of an experiment are a prefix of a longer one, and every face is about equally common', () => {
    expect(outcomes(10, 6, 7)).toEqual(outcomes(20, 6, 7).slice(0, 10));
    const six = outcomes(6000, 6, 7);
    const counts = [0, 1, 2, 3, 4, 5].map((k) => six.filter((o) => o === k).length);
    for (const c of counts) near(c, 1000, 120);
    expect(Math.max(...six)).toBe(5);
    expect(Math.min(...six)).toBe(0);
  });
});

describe('descriptive statistics against known data', () => {
  it('1 to 10: mean 5.5, median 5.5, quartiles 3 and 8, IQR 5, sample sd 3.0277', () => {
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
    expect([s.n, s.mean, s.median, s.q1, s.q3, s.iqr, s.min, s.max]).toEqual([10, 5.5, 5.5, 3, 8, 5, 1, 10]);
    near(s.sd, 3.02765, 1e-5);
  });
  it('an odd count leaves the middle value out of the halves: 1 to 9 has quartiles 2.5 and 7.5', () => {
    const s = summarize([9, 1, 8, 2, 7, 3, 6, 4, 5])!;
    expect([s.median, s.q1, s.q3]).toEqual([5, 2.5, 7.5]);
  });
  it('30 beside 1 to 9 is an outlier, and the whisker stops at 9', () => {
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 30])!;
    expect(s.outliers).toEqual([30]);
    expect([s.whiskerLow, s.whiskerHigh]).toEqual([1, 9]);
    expect(summarize([1, 2, 3, 4, 5])!.outliers).toEqual([]);
  });
  it('one value, no data, and values that are not numbers', () => {
    const one = summarize([4])!;
    expect([one.mean, one.median, one.q1, one.q3, one.sd]).toEqual([4, 4, 4, 4, 0]);
    expect(summarize([])).toBeNull();
    expect(summarize([NaN, Infinity])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(mean([])).toBeNaN();
  });
  it('the fit of Anscombe’s first set: slope 0.5, intercept 3, r 0.8164', () => {
    const x = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
    const y1 = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
    const f = regress(x.map((v, i) => [v, y1[i]!]))!;
    near(f.slope, 0.5001, 1e-3);
    near(f.intercept, 3.0001, 1e-3);
    near(f.r!, 0.8164, 1e-3);
    const y2 = [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74]; // the second set has the same fit
    const g = regress(x.map((v, i) => [v, y2[i]!]))!;
    near(g.slope, 0.5, 2e-3);
    near(g.r!, 0.8162, 1e-3);
  });
  it('an exact line has r = 1, a falling one r = -1, flat y has no r; one point or equal x has no line', () => {
    near(regress([[0, 1], [1, 3], [2, 5]])!.r!, 1, 1e-12);
    near(regress([[0, 5], [1, 3], [2, 1]])!.r!, -1, 1e-12);
    expect(regress([[0, 2], [1, 2], [2, 2]])).toMatchObject({ slope: 0, intercept: 2, r: null });
    expect(regress([[1, 1]])).toBeNull();
    expect(regress([[2, 1], [2, 5]])).toBeNull();
    expect(regress([[NaN, 1], [1, 1]])).toBeNull();
  });
  it('bins: the counts add up, the largest value is in the last bin; equal values are one bin of width 1', () => {
    const data = Array.from({ length: 20 }, (_, i) => i + 1);
    const b = bin(data, 5);
    expect(b.counts).toEqual([4, 4, 4, 4, 4]);
    expect(b.edges[0]).toBe(1);
    expect(b.edges[5]).toBe(20);
    expect(bin([3, 3, 3], 5)).toEqual({ edges: [2.5, 3.5], counts: [3] });
    expect(bin([], 5)).toEqual({ edges: [], counts: [] });
    expect(bin([0, 10], 2).counts).toEqual([1, 1]);
  });
});

const build = (chart: Chart, params: Record<string, number> = {}, hidden?: Set<string>): Built => {
  const program = createProgram(Object.keys(params));
  return buildChart({ chart, program, scope: program.scope(params), hidden, text: (l) => ('text' in l ? (l.text['en'] ?? '') : l.latex) });
};
const sentence = (b: Built, key: string) => b.sentences.find((s) => s.key === key);
const keys = (b: Built) => b.sentences.map((s) => s.key);
const count = (b: Built, t: string) => b.prims.filter((p) => p.t === t).length;
const texts = (b: Built) => (b.prims.filter((p) => p.t === 'text') as any[]).map((p) => p.text as string);

describe('dot plot and histogram', () => {
  it('3, 3, 3, 5 is a stack of three and one dot', () => {
    const b = build({ kind: 'dotPlot', data: [3, 3, 3, 5] });
    expect(count(b, 'dot')).toBe(4);
    expect(sentence(b, 'dotPlot')!.values).toEqual({ n: 4, min: '3', max: '5', median: '3' });
    const ys = (b.prims.filter((p) => p.t === 'dot') as any[]).filter((p) => p.x === (b.prims.filter((q) => q.t === 'dot') as any[])[0].x);
    expect(ys).toHaveLength(3);
  });
  it('more than 100 values: the first 100; values that are not numbers are left out and counted', () => {
    expect(count(build({ kind: 'dotPlot', data: Array.from({ length: 150 }, (_, i) => i) }), 'dot')).toBe(100);
    const b = build({ kind: 'dotPlot', data: [1, NaN, 2, Infinity] as number[] });
    expect(sentence(b, 'dropped')!.values).toEqual({ k: 2 });
    expect(sentence(b, 'dotPlot')!.values['n']).toBe(2);
    expect(build({ kind: 'dotPlot', data: [] }).prims).toEqual([]);
  });
  const hist = (bins: number | string, extra: object = {}): Chart => ({ kind: 'histogram', data: Array.from({ length: 20 }, (_, i) => i + 1), bins, ...extra }) as Chart;
  it('20 values in 5 bins: the counts add up and the bars are drawn; the mean and median lines on request', () => {
    const b = build(hist(5, { showMean: true, showMedian: true }));
    expect(sentence(b, 'histogram')!.values).toEqual({ n: 20, bins: 5, tallest: 4, from: '1', to: '20' });
    expect(b.prims.filter((p) => p.t === 'rect')).toHaveLength(5);
    expect(sentence(b, 'mean')!.values).toEqual({ v: '10.5' });
    expect(sentence(b, 'median')!.values).toEqual({ v: '10.5' });
    expect(keys(build(hist(5)))).not.toContain('mean');
  });
  it('the bins slider: bins follow a parameter, and are clamped to 2 and 40', () => {
    const at = (n: number) => sentence(build(hist('k'), { k: n }), 'histogram')!.values['bins'];
    expect([at(5), at(12), at(1), at(90)]).toEqual([5, 12, 2, 40]);
  });
  it('all values equal is one bar; hidden parts take the lines and their sentences away', () => {
    expect(build({ kind: 'histogram', data: [4, 4, 4], bins: 5 }).prims.filter((p) => p.t === 'rect')).toHaveLength(1);
    const hidden = build(hist(5, { showMean: true, showMedian: true }), {}, new Set(['mean', 'median', 'zzz']));
    expect(keys(hidden)).not.toContain('mean');
    expect(keys(hidden)).not.toContain('median');
    expect(hidden.prims.filter((p) => p.t === 'line' && (p as any).dash)).toEqual([]);
  });
  it('generated data: the same picture every time, and the mean is near the asked one', () => {
    const chart: Chart = { kind: 'histogram', data: { gen: { n: 200, dist: 'normal', mean: 50, sd: 10, seed: 3 } }, bins: 10, showMean: true };
    expect(JSON.stringify(build(chart))).toBe(JSON.stringify(build(chart)));
    near(Number(sentence(build(chart), 'mean')!.values['v']), 50, 2);
    expect(sentence(build(chart), 'histogram')!.values['n']).toBe(200);
    const big = build({ ...chart, data: { gen: { n: 5000, dist: 'normal', seed: 3 } } } as Chart);
    expect(sentence(big, 'histogram')!.values['n']).toBe(500);
  });
});

describe('box plot', () => {
  const box = (data: number[], showOutliers = true): Chart => ({ kind: 'boxplot', data, showOutliers });
  it('the five numbers and the IQR of 1 to 10', () => {
    expect(sentence(build(box([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), 'boxplot')!.values).toEqual({ min: '1', q1: '3', median: '5.5', q3: '8', max: '10', iqr: '5', n: 10 });
  });
  it('30 is an outlier dot with showOutliers, and the whisker ends at 9; without it the whisker reaches 30', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 30];
    const withOut = build(box(data));
    expect(count(withOut, 'dot')).toBe(1);
    expect(sentence(withOut, 'outliers')!.values).toEqual({ values: '30' });
    const dotX = (withOut.prims.find((p) => p.t === 'dot') as any).x;
    const whisker = (withOut.prims.filter((p) => p.t === 'line') as any[]).filter((l) => l.width === 1.6 && l.y1 === l.y2).map((l) => Math.max(l.x1, l.x2));
    expect(Math.max(...whisker)).toBeLessThan(dotX);
    const without = build(box(data, false));
    expect(count(without, 'dot')).toBe(0);
    expect(keys(without)).not.toContain('outliers');
  });
  it('no outliers: no dots; no data: nothing', () => {
    expect(count(build(box([1, 2, 3, 4, 5])), 'dot')).toBe(0);
    expect(build(box([])).prims).toEqual([]);
  });
});

describe('scatter plot with a fitted line', () => {
  const X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
  const Y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
  const points = X.map((x, i) => [x, Y[i]!] as [number, number]);
  it('Anscombe set I: 11 dots, a line, slope 0.5001, intercept 3.0001, r 0.8164', () => {
    const b = build({ kind: 'scatter', points, fit: 'linear' });
    expect(count(b, 'dot')).toBe(11);
    expect(count(b, 'path')).toBe(1);
    expect(sentence(b, 'fit')!.values).toEqual({ slope: '0.5001', intercept: '3.0001', r: '0.8164' });
  });
  it('residuals: a segment from each point to the line, and their squared sum', () => {
    const b = build({ kind: 'scatter', points, fit: 'linear', showResiduals: true });
    expect(b.prims.filter((p) => p.t === 'line' && (p as any).dash)).toHaveLength(11);
    near(Number(sentence(b, 'residuals')!.values['sse']), 13.7627, 1e-3);
  });
  it('hidden fit and residuals; no fit asked; one point or equal x says so', () => {
    expect(count(build({ kind: 'scatter', points, fit: 'linear' }, {}, new Set(['fit'])), 'path')).toBe(0);
    expect(count(build({ kind: 'scatter', points }), 'path')).toBe(0);
    expect(keys(build({ kind: 'scatter', points: [[1, 1]], fit: 'linear', showResiduals: true }))).toEqual(['scatter', 'noFit']);
    expect(keys(build({ kind: 'scatter', points: [[2, 1], [2, 5]], fit: 'linear' }))).toContain('noFit');
  });
  it('a point is a number or an expression of a parameter, so a slider moves it', () => {
    const at = (v: number) => sentence(build({ kind: 'scatter', points: [[0, 0], [1, 1], [2, 'h']], fit: 'linear' }, { h: v }), 'fit')!.values['slope'];
    expect(at(2)).toBe('1');
    expect(at(4)).toBe('2');
  });
  it('points that cannot be computed are left out; more than 100 are cut to 100; none is nothing', () => {
    expect(sentence(build({ kind: 'scatter', points: [[1, 1], [2, '1/0'], [3, 3]] }), 'scatter')!.values).toEqual({ n: 2 });
    expect(sentence(build({ kind: 'scatter', points: Array.from({ length: 150 }, (_, i) => [i, i] as [number, number]) }), 'scatter')!.values).toEqual({ n: 100 });
    expect(build({ kind: 'scatter', points: [['nope(', 1]] }).prims).toEqual([]);
  });
});

describe('bar chart', () => {
  it('3 categories and 3 values: 3 bars with labels; the shorter list wins; more than 12 are cut', () => {
    const cats = ['a', 'b', 'c'].map((t) => ({ text: { en: t } }));
    const b = build({ kind: 'bar', categories: cats, values: [3, 5, 2] });
    expect(b.prims.filter((p) => p.t === 'rect')).toHaveLength(3);
    expect(texts(b)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(b.sentences.map((s) => s.values['value'])).toEqual(['3', '5', '2']);
    expect(b.prims.filter((p) => p.t === 'rect')).toHaveLength(3);
    expect(build({ kind: 'bar', categories: cats, values: [3, 5] }).prims.filter((p) => p.t === 'rect')).toHaveLength(2);
    expect(build({ kind: 'bar', categories: Array.from({ length: 20 }, () => ({ text: { en: 'x' } })), values: Array.from({ length: 20 }, () => 1) }).prims.filter((p) => p.t === 'rect')).toHaveLength(12);
  });
  it('a negative value is a bar below the axis; a value that cannot be computed draws nothing', () => {
    const b = build({ kind: 'bar', categories: [{ text: { en: 'a' } }, { text: { en: 'b' } }], values: [4, -2] });
    expect(b.prims.filter((p) => p.t === 'rect')).toHaveLength(2);
    expect(build({ kind: 'bar', categories: [{ text: { en: 'a' } }], values: ['1/0'] }).prims).toEqual([]);
  });
});

describe('distributions and their shaded probability', () => {
  const normal = (extra: object = {}, params: Record<string, number | string> = { mean: 0, sd: 1 }): Chart => ({ kind: 'distribution', dist: 'normal', params, ...extra }) as Chart;
  const prob = (b: Built) => sentence(b, 'probability')!.values['p'];
  it('normal: within one standard deviation is 0.6827, within two 0.9545', () => {
    const one = build(normal({ shade: { from: -1, to: 1 } }));
    expect(prob(one)).toBe('0.6827');
    expect(count(one, 'poly')).toBe(1);
    expect(count(one, 'path')).toBe(1);
    expect(prob(build(normal({ shade: { from: -2, to: 2 } })))).toBe('0.9545');
    expect(prob(build(normal({ shade: { from: 0, to: 100 } })))).toBe('0.5');
  });
  it('the mean and the standard deviation sliders reshape it and move the probability', () => {
    const c = normal({ shade: { from: 'lo', to: 'hi' } }, { mean: 'mu', sd: 'sg' });
    const at = (mu: number, sg: number) => prob(build(c, { mu, sg, lo: -1, hi: 1 }));
    expect(at(0, 1)).toBe('0.6827');
    expect(at(0, 2)).toBe('0.3829');
    expect(at(1, 1)).toBe('0.4772');
    expect(JSON.stringify(build(c, { mu: 0, sg: 1, lo: -1, hi: 1 }).prims)).not.toBe(JSON.stringify(build(c, { mu: 0, sg: 2, lo: -1, hi: 1 }).prims));
  });
  it('a standard deviation that is zero, below zero or not a number draws nothing', () => {
    for (const sd of [0, -1, '0/0']) expect(build(normal({}, { mean: 0, sd })).prims).toEqual([]);
    expect(build(normal({}, { mean: 'nope(', sd: 1 })).prims).toEqual([]);
  });
  it('binomial: n 10, p 0.5, the bar at 5 is shaded and its probability is 0.2461', () => {
    const b = build({ kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5 }, shade: { from: 5, to: 5 } });
    expect(prob(b)).toBe('0.2461');
    expect(b.prims.filter((p) => p.t === 'rect' && (p as any).tone === 'accent')).toHaveLength(1);
    expect(b.prims.filter((p) => p.t === 'rect')).toHaveLength(11);
    expect(prob(build({ kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5 }, shade: { from: 0, to: 10 } }))).toBe('1');
    expect(prob(build({ kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5 }, shade: { from: 3, to: 7 } }))).toBe('0.8906');
  });
  it('binomial limits: n over 100 is 100; p outside 0 to 1 draws nothing', () => {
    expect(build({ kind: 'distribution', dist: 'binomial', params: { n: 500, p: 0.5 } }).prims.filter((p) => p.t === 'rect')).toHaveLength(101);
    expect(build({ kind: 'distribution', dist: 'binomial', params: { n: 10, p: 1.5 } }).prims).toEqual([]);
  });
  it('uniform from 2 to 6: the probability between 3 and 5 is 0.5; b not above a draws nothing', () => {
    const b = build({ kind: 'distribution', dist: 'uniform', params: { a: 2, b: 6 }, shade: { from: 3, to: 5 } });
    expect(prob(b)).toBe('0.5');
    expect(count(b, 'poly')).toBe(1);
    expect(prob(build({ kind: 'distribution', dist: 'uniform', params: { a: 2, b: 6 }, shade: { from: 0, to: 10 } }))).toBe('1');
    expect(build({ kind: 'distribution', dist: 'uniform', params: { a: 6, b: 2 } }).prims).toEqual([]);
  });
  it('a hidden `shade` takes the area and the probability away; a shade backwards or not a number is not drawn', () => {
    const c = normal({ shade: { from: -1, to: 1 } });
    const hidden = build(c, {}, new Set(['shade']));
    expect(count(hidden, 'poly')).toBe(0);
    expect(keys(hidden)).not.toContain('probability');
    expect(keys(build(normal({ shade: { from: 1, to: -1 } })))).not.toContain('probability');
    expect(keys(build(normal({ shade: { from: 'nope(', to: 1 } })))).not.toContain('probability');
  });
});

describe('simulations', () => {
  const sim = (sim: 'coin' | 'die' | 'spinner', trials: number | string, extra: object = {}): Chart => ({ kind: 'simulation', sim, trials, seed: 7, ...extra }) as Chart;
  it('600 rolls of a die: six bars, an expected line, the counts add to 600', () => {
    const b = build(sim('die', 600));
    expect(b.prims.filter((p) => p.t === 'rect')).toHaveLength(6);
    const counts = b.sentences.filter((s) => s.key === 'outcome').map((s) => s.values['count'] as number);
    expect(counts).toHaveLength(6);
    expect(counts.reduce((a, c) => a + c, 0)).toBe(600);
    expect(sentence(b, 'expected')!.values).toEqual({ percent: '16.7' });
    expect(b.prims.filter((p) => p.t === 'line' && (p as any).dash)).toHaveLength(1);
  });
  it('the same seed is the same experiment; trials 10 then 20 keep the first 10 outcomes', () => {
    expect(JSON.stringify(build(sim('die', 600)))).toBe(JSON.stringify(build(sim('die', 600))));
    const at = (n: number) => build(sim('die', 'n'), { n }).sentences.filter((s) => s.key === 'outcome').map((s) => s.values['count'] as number);
    const ten = at(10);
    const twenty = at(20);
    for (let i = 0; i < 6; i++) expect(twenty[i]!).toBeGreaterThanOrEqual(ten[i]!);
    expect(ten.reduce((a, c) => a + c, 0)).toBe(10);
    expect(twenty.reduce((a, c) => a + c, 0)).toBe(20);
    expect(JSON.stringify(build(sim('die', 600, { seed: 8 })))).not.toBe(JSON.stringify(build(sim('die', 600))));
  });
  it('with many trials each face is near one in six', () => {
    const b = build(sim('die', 1000));
    for (const s of b.sentences.filter((x) => x.key === 'outcome')) near(Number(s.values['percent']), 16.7, 4);
  });
  it('coin: two outcomes, heads and tails; spinner: its sectors', () => {
    const coin = build(sim('coin', 100));
    expect(keys(coin)).toEqual(['expected', 'simCoin', 'outcomeHeads', 'outcomeTails']);
    expect((sentence(coin, 'outcomeHeads')!.values['count'] as number) + (sentence(coin, 'outcomeTails')!.values['count'] as number)).toBe(100);
    expect(build(sim('spinner', 100, { sectors: 5 })).prims.filter((p) => p.t === 'rect')).toHaveLength(5);
    expect(build(sim('spinner', 100)).prims.filter((p) => p.t === 'rect')).toHaveLength(4);
  });
  it('trials 0 or 5000 are clamped to 1 and 1000; sectors 1 or 20 to 2 and 12', () => {
    expect(sentence(build(sim('die', 0)), 'simDie')!.values['trials']).toBe(1);
    expect(sentence(build(sim('die', 5000)), 'simDie')!.values['trials']).toBe(1000);
    expect(build(sim('spinner', 10, { sectors: 1 })).prims.filter((p) => p.t === 'rect')).toHaveLength(2);
    expect(build(sim('spinner', 10, { sectors: 20 })).prims.filter((p) => p.t === 'rect')).toHaveLength(12);
    expect(build(sim('die', '1/0')).prims).toEqual([]);
  });
  it('the expected line can be hidden by a step', () => {
    const b = build(sim('die', 60), {}, new Set(['expected']));
    expect(keys(b)).not.toContain('expected');
    expect(b.prims.some((p) => p.t === 'line' && (p as any).dash)).toBe(false);
  });
});

describe('the schema (stats@1) and the fixtures', () => {
  const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
  const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
  const ok = (name: string, edit: (d: any) => void) => {
    const d = load(name);
    edit(d);
    return validator.validate(d).ok;
  };
  it('both fixture topics pass', () => {
    for (const name of ['stats-normal-distribution', 'stats-dice']) {
      const r = validator.validate(load(name));
      expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
    }
  });
  it('accepts every chart kind', () => {
    const charts = [
      { kind: 'dotPlot', data: [1, 2, 2, 3] },
      { kind: 'histogram', data: { gen: { n: 100, dist: 'normal', mean: 5, sd: 1, seed: 1 } }, bins: 'tr', showMean: true, showMedian: true },
      { kind: 'boxplot', data: [1, 2, 3, 4, 50], showOutliers: true },
      { kind: 'scatter', points: [[1, 2], [3, 'tr']], fit: 'linear', showResiduals: true },
      { kind: 'bar', categories: [{ text: { en: 'a', ur: 'ا' } }], values: [3] },
      { kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5 }, shade: { from: 3, to: 5 } },
      { kind: 'simulation', sim: 'spinner', trials: 'tr', seed: 3, sectors: 5 },
    ];
    for (const chart of charts) expect(ok('stats-dice', (d) => (d.scene.chart = chart)), chart.kind).toBe(true);
  });
  it('refuses an unknown kind, an unknown key, too much data, a float seed, 13 categories, dragging and the probability tree', () => {
    expect(ok('stats-dice', (d) => (d.scene.chart.kind = 'pie'))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart.extra = 1))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart = { kind: 'histogram', data: Array.from({ length: 501 }, (_, i) => i), bins: 5 }))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart = { kind: 'dotPlot', data: Array.from({ length: 101 }, (_, i) => i) }))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart.seed = 1.5))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart = { kind: 'bar', categories: Array.from({ length: 13 }, () => ({ text: { en: 'a', ur: 'ا' } })), values: [1] }))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart = { kind: 'scatter', points: [[1, 2]], drag: [{ index: 0 }] }))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart = { kind: 'probabilityTree', branches: [] }))).toBe(false);
    expect(ok('stats-dice', (d) => (d.scene.chart.sim = 'roulette'))).toBe(false);
    expect(ok('stats-dice', (d) => delete d.scene.chart)).toBe(false);
  });
  it('the formula checks of both topics come out as the topics say', () => {
    for (const name of ['stats-normal-distribution', 'stats-dice']) {
      const topic = load(name);
      const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
      const defaults = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
      for (const f of topic.formulas) {
        for (const check of f.checks) {
          const scope = program.scope({ ...defaults, ...check.at });
          for (const [key, expected] of Object.entries(check.expect) as [string, number][]) {
            expect(Math.abs(program.evaluate(f.bind[key].expr, scope) - expected), `${name} ${f.id}.${key}`).toBeLessThanOrEqual(0.5 * 10 ** -f.bind[key].decimals);
          }
        }
      }
    }
  });
});

describe('every message resolves (English and Urdu)', () => {
  it('no key, brace or placeholder is left', () => {
    const cat = (t: string) => ({ text: { en: t } });
    const all: Chart[] = [
      { kind: 'dotPlot', data: [1, NaN, 3] as number[] },
      { kind: 'histogram', data: [1, 2, 3, 4], bins: 3, showMean: true, showMedian: true },
      { kind: 'boxplot', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 30], showOutliers: true },
      { kind: 'scatter', points: [[1, 1], [2, 3], [3, 2]], fit: 'linear', showResiduals: true },
      { kind: 'scatter', points: [[1, 1]], fit: 'linear' },
      { kind: 'bar', categories: [cat('a')], values: [3] },
      { kind: 'distribution', dist: 'normal', params: { mean: 0, sd: 1 }, shade: { from: -1, to: 1 } },
      { kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5 }, shade: { from: 3, to: 5 } },
      { kind: 'distribution', dist: 'uniform', params: { a: 0, b: 2 }, shade: { from: 0, to: 1 } },
      { kind: 'simulation', sim: 'coin', trials: 10, seed: 1 },
      { kind: 'simulation', sim: 'die', trials: 10, seed: 1 },
      { kind: 'simulation', sim: 'spinner', trials: 10, seed: 1, sectors: 5 },
    ];
    for (const [locale, messages] of [['en', en], ['ur', ur]] as const) {
      const t = createTranslator({ locale, messages: messages as any, namespace: 'stats' });
      for (const chart of all) {
        for (const s of build(chart).sentences) expect(t(`sentence.${s.key}` as any, s.values as any), `${locale} ${chart.kind} ${s.key}`).not.toMatch(/stats\.|sentence\.|[{}]/);
      }
    }
  });
});

describe('the viewer (server HTML)', () => {
  const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
  const html = (name: string, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
    renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(StatsViewer, { topic: load(name), ...props }) }));
  it('the normal distribution: the picture, the shaded area and the probability', () => {
    const out = html('stats-normal-distribution');
    expect(out).toContain('data-number-model');
    expect(out).toContain(`The probability of a value from ${MINUS}1 to 1 is 0.6827.`);
    expect(out).toContain('A normal distribution with mean 0 and standard deviation 1.');
    expect(html('stats-normal-distribution', 'en', { step: { index: 0, params: {}, hidden: new Set(['shade']) } })).not.toContain('The probability of a value');
  });
  it('the die: the outcomes and the expected share', () => {
    const out = html('stats-dice');
    expect(out).toContain('60 rolls of a die.');
    expect(out).toContain('Each result is expected 16.7% of the time.');
    expect((out.match(/\(\d+(\.\d)?%\)\./g) ?? []).length).toBe(6);
  });
  it('is in Urdu on /ur with the picture kept left to right', () => {
    const urdu = html('stats-normal-distribution', 'ur');
    expect(urdu).toContain('امکان');
    expect(urdu).toContain('dir="ltr"');
    expect(html('stats-dice', 'ur')).toContain('پانسے کی 60 چالیں۔');
  });
  it('every chart renders to static markup with no listeners, hex colors or NaN', () => {
    const charts: Chart[] = [
      { kind: 'dotPlot', data: [3, 3, 3, 5] },
      { kind: 'histogram', data: Array.from({ length: 50 }, (_, i) => i % 7), bins: 7, showMean: true },
      { kind: 'boxplot', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 30], showOutliers: true },
      { kind: 'scatter', points: [[1, 1], [2, 3], [3, 2]], fit: 'linear', showResiduals: true },
      { kind: 'distribution', dist: 'normal', params: { mean: 0, sd: 1 }, shade: { from: -1, to: 1 } },
      { kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5 }, shade: { from: 3, to: 5 } },
      { kind: 'distribution', dist: 'uniform', params: { a: 0, b: 2 }, shade: { from: 0, to: 1 } },
      { kind: 'simulation', sim: 'die', trials: 600, seed: 7 },
    ];
    for (const chart of charts) {
      const markup = renderToStaticMarkup(createElement(NumberModel, { prims: build(chart).prims }));
      expect(markup, chart.kind).not.toMatch(/ on[A-Z]\w+=|onclick/i);
      expect(markup, chart.kind).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/);
      expect(markup, chart.kind).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('review patches (Story 3.6)', () => {
  const markup = (b: Built) => renderToStaticMarkup(createElement(NumberModel, { prims: b.prims }));
  const normal = (shade: object | undefined, params: Record<string, number | string> = { mean: 0, sd: 1 }): Chart => ({ kind: 'distribution', dist: 'normal', params, ...(shade ? { shade } : {}) }) as Chart;
  const prob = (b: Built) => b.sentences.find((s) => s.key === 'probability')!.values['p'];

  it('the shaded area is a filled closed path in the picture, and gone when hidden', () => {
    const shaded = /<path[^>]* Z"[^>]*fill-opacity/;
    expect(markup(build(normal({ from: -1, to: 1 })))).toMatch(shaded);
    expect(markup(build({ kind: 'distribution', dist: 'uniform', params: { a: 0, b: 2 }, shade: { from: 0, to: 1 } }))).toMatch(shaded);
    expect(markup(build(normal({ from: -1, to: 1 }), {}, new Set(['shade'])))).not.toMatch(shaded);
  });
  it('hidden `residuals` and hidden `labels`', () => {
    const scatter: Chart = { kind: 'scatter', points: [[1, 1], [2, 3], [3, 2]], fit: 'linear', showResiduals: true };
    const noRes = build(scatter, {}, new Set(['residuals']));
    expect(keys(noRes)).not.toContain('residuals');
    expect(noRes.prims.filter((p) => p.t === 'line' && (p as any).dash)).toEqual([]);
    const charts: Chart[] = [scatter, { kind: 'histogram', data: [1, 2, 3, 4], bins: 2 }, { kind: 'bar', categories: [{ text: { en: 'a' } }], values: [1] }, { kind: 'simulation', sim: 'die', trials: 10, seed: 1 }];
    for (const c of charts) expect(texts(build(c, {}, new Set(['labels']))), c.kind).toEqual([]);
    expect(texts(build(charts[1]!)).length).toBeGreaterThan(0);
  });
  it('an unknown part id changes nothing, for every chart kind', () => {
    const charts: Chart[] = [
      { kind: 'dotPlot', data: [1, 2, 3] },
      { kind: 'histogram', data: [1, 2, 3], bins: 3, showMean: true },
      { kind: 'boxplot', data: [1, 2, 3, 40], showOutliers: true },
      { kind: 'scatter', points: [[1, 1], [2, 3]], fit: 'linear' },
      { kind: 'bar', categories: [{ text: { en: 'a' } }], values: [1] },
      normal({ from: -1, to: 1 }),
      { kind: 'simulation', sim: 'coin', trials: 10, seed: 1 },
    ];
    for (const c of charts) expect(JSON.stringify(build(c, {}, new Set(['zzz']))), c.kind).toBe(JSON.stringify(build(c)));
  });
  it('a binomial whose n and p are parameters follows them', () => {
    const c: Chart = { kind: 'distribution', dist: 'binomial', params: { n: 'nn', p: 'pp' }, shade: { from: 3, to: 3 } };
    expect(prob(build(c, { nn: 10, pp: 0.3 }))).toBe('0.2668');
    expect(prob(build(c, { nn: 10, pp: 0.5 }))).toBe('0.1172');
    expect(prob(build(c, { nn: 20, pp: 0.5 }))).toBe('0.0011');
  });
  it('a topic parameter named x does not shadow the density’s own variable', () => {
    const b = build(normal({ from: 4, to: 6 }, { mean: 'x', sd: 1 }), { x: 5 });
    expect(prob(b)).toBe('0.6827');
    const pmf = build({ kind: 'distribution', dist: 'binomial', params: { n: 10, p: 'x' }, shade: { from: 5, to: 5 } }, { x: 0.5 });
    expect(prob(pmf)).toBe('0.2461');
  });
  it('a real but tiny probability is "<0.0001", not 0; an exact zero or one stays as it is', () => {
    expect(prob(build(normal({ from: 4, to: 5 })))).toBe('<0.0001');
    expect(prob(build({ kind: 'distribution', dist: 'uniform', params: { a: 0, b: 2 }, shade: { from: 5, to: 6 } }))).toBe('0');
  });
  it('a standard deviation so small that the peak overflows draws nothing', () => {
    expect(build(normal(undefined, { mean: 0, sd: 1e-320 })).prims).toEqual([]);
  });
  it('the fitted line is cut where it leaves the plot, not bent', () => {
    const b = build({ kind: 'scatter', points: [[0, 0], [1, 10], [2, 19], [3, 32], [4, 38]], fit: 'linear' });
    const line = b.prims.find((p) => p.t === 'path') as any;
    const [[ax, ay], [bx, by]] = line.points as [[number, number], [number, number]];
    for (const y of [ay, by]) {
      expect(y).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(y).toBeLessThanOrEqual(250 + 1e-6);
    }
    // the slope in the picture is the slope of the data, scaled: it is the same for the whole line
    const fit = regress([[0, 0], [1, 10], [2, 19], [3, 32], [4, 38]])!;
    const dots = b.prims.filter((p) => p.t === 'dot') as any[];
    const px = (dots[4].x - dots[0].x) / 4;
    const py = (dots[4].y - dots[0].y) / (38 - 0);
    near((by - ay) / (bx - ax), (fit.slope * py) / px, 1e-9);
    expect(bx).toBeGreaterThan(ax);
  });
  it('a coin’s letters come from the visitor’s language; a coin or die ignores `sectors`', () => {
    const program = createProgram([]);
    const coin = buildChart({ chart: { kind: 'simulation', sim: 'coin', trials: 10, seed: 1 }, program, scope: program.scope({}), words: { heads: 'چ', tails: 'پ' } });
    expect(texts(coin)).toEqual(expect.arrayContaining(['چ', 'پ']));
    expect(texts(build({ kind: 'simulation', sim: 'coin', trials: 10, seed: 1 }))).toEqual(expect.arrayContaining(['H', 'T']));
    expect(build({ kind: 'simulation', sim: 'die', trials: 10, seed: 1, sectors: '0/0' }).prims.filter((p) => p.t === 'rect')).toHaveLength(6);
  });
  it('"values left out" is still said when nothing is left, and for a scatter', () => {
    const none = build({ kind: 'dotPlot', data: [NaN, Infinity] as number[] });
    expect(none.prims).toEqual([]);
    expect(none.sentences).toEqual([{ key: 'dropped', values: { k: 2 } }]);
    const sc = build({ kind: 'scatter', points: [[1, 1], [2, '1/0'], [3, 3]] });
    expect(sentence(sc, 'dropped')!.values).toEqual({ k: 1 });
    expect(build({ kind: 'dotPlot', data: [] }).sentences).toEqual([]);
  });
  it('a long label is cut between characters, not inside one', () => {
    const b = build({ kind: 'bar', categories: [{ text: { en: '😀'.repeat(13) } }], values: [1] });
    expect(texts(b)).toContain('😀'.repeat(12));
    expect(texts(build({ kind: 'bar', categories: [{ text: { en: 'abcdefghijklm' } }], values: [1] }))).toContain('abcdefghijkl');
  });
  it('the schema: the right params for the distribution, a value for each category, a 32-bit seed', () => {
    const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
    const ok = (chart: unknown) => {
      const d = JSON.parse(readFileSync('content/fixtures/stats-dice.json', 'utf8'));
      d.scene.chart = chart;
      return validator.validate(d).ok;
    };
    expect(ok({ kind: 'distribution', dist: 'normal', params: { mean: 0, sd: 1 } })).toBe(true);
    expect(ok({ kind: 'distribution', dist: 'normal', params: { n: 10, p: 0.5 } })).toBe(false);
    expect(ok({ kind: 'distribution', dist: 'normal', params: { mean: 0 } })).toBe(false);
    expect(ok({ kind: 'distribution', dist: 'binomial', params: { n: 10, p: 0.5, extra: 1 } })).toBe(false);
    expect(ok({ kind: 'distribution', dist: 'uniform', params: { a: 0, b: 1 } })).toBe(true);
    const cat = { text: { en: 'a', ur: 'ا' } };
    expect(ok({ kind: 'bar', categories: [cat, cat], values: [1] })).toBe(false);
    expect(ok({ kind: 'bar', categories: [cat], values: [1] })).toBe(true);
    expect(ok({ kind: 'simulation', sim: 'die', trials: 10, seed: -1 })).toBe(false);
    expect(ok({ kind: 'simulation', sim: 'die', trials: 10, seed: 4294967296 })).toBe(false);
    expect(ok({ kind: 'simulation', sim: 'die', trials: 10, seed: 4294967295 })).toBe(true);
  });
  it('the coin letters resolve in both languages', () => {
    for (const [locale, messages] of [['en', en], ['ur', ur]] as const) {
      const t = createTranslator({ locale, messages: messages as any, namespace: 'stats' });
      expect(t('words.heads' as any)).not.toMatch(/stats\./);
      expect(t('words.tails' as any)).not.toMatch(/stats\./);
    }
  });
});
