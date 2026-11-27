/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { NumberModelViewer, type NumberModelTopic } from '../../src/features/scene';
import { buildModel, lowest, type Built, type Model } from '../../src/lib/numbermodel';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { NumberModel } from '../../src/scenes/numbermodel';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 3.3: the seven kinds of number-model@1 as pictures, controls and sentences; every row of the spec's
// I/O matrix has a test here.

const build = (model: Model, params: Record<string, number> = {}, hidden?: Set<string>): Built => {
  const program = createProgram(Object.keys(params));
  return buildModel({ model, program, scope: program.scope(params), params: new Set(Object.keys(params)), hidden });
};
const rects = (b: Built) => b.prims.filter((p) => p.t === 'rect');
const filled = (b: Built) => rects(b).filter((p: any) => p.fill === 'medium');
const keys = (b: Built) => b.sentences.map((s) => s.key);
const sentence = (b: Built, key: string) => b.sentences.find((s) => s.key === key);

describe('fractions in lowest terms', () => {
  it('reduces and drops a denominator of 1', () => {
    expect(lowest(2, 4)).toBe('1/2');
    expect(lowest(3, 6)).toBe('1/2');
    expect(lowest(4, 4)).toBe('1');
    expect(lowest(0, 5)).toBe('0');
    expect(lowest(3, 8)).toBe('3/8');
  });
});

describe('fraction bars', () => {
  const bars = (rows: [any, any][], extra: object = {}): Model => ({ kind: 'fractionBars', rows: rows.map(([num, den]) => ({ num, den })), ...extra }) as Model;
  it('2/4 and 1/2 with an alignment line: 2 of 4 and 1 of 2 filled, one line at half, and the text says they are equal', () => {
    const b = build(bars([[2, 4], [1, 2]], { alignLine: true }));
    expect(rects(b)).toHaveLength(6);
    expect(filled(b)).toHaveLength(3);
    const line = b.prims.find((p) => p.t === 'line') as any;
    expect(line.x1).toBe(200); // 40 + 320 / 2
    expect(line.x2).toBe(200);
    expect(sentence(b, 'same')!.values).toEqual({ a: 1, b: 2, lowest: '1/2' });
  });
  it('1/3 and 1/2 are not equal: the line is at the first bar and there is no "same" sentence', () => {
    const b = build(bars([[1, 3], [1, 2]], { alignLine: true }));
    expect(keys(b)).not.toContain('same');
    expect((b.prims.find((p) => p.t === 'line') as any).x1).toBeCloseTo(40 + 320 / 3, 9);
  });
  it('equal is decided by cross-multiplying, so 3/9 and 4/12 are equal and 3/9 and 4/13 are not', () => {
    expect(keys(build(bars([[3, 9], [4, 12]], { alignLine: true })))).toContain('same');
    expect(keys(build(bars([[3, 9], [4, 13]], { alignLine: true })))).not.toContain('same');
  });
  it('without alignLine there is no line; a step that hides `align` removes the line and its sentence', () => {
    const model = bars([[2, 4], [1, 2]]);
    expect(build(model).prims.some((p) => p.t === 'line')).toBe(false);
    const withLine = bars([[2, 4], [1, 2]], { alignLine: true });
    const hidden = build(withLine, {}, new Set(['align', 'zzz']));
    expect(hidden.prims.some((p) => p.t === 'line')).toBe(false);
    expect(keys(hidden)).not.toContain('same');
  });
  it('a denominator of 0 or one that is not a number draws no bar; 30 is clamped to 24; a numerator past the end is clamped', () => {
    expect(rects(build(bars([[1, 0]])))).toEqual([]);
    expect(rects(build(bars([['0/0', 2]])))).toEqual([]);
    expect(rects(build(bars([[1, 30]])))).toHaveLength(24);
    expect(filled(build(bars([[9, 4]])))).toHaveLength(4);
  });
  it('a numerator that is a parameter has a handle on the cell edges; one that is a number does not', () => {
    const b = build(bars([['n', 4], [1, 2]]), { n: 2 });
    expect(b.controls).toHaveLength(1);
    const c = b.controls[0]!;
    expect(c.param).toBe('n');
    expect(c.values).toEqual([0, 1, 2, 3, 4]);
    expect(c.index).toBe(2);
    expect(c.positions[2]![0]).toBe(200);
    expect(c.toParam(3)).toBe(3);
    expect(build(bars([[2, 4]])).controls).toEqual([]);
    expect(build(bars([['n + 0', 4]]), { n: 2 }).controls).toEqual([]); // not exactly a parameter id
  });
  it('at most 4 rows are drawn', () => {
    const b = build(bars([[1, 2], [1, 2], [1, 2], [1, 2], [1, 2]]));
    expect(b.sentences.filter((s) => s.key === 'bar')).toHaveLength(4);
  });
});

describe('fraction circle', () => {
  it('3/8: 8 sectors, 3 filled, a handle on each of the 9 rim points', () => {
    const b = build({ kind: 'fractionCircle', num: 'n', den: 8 }, { n: 3 });
    const sectors = b.prims.filter((p) => p.t === 'sector') as any[];
    expect(sectors).toHaveLength(8);
    expect(sectors.filter((s) => s.fill === 'medium')).toHaveLength(3);
    expect(b.controls[0]!.values).toHaveLength(9);
    expect(b.controls[0]!.positions[0]![1]).toBeCloseTo(150 - 110, 9); // the first rim point is at the top
    expect(sentence(b, 'circle')!.values).toEqual({ num: 3, den: 8, lowest: '3/8' });
  });
  it('a denominator of 30 is clamped to 24; 0 draws nothing; a whole circle is one sector of a full turn', () => {
    expect(build({ kind: 'fractionCircle', num: 1, den: 30 }).prims.filter((p) => p.t === 'sector')).toHaveLength(24);
    expect(build({ kind: 'fractionCircle', num: 1, den: 0 }).prims).toEqual([]);
    const one = build({ kind: 'fractionCircle', num: 1, den: 1 }).prims.find((p) => p.t === 'sector') as any;
    expect(one.a1 - one.a0).toBeCloseTo(2 * Math.PI, 12);
  });
});

describe('number line', () => {
  const line = (extra: object = {}): Model => ({ kind: 'numberLine', min: 0, max: 10, step: 1, ...extra }) as Model;
  it('ticks, labels, a jump of +5 and a marker handle on every tick', () => {
    const b = build(line({ marker: 'm', jumps: [{ from: 2, to: 7 }], marks: [{ at: 5, label: { latex: 'x' } }] }), { m: 4 });
    expect(b.prims.filter((p) => p.t === 'jump')).toHaveLength(1);
    expect((b.prims.filter((p) => p.t === 'text') as any[]).some((p) => p.text === '+5')).toBe(true);
    expect(b.controls[0]!.values).toHaveLength(11);
    expect(b.controls[0]!.index).toBe(4);
    expect(sentence(b, 'jump')!.values).toEqual({ from: '2', to: '7', by: '5' });
    expect(keys(b)).toContain('marker');
  });
  it('a step hides marks and jumps', () => {
    const b = build(line({ jumps: [{ from: 2, to: 7 }], marks: [{ at: 5 }] }), {}, new Set(['jumps', 'marks']));
    expect(b.prims.some((p) => p.t === 'jump')).toBe(false);
    expect(keys(b)).toEqual(['numberLine']);
  });
  it('a step of 0 or below, a max not above the min, or more than 400 steps draws nothing', () => {
    expect(build(line({ step: 0 })).prims).toEqual([]);
    expect(build(line({ step: -1 })).prims).toEqual([]);
    expect(build(line({ max: 0 })).prims).toEqual([]);
    expect(build(line({ max: 1000 })).prims).toEqual([]);
    expect(build(line({ max: 400 })).prims.length).toBeGreaterThan(0);
  });
  it('decimal steps keep their digits; a marker outside the line is drawn at the end', () => {
    const b = build({ kind: 'numberLine', min: 0, max: 1, step: 0.25, marker: 5 });
    expect((b.prims.filter((p) => p.t === 'text') as any[]).map((p) => p.text)).toContain('0.25');
    const dot = b.prims.filter((p) => p.t === 'dot').pop() as any;
    expect(dot.x).toBe(370);
  });
});

describe('place value', () => {
  it('3,405 has 3, 4, 0 and 5 blocks in its columns', () => {
    const b = build({ kind: 'placeValue', value: 3405 });
    expect(filled(b)).toHaveLength(12);
    expect(sentence(b, 'placeValue')!.values).toEqual({ value: 3405, th: 3, h: 4, t: 0, o: 5 });
  });
  it('a column handle changes only its own digit: 3,405 becomes 3,505, then 3,305', () => {
    const b = build({ kind: 'placeValue', value: 'v' }, { v: 3405 });
    expect(b.controls).toHaveLength(4);
    const hundreds = b.controls[1]!;
    expect(hundreds.label.values).toEqual({ place: 100 });
    expect(hundreds.index).toBe(4);
    expect(hundreds.toParam(5)).toBe(3505);
    expect(hundreds.toParam(3)).toBe(3305);
    expect(b.controls[3]!.toParam(9)).toBe(3409);
    expect(b.controls[0]!.values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('a value over 9999 or below 0 is clamped; one that cannot be computed draws nothing', () => {
    expect(build({ kind: 'placeValue', value: 12345 }).sentences[0]!.values['value']).toBe(9999);
    expect(build({ kind: 'placeValue', value: -5 }).sentences[0]!.values['value']).toBe(0);
    expect(build({ kind: 'placeValue', value: '1/0' }).prims).toEqual([]);
  });
});

describe('ten-frame', () => {
  const dots = (b: Built) => b.prims.filter((p) => p.t === 'dot');
  it('7 counters, with "3 more to make ten"', () => {
    const b = build({ kind: 'tenFrame', count: 7 });
    expect(dots(b)).toHaveLength(7);
    expect(sentence(b, 'toTen')!.values).toEqual({ more: 3, count: 7 });
  });
  it('13 counters sit on two frames: ten and three more', () => {
    const b = build({ kind: 'tenFrame', count: 13 });
    expect(dots(b)).toHaveLength(13);
    expect(sentence(b, 'overTen')!.values).toEqual({ extra: 3 });
    expect(new Set((dots(b) as any[]).map((d) => d.tone))).toEqual(new Set(['curve1', 'curve2']));
  });
  it('over 20 is 20; below 0 is 0; a handle takes 21 positions', () => {
    expect(dots(build({ kind: 'tenFrame', count: 25 }))).toHaveLength(20);
    expect(dots(build({ kind: 'tenFrame', count: -3 }))).toHaveLength(0);
    const b = build({ kind: 'tenFrame', count: 'c' }, { c: 7 });
    expect(b.controls[0]!.values).toHaveLength(21);
    expect(b.controls[0]!.index).toBe(7);
  });
});

describe('area model', () => {
  const area = (extra: object = {}): Model => ({ kind: 'areaModel', rows: 3, cols: 12, ...extra }) as Model;
  it('3 by 12 split after 10 columns: two parts, 3 x 10 + 3 x 2 = 36', () => {
    const b = build(area({ splitCols: 10 }));
    expect(sentence(b, 'splitCols')!.values).toEqual({ rows: 3, a: 10, b: 2, p: 30, q: 6, area: 36 });
    expect(rects(b)).toHaveLength(2);
  });
  it('a split of 0 or of every column is no split', () => {
    expect(keys(build(area({ splitCols: 0 })))).toEqual(['area']);
    expect(keys(build(area({ splitCols: 12 })))).toEqual(['area']);
  });
  it('splitting rows and columns gives four parts and the product of two sums', () => {
    const b = build(area({ splitCols: 10, splitRows: 1 }));
    expect(rects(b)).toHaveLength(4);
    expect(sentence(b, 'splitBoth')!.values).toEqual({ a: 1, b: 2, c: 10, d: 2, area: 36 });
  });
  it('rows and columns are clamped to 1 to 20; the split handles run along the edges', () => {
    const big = build({ kind: 'areaModel', rows: 50, cols: 50 });
    expect(sentence(big, 'area')!.values).toEqual({ rows: 20, cols: 20, area: 400 });
    const b = build(area({ splitCols: 'sc', splitRows: 'sr' }), { sc: 4, sr: 2 });
    expect(b.controls.map((c) => c.id)).toEqual(['split-cols', 'split-rows']);
    expect(b.controls[0]!.values).toHaveLength(13);
    expect(b.controls[1]!.values).toHaveLength(4);
    expect(b.controls[0]!.index).toBe(4);
  });
});

describe('percent grid', () => {
  it('35 percent: 35 of the 100 cells are filled; 150 is 100; below 0 is 0', () => {
    expect(filled(build({ kind: 'percentGrid', percent: 35 }))).toHaveLength(35);
    expect(filled(build({ kind: 'percentGrid', percent: 150 }))).toHaveLength(100);
    expect(filled(build({ kind: 'percentGrid', percent: -4 }))).toHaveLength(0);
    expect(sentence(build({ kind: 'percentGrid', percent: 35 }), 'percent')!.values).toEqual({ count: 35 });
  });
  it('a handle has 101 positions', () => {
    const b = build({ kind: 'percentGrid', percent: 'p' }, { p: 35 });
    expect(b.controls[0]!.values).toHaveLength(101);
    expect(b.controls[0]!.index).toBe(35);
  });
});

describe('bad input is nothing drawn, never a throw', () => {
  it('hostile and broken expressions', () => {
    const models: Model[] = [
      { kind: 'fractionBars', rows: [{ num: 'constructor(1)', den: '1 +' }] },
      { kind: 'fractionCircle', num: '__proto__', den: 'x(' },
      { kind: 'areaModel', rows: 'nope', cols: 2 },
      { kind: 'tenFrame', count: 'nope(' },
      { kind: 'placeValue', value: '0/0' },
      { kind: 'percentGrid', percent: 'Infinity' },
      { kind: 'numberLine', min: 'a(', max: 1, step: 1 },
    ];
    for (const m of models) {
      expect(() => build(m)).not.toThrow();
      expect(build(m).prims.filter((p) => p.t !== 'line' && p.t !== 'text')).toEqual([]);
    }
  });
});

describe('the schema (number-model@1)', () => {
  const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
  const load = () => JSON.parse(readFileSync('content/fixtures/num-equivalent-fractions.json', 'utf8')) as any;
  const ok = (edit: (d: any) => void) => {
    const d = load();
    edit(d);
    return validator.validate(d).ok;
  };
  it('the fixture topic passes', () => {
    const r = validator.validate(load());
    expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
  });
  it('refuses an unknown kind, an unknown key, no model, 5 rows, and more than 12 marks', () => {
    expect(ok((d) => (d.scene.model = { kind: 'abacus' }))).toBe(false);
    expect(ok((d) => (d.scene.model.extra = 1))).toBe(false);
    expect(ok((d) => delete d.scene.model)).toBe(false);
    expect(ok((d) => (d.scene.model.rows = Array.from({ length: 5 }, () => ({ num: 1, den: 2 }))))).toBe(false);
    expect(ok((d) => (d.scene.model.rows = []))).toBe(false);
    expect(ok((d) => (d.scene.model = { kind: 'numberLine', min: 0, max: 10, step: 1, marks: Array.from({ length: 13 }, (_, i) => ({ at: i })) }))).toBe(false);
  });
  it('accepts every kind', () => {
    const models = [
      { kind: 'numberLine', min: 0, max: 10, step: 1, marker: 'n1', marks: [{ at: 5, label: { latex: 'x' } }], jumps: [{ from: 2, to: 7 }] },
      { kind: 'fractionCircle', num: 'n1', den: 8 },
      { kind: 'areaModel', rows: 3, cols: 'd1', splitCols: 'n1' },
      { kind: 'tenFrame', count: 'n1' },
      { kind: 'placeValue', value: 'n1' },
      { kind: 'percentGrid', percent: 'n1' },
    ];
    for (const m of models) expect(ok((d) => (d.scene.model = m)), m.kind).toBe(true);
  });
  it('the formula checks of the fixture come out as the topic says', () => {
    const topic = load();
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const defaults = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
    for (const f of topic.formulas) {
      for (const check of f.checks) {
        const scope = program.scope({ ...defaults, ...check.at });
        for (const [name, expected] of Object.entries(check.expect) as [string, number][]) {
          expect(Math.abs(program.evaluate(f.bind[name].expr, scope) - expected), `${f.id}.${name}`).toBeLessThanOrEqual(0.5 * 10 ** -f.bind[name].decimals);
        }
      }
    }
  });
});

describe('the picture and the text (server HTML)', () => {
  const load = () => JSON.parse(readFileSync('content/fixtures/num-equivalent-fractions.json', 'utf8')) as any;
  const html = (locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
    renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(NumberModelViewer, { topic: load() as NumberModelTopic, ...props }) }));
  const out = html();
  it('has the bars, a handle for each bar, the alignment line and the sentences', () => {
    expect(out).toContain('data-number-model');
    expect(out).toContain('data-handle="bar-1"');
    expect(out).toContain('data-handle="bar-2"');
    expect(out).toContain('role="slider"');
    expect(out).toContain('Bar 1: 2 of 4 equal parts are filled, which is 1/2.');
    expect(out).toContain('Bars 1 and 2 reach the same length: 1/2.');
  });
  it('a step that hides `align` takes the sentence out', () => {
    const hidden = html('en', { step: { index: 0, params: {}, hidden: new Set(['align']) } });
    expect(hidden).not.toContain('reach the same length');
  });
  it('is in Urdu on /ur with the picture kept left to right', () => {
    const urdu = html('ur');
    expect(urdu).toContain('ایک ہی لمبائی');
    expect(urdu).toContain('dir="ltr"');
  });
  it('renders to static markup without a browser, with no listeners, no hex colors and no NaN', () => {
    const b = build({ kind: 'fractionBars', rows: [{ num: 2, den: 4 }, { num: 1, den: 2 }], alignLine: true });
    const all = [b, build({ kind: 'fractionCircle', num: 3, den: 8 }), build({ kind: 'numberLine', min: 0, max: 10, step: 1, jumps: [{ from: 2, to: 7 }] }), build({ kind: 'tenFrame', count: 13 }), build({ kind: 'placeValue', value: 3405 }), build({ kind: 'areaModel', rows: 3, cols: 12, splitCols: 10 }), build({ kind: 'percentGrid', percent: 35 })];
    for (const built of all) {
      const markup = renderToStaticMarkup(createElement(NumberModel, { prims: built.prims }));
      expect(markup).toContain('data-number-model');
      expect(markup).not.toMatch(/ on[A-Z]\w+=|onclick/i);
      expect(markup).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/);
      expect(markup).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('review patches (Story 3.3)', () => {
  const everyKind: Model[] = [
    { kind: 'numberLine', min: 0, max: 10, step: 1, marker: 'p', marks: [{ at: 5, label: { latex: 'x' } }, { at: 2 }], jumps: [{ from: 2, to: 7 }] },
    { kind: 'fractionBars', rows: [{ num: 'p', den: 4 }, { num: 1, den: 2 }], alignLine: true },
    { kind: 'fractionCircle', num: 'p', den: 8 },
    { kind: 'areaModel', rows: 3, cols: 12, splitCols: 'p', splitRows: 1 },
    { kind: 'areaModel', rows: 3, cols: 12, splitCols: 10 },
    { kind: 'areaModel', rows: 3, cols: 12, splitRows: 1 },
    { kind: 'tenFrame', count: 'p' },
    { kind: 'placeValue', value: 'p' },
    { kind: 'percentGrid', percent: 'p' },
  ];
  it('every sentence and every handle label of every kind resolves in English and Urdu with no key, brace or placeholder left', () => {
    for (const [locale, messages] of [['en', en], ['ur', ur]] as const) {
      const t = createTranslator({ locale, messages: messages as any, namespace: 'models' });
      for (const p of [0, 3, 10, 12]) {
        for (const model of everyKind) {
          const b = build(model, { p });
          for (const s of b.sentences) {
            const text = t(`sentence.${s.key}` as any, s.values as any);
            expect(text, `${locale} ${model.kind} ${s.key}`).not.toMatch(/models\.|sentence\.|[{}]/);
          }
          for (const c of b.controls) {
            const text = t(c.label.key as any, c.label.values as any);
            expect(text, `${locale} ${c.id}`).not.toMatch(/models\.|drag\.|[{}]/);
            expect(t('valueOf' as any, { value: 1, max: 2 } as any)).not.toMatch(/[{}]/);
          }
        }
      }
    }
  });
  it('a number line whose step does not divide its length stops at the last whole step', () => {
    const b = build({ kind: 'numberLine', min: 0, max: 10, step: 4, marker: 'p' }, { p: 10 });
    const ticks = (b.prims.filter((x) => x.t === 'line') as any[]).filter((x) => x.y1 !== x.y2);
    expect(ticks).toHaveLength(3); // 0, 4, 8
    expect(Math.max(...ticks.map((x) => x.x1))).toBeLessThan(370);
    expect(b.controls[0]!.values).toEqual([0, 4, 8]);
    expect(sentence(b, 'marker')!.values).toEqual({ value: '10' });
    expect(build({ kind: 'numberLine', min: 0, max: 1, step: 0.1 }).controls).toEqual([]);
    expect(build({ kind: 'numberLine', min: 0, max: 1, step: 0.1, marker: 'p' }, { p: 0.3 }).controls[0]!.values).toHaveLength(11);
  });
  it('hiding `labels` removes tick labels, mark labels and region labels', () => {
    const texts = (b: Built) => (b.prims.filter((x) => x.t === 'text') as any[]).map((x) => x.text);
    const line: Model = { kind: 'numberLine', min: 0, max: 10, step: 1, marks: [{ at: 5, label: { latex: 'x' } }] };
    expect(texts(build(line)).length).toBeGreaterThan(texts(build(line, {}, new Set(['labels']))).length);
    expect(texts(build(line, {}, new Set(['labels'])))).toEqual([]);
    const area: Model = { kind: 'areaModel', rows: 3, cols: 12, splitCols: 10 };
    expect(texts(build(area)).some((x) => x.includes('×'))).toBe(true);
    expect(texts(build(area, {}, new Set(['labels']))).some((x) => x.includes('×'))).toBe(false);
  });
  it('the alignment line follows the first bar only: with no first bar there is no line', () => {
    const b = build({ kind: 'fractionBars', rows: [{ num: 1, den: 0 }, { num: 1, den: 2 }], alignLine: true });
    expect(b.prims.some((p) => p.t === 'line')).toBe(false);
    expect(keys(b)).not.toContain('same');
  });
  it('a count of exactly ten says the frame is full', () => {
    expect(keys(build({ kind: 'tenFrame', count: 10 }))).toEqual(['tenFrame', 'tenFull']);
    expect(keys(build({ kind: 'tenFrame', count: 9 }))).toContain('toTen');
  });
  it('the whole circle and no part are different positions, so a pointer can reach each', () => {
    const c = build({ kind: 'fractionCircle', num: 'p', den: 8 }, { p: 2 }).controls[0]!;
    const zero = c.positions[0]!;
    const whole = c.positions[8]!;
    expect(Math.hypot(zero[0] - whole[0], zero[1] - whole[1])).toBeGreaterThan(5);
  });
  it('a bar numerator past its denominator shows what the picture shows in the fixture readout', () => {
    const topic = JSON.parse(readFileSync('content/fixtures/num-equivalent-fractions.json', 'utf8'));
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const scope = program.scope({ n1: 12, d1: 4, n2: 1, d2: 2 });
    expect(program.evaluate('v1', scope)).toBe(1);
  });
  it('a whole-circle fraction (1/1) draws a circle, not an empty arc', () => {
    const markup = renderToStaticMarkup(createElement(NumberModel, { prims: build({ kind: 'fractionCircle', num: 1, den: 1 }).prims }));
    expect(markup).toContain('<circle');
    expect(markup).not.toMatch(/ A110 110 0 0 1 200\.00 40\.00 Z/);
  });
});
