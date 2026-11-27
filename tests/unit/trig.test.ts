/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { RightTriangleViewer, UnitCircleViewer } from '../../src/features/scene';
import { angleFromPointer, buildTriangle, buildUnitCircle, exactValue, fromDegrees, nextSpecial, quadrant, radText, snapAngle, toDegrees, trigValues, type Given, type UnitCircleOptions } from '../../src/lib/trig';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { NumberModel } from '../../src/scenes/numbermodel';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 3.5: the numbers of trigonometry (NFR-6.2), the unit circle and the right triangle as pictures and text,
// and their schema. Each row of the spec's I/O matrix has a test here.

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
const MINUS = '−';

describe('the ratios at the angles of NFR-6.2 match the known values', () => {
  const S2 = Math.SQRT2 / 2;
  const S3 = Math.sqrt(3) / 2;
  const known: [number, number, number, number | null][] = [
    [30, 0.5, S3, Math.sqrt(3) / 3],
    [45, S2, S2, 1],
    [60, S3, 0.5, Math.sqrt(3)],
    [150, 0.5, -S3, -Math.sqrt(3) / 3],
    [225, -S2, -S2, 1],
  ];
  for (const [deg, sin, cos, tan] of known) {
    it(`${deg} degrees`, () => {
      const v = trigValues(deg);
      near(v.sin, sin, 1e-12);
      near(v.cos, cos, 1e-12);
      near(v.tan!, tan!, 1e-12);
    });
  }
  it('their exact forms', () => {
    expect([30, 45, 60, 150, 225].map((d) => exactValue('sin', d))).toEqual(['1/2', '√2/2', '√3/2', '1/2', `${MINUS}√2/2`]);
    expect([30, 45, 60, 150, 225].map((d) => exactValue('cos', d))).toEqual(['√3/2', '√2/2', '1/2', `${MINUS}√3/2`, `${MINUS}√2/2`]);
    expect([30, 45, 60, 150, 225].map((d) => exactValue('tan', d))).toEqual(['√3/3', '1', '√3', `${MINUS}√3/3`, '1']);
  });
  it('the axes: zero and one, and an undefined tangent', () => {
    expect([0, 90, 180, 270, 360].map((d) => exactValue('sin', d))).toEqual(['0', '1', '0', `${MINUS}1`, '0']);
    expect([0, 90, 180, 270, 360].map((d) => exactValue('cos', d))).toEqual(['1', '0', `${MINUS}1`, '0', '1']);
    expect(exactValue('tan', 90)).toBeNull();
    expect(exactValue('tan', 270)).toBeNull();
    expect(trigValues(90).tan).toBeNull();
    expect(trigValues(270).tan).toBeNull();
    expect(trigValues(180).sin).toBe(0); // not 1.2e-16
    expect(exactValue('tan', 180)).toBe('0');
  });
  it('an angle that is not special has no exact form; the rule is the same for every turn', () => {
    expect(exactValue('sin', 37)).toBeNull();
    expect(exactValue('sin', 30.5)).toBeNull();
    expect(exactValue('sin', NaN)).toBeNull();
    expect(exactValue('sin', 390)).toBe('1/2');
    expect(exactValue('sin', -30)).toBe(`${MINUS}1/2`);
  });
});

describe('radians, quadrants and snapping', () => {
  it('radians as a fraction of pi at multiples of 15 degrees, else a decimal', () => {
    expect([0, 30, 45, 90, 150, 180, 270, 360, 15, -90].map(radText)).toEqual(['0', 'π/6', 'π/4', 'π/2', '5π/6', 'π', '3π/2', '2π', 'π/12', `${MINUS}π/2`]);
    expect(radText(10)).toBe('0.1745');
  });
  it('the quadrant, or the axis', () => {
    expect([10, 100, 190, 280].map(quadrant)).toEqual([1, 2, 3, 4]);
    expect([0, 90, 180, 270, 360].map(quadrant)).toEqual(['axis', 'axis', 'axis', 'axis', 'axis']);
    expect(quadrant(-30)).toBe(4);
  });
  it('degrees and radians convert both ways', () => {
    near(toDegrees(Math.PI / 6, 'rad'), 30, 1e-9);
    near(fromDegrees(30, 'rad'), Math.PI / 6, 1e-12);
    expect(toDegrees(30, 'deg')).toBe(30);
  });
  it('snaps to the nearest special value within the distance, else leaves the angle alone', () => {
    const values = [0, 30, 45, 60, 90];
    expect(snapAngle(31.5, values, 3)).toBe(30);
    expect(snapAngle(44, values, 3)).toBe(45);
    expect(snapAngle(37, values, 3)).toBe(37);
    expect(snapAngle(52.5, values, 8)).toBe(45); // 52.5 is 7.5 from 45 and 7.5 from 60: the first nearest wins
    expect(snapAngle(31.5, values, 0)).toBe(31.5);
    expect(snapAngle(NaN, values, 3)).toBeNaN();
  });
  it('the next special angle up or down, or none at the end', () => {
    const values = [0, 30, 45, 60, 90];
    expect(nextSpecial(30, values, true)).toBe(45);
    expect(nextSpecial(31, values, false)).toBe(30);
    expect(nextSpecial(90, values, true)).toBeNull();
    expect(nextSpecial(0, values, false)).toBeNull();
  });
});

const circle = (extra: Partial<UnitCircleOptions> = {}) => buildUnitCircle({ angleDeg: 30, tangent: false, wave: null, quadrants: false, ...extra });
const lines = (b: { prims: any[] }) => b.prims.filter((p) => p.t === 'line');
const texts = (b: { prims: any[] }) => b.prims.filter((p) => p.t === 'text').map((p) => p.text as string);
const sentence = (b: { sentences: any[] }, key: string) => b.sentences.find((s) => s.key === key);

describe('the unit circle', () => {
  it('the point is at (cos, sin) about the circle’s centre, y downward', () => {
    const b = circle({ angleDeg: 30 });
    near(b.circle!.x, b.circle!.cx + b.circle!.r * Math.cos(Math.PI / 6));
    near(b.circle!.y, b.circle!.cy - b.circle!.r * 0.5);
    const q = circle({ angleDeg: 225 });
    expect(q.circle!.x).toBeLessThan(q.circle!.cx);
    expect(q.circle!.y).toBeGreaterThan(q.circle!.cy);
  });
  it('says the angle, the three ratios and the quadrant, with exact forms at special angles (150 degrees)', () => {
    const b = circle({ angleDeg: 150 });
    expect(sentence(b, 'angle').values).toEqual({ deg: '150', rad: '5π/6' });
    expect(sentence(b, 'sine').values).toEqual({ v: '0.5 (1/2)' });
    expect(sentence(b, 'cosine').values).toEqual({ v: `${MINUS}0.866 (${MINUS}√3/2)` });
    expect(sentence(b, 'tangent').values['v']).toBe(`${MINUS}0.5774 (${MINUS}√3/3)`);
    expect(sentence(b, 'quadrant').values).toEqual({ q: 2 });
  });
  it('a non-special angle has plain decimals; on an axis the sentence says so', () => {
    expect(sentence(circle({ angleDeg: 37 }), 'sine').values).toEqual({ v: '0.6018' });
    expect(sentence(circle({ angleDeg: 90 }), 'axis')).toBeDefined();
    expect(sentence(circle({ angleDeg: 90 }), 'quadrant')).toBeUndefined();
  });
  it('the cosine and the sine differ by dash as well as by color', () => {
    const b = circle();
    const cos = lines(b).find((l) => l.tone === 'curve1');
    const sin = lines(b).find((l) => l.tone === 'curve2');
    expect(cos.dash).toBeUndefined();
    expect(sin.dash).toBe(true);
  });
  it('the tangent is drawn when asked, and not at a pole (90 and 270 degrees): it reads undefined', () => {
    const accent = (b: any) => lines(b).filter((l) => l.tone === 'accent');
    expect(accent(circle({ tangent: false }))).toHaveLength(0);
    expect(accent(circle({ tangent: true }))).toHaveLength(2);
    for (const d of [90, 270]) {
      const b = circle({ angleDeg: d, tangent: true });
      expect(accent(b)).toHaveLength(0);
      expect(sentence(b, 'tangentUndefined')).toBeDefined();
      expect(sentence(b, 'tangent')).toBeUndefined();
    }
    // a very steep tangent stays on the picture
    const steep = circle({ angleDeg: 89.9999, tangent: true });
    for (const l of accent(steep)) expect(Math.abs(l.y2 - 150)).toBeLessThanOrEqual(145);
  });
  it('hidden parts are not drawn; quadrant labels are drawn when asked', () => {
    const all = circle({ quadrants: true, tangent: true });
    for (const part of ['circle', 'point', 'radius', 'arc', 'cosine', 'sine', 'tangent', 'quadrants']) {
      const b = circle({ quadrants: true, tangent: true, hidden: new Set([part, 'zzz']) });
      expect(JSON.stringify(b.prims) === JSON.stringify(all.prims), part).toBe(false);
    }
    expect(texts(all)).toEqual(expect.arrayContaining(['I', 'II', 'III', 'IV']));
    expect(texts(circle())).not.toContain('I');
    expect(circle({ hidden: new Set(['point']) }).prims.some((p: any) => p.t === 'dot')).toBe(false);
  });
  it('an angle that cannot be computed draws nothing', () => {
    expect(circle({ angleDeg: NaN }).prims).toEqual([]);
    expect(circle({ angleDeg: NaN }).circle).toBeNull();
  });
  describe('the wave', () => {
    const wave = (fn: 'sin' | 'cos' | 'tan', extra: Partial<UnitCircleOptions> = {}) => circle({ wave: { fn, fromDeg: 0, toDeg: 360 }, ...extra });
    const paths = (b: any) => b.prims.filter((p: any) => p.t === 'path');
    it('a sine curve with a dot at the current angle and a guide from the circle; the circle moves left to make room', () => {
      const b = wave('sin', { angleDeg: 150 });
      expect(paths(b)).toHaveLength(1);
      const dot = b.prims.filter((p: any) => p.t === 'dot').pop() as any;
      near(dot.x, 215 + (150 / 360) * 170, 1e-9);
      near(dot.y, 150 - 80 * 0.5, 1e-9);
      expect(lines(b).some((l: any) => l.dash && l.tone === 'muted')).toBe(true);
      expect(b.circle!.cx).toBe(105);
      expect(circle().circle!.cx).toBe(200);
    });
    it('an angle outside the range has no dot on the wave', () => {
      const b = circle({ angleDeg: 200, wave: { fn: 'sin', fromDeg: 0, toDeg: 90 } });
      expect(b.prims.filter((p: any) => p.t === 'dot')).toHaveLength(1); // only the circle’s point
    });
    it('a tangent wave breaks at 90 and 270 degrees and never draws a spike', () => {
      const b = wave('tan');
      const ps = paths(b);
      expect(ps.length).toBeGreaterThanOrEqual(3);
      for (const p of ps) for (const [x, y] of p.points) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(Math.abs(y - 150)).toBeLessThanOrEqual(40 * 3 + 1e-9);
      }
      const xAt = (d: number) => 215 + (d / 360) * 170;
      for (const pole of [90, 270]) for (const p of ps) {
        const xs = p.points.map(([x]: [number, number]) => x);
        expect(xs.some((x: number) => x < xAt(pole) - 0.5) && xs.some((x: number) => x > xAt(pole) + 0.5), `pole ${pole}`).toBe(false);
      }
    });
    it('hidden, or a range that is not a range, is no wave and the circle is centred', () => {
      expect(paths(circle({ wave: { fn: 'sin', fromDeg: 0, toDeg: 360 }, hidden: new Set(['wave']) }))).toHaveLength(0);
      expect(paths(circle({ wave: { fn: 'sin', fromDeg: 90, toDeg: 90 } }))).toHaveLength(0);
      expect(paths(circle({ wave: { fn: 'sin', fromDeg: NaN, toDeg: 360 } }))).toHaveLength(0);
      expect(circle({ wave: { fn: 'sin', fromDeg: 0, toDeg: 360 }, hidden: new Set(['wave']) }).circle!.cx).toBe(200);
    });
  });
});

describe('the right triangle', () => {
  const words = { opposite: 'opposite', adjacent: 'adjacent', hypotenuse: 'hypotenuse' };
  const tri = (given: Given, params: Record<string, number> = {}, extra: object = {}) => {
    const program = createProgram(Object.keys(params));
    return buildTriangle({ given, program, scope: program.scope(params), words, ...extra });
  };
  it('adjacent 4 and opposite 3: hypotenuse 5, angle 36.87 degrees, sin 0.6, cos 0.8, tan 0.75', () => {
    const b = tri({ mode: 'sides', adjacent: 4, opposite: 3 }, {}, { ratios: ['sin', 'cos', 'tan'] });
    expect(b.triangle!.hypotenuse).toBe(5);
    near(b.triangle!.angleDeg, 36.8698976, 1e-6);
    expect(b.sentences.find((s) => s.key === 'ratioSin')!.values).toEqual({ opp: '3', hyp: '5', value: '0.6' });
    expect(b.sentences.find((s) => s.key === 'ratioCos')!.values).toEqual({ adj: '4', hyp: '5', value: '0.8' });
    expect(b.sentences.find((s) => s.key === 'ratioTan')!.values).toEqual({ opp: '3', adj: '4', value: '0.75' });
  });
  it('angle 30 and hypotenuse 10: adjacent 8.66, opposite 5; the angle is clamped to 1 and 89', () => {
    const b = tri({ mode: 'angle', angle: 30, hypotenuse: 10 });
    near(b.triangle!.adjacent, 8.660254, 1e-6);
    near(b.triangle!.opposite, 5, 1e-9);
    expect(tri({ mode: 'angle', angle: 0, hypotenuse: 10 }).triangle!.angleDeg).toBe(1);
    expect(tri({ mode: 'angle', angle: 90, hypotenuse: 10 }).triangle!.angleDeg).toBe(89);
  });
  it('a change of side updates the ratios', () => {
    const given: Given = { mode: 'sides', adjacent: 'a', opposite: 3 };
    const value = (a: number) => tri(given, { a }, { ratios: ['tan'] }).sentences.find((s) => s.key === 'ratioTan')!.values['value'];
    expect(value(4)).toBe('0.75');
    expect(value(3)).toBe('1');
    expect(value(12)).toBe('0.25');
  });
  it('a side that is zero, negative or not a number, or a hypotenuse like that, draws nothing', () => {
    for (const given of [{ mode: 'sides', adjacent: 0, opposite: 3 }, { mode: 'sides', adjacent: -1, opposite: 3 }, { mode: 'sides', adjacent: 'nope(', opposite: 3 }, { mode: 'sides', adjacent: '1/0', opposite: 3 }, { mode: 'angle', angle: 30, hypotenuse: 0 }, { mode: 'angle', angle: 'x(', hypotenuse: 5 }] as Given[]) {
      const b = tri(given);
      expect(b.prims, JSON.stringify(given)).toEqual([]);
      expect(b.triangle).toBeNull();
    }
  });
  it('draws the triangle, the right-angle mark, the angle arc and the labels; each can be hidden', () => {
    const given: Given = { mode: 'sides', adjacent: 4, opposite: 3 };
    const all = tri(given, {}, { ratios: ['sin'] });
    expect(all.prims.filter((p) => p.t === 'line')).toHaveLength(3);
    expect(all.prims.some((p) => p.t === 'rect')).toBe(true);
    expect(all.prims.some((p) => p.t === 'sector')).toBe(true);
    const labels = (b: any) => b.prims.filter((p: any) => p.t === 'text').map((p: any) => p.text);
    expect(labels(all)).toEqual(expect.arrayContaining(['opposite', 'adjacent', 'hypotenuse']));
    expect(labels(tri(given, {}, { labels: 'abc' }))).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(tri(given, {}, { hidden: new Set(['triangle']) }).prims.filter((p) => p.t === 'line')).toHaveLength(0);
    expect(tri(given, {}, { hidden: new Set(['rightAngle']) }).prims.some((p) => p.t === 'rect')).toBe(false);
    expect(tri(given, {}, { hidden: new Set(['angleArc']) }).prims.some((p) => p.t === 'sector')).toBe(false);
    expect(labels(tri(given, {}, { hidden: new Set(['sideLabels', 'angleArc']) }))).toEqual([]);
    expect(tri(given, {}, { ratios: ['sin'], hidden: new Set(['ratios']) }).sentences.map((s) => s.key)).toEqual(['sides']);
  });
  it('stays on the picture for a very flat and a very tall triangle', () => {
    for (const [adj, opp] of [[12, 1], [1, 12]] as [number, number][]) {
      const b = tri({ mode: 'sides', adjacent: adj, opposite: opp });
      for (const p of b.prims.filter((p) => p.t === 'line') as any[]) {
        for (const v of [p.x1, p.x2]) expect(v >= 0 && v <= 400).toBe(true);
        for (const v of [p.y1, p.y2]) expect(v >= 0 && v <= 300).toBe(true);
      }
    }
  });
});

describe('the schema (right-triangle@1) and the fixtures', () => {
  const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
  const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
  const ok = (edit: (d: any) => void) => {
    const d = load('trig-right-triangle');
    edit(d);
    return validator.validate(d).ok;
  };
  it('both trigonometry fixtures pass', () => {
    for (const name of ['trig-right-triangle', 'trig-unit-circle']) {
      const r = validator.validate(load(name));
      expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
    }
  });
  it('refuses a missing given, a bad mode, a bad ratio, four ratios, bad labels and an unknown key', () => {
    expect(ok((d) => delete d.scene.given)).toBe(false);
    expect(ok((d) => (d.scene.given = { mode: 'area', adjacent: 1, opposite: 1 }))).toBe(false);
    expect(ok((d) => (d.scene.given = { mode: 'sides', adjacent: 1 }))).toBe(false);
    expect(ok((d) => (d.scene.ratios = ['sec']))).toBe(false);
    expect(ok((d) => (d.scene.ratios = ['sin', 'cos', 'tan', 'sin']))).toBe(false);
    expect(ok((d) => (d.scene.labels = 'greek'))).toBe(false);
    expect(ok((d) => (d.scene.surprise = 1))).toBe(false);
  });
  it('accepts the angle mode and the abc labels', () => {
    expect(ok((d) => { d.scene.given = { mode: 'angle', angle: 'adj', hypotenuse: 10 }; d.scene.labels = 'abc'; })).toBe(true);
  });
  it('the formula checks of the triangle topic come out as the topic says', () => {
    const topic = load('trig-right-triangle');
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

describe('every message resolves (English and Urdu)', () => {
  it('no key, brace or placeholder is left', () => {
    const c = [30, 90, 150, 37, 0].flatMap((d) => circle({ angleDeg: d, wave: { fn: 'sin', fromDeg: 0, toDeg: 360 } }).sentences);
    const program = createProgram([]);
    const tri = buildTriangle({ given: { mode: 'sides', adjacent: 4, opposite: 3 }, ratios: ['sin', 'cos', 'tan'], program, scope: program.scope({}), words: { opposite: 'o', adjacent: 'a', hypotenuse: 'h' } }).sentences;
    for (const [locale, messages] of [['en', en], ['ur', ur]] as const) {
      const t = createTranslator({ locale, messages: messages as any, namespace: 'trig' });
      for (const s of [...c, ...tri]) expect(t(`sentence.${s.key}` as any, s.values as any), `${locale} ${s.key}`).not.toMatch(/trig\.|sentence\.|[{}]/);
      expect(t('handleValue' as any, { angle: 30, sin: 0.5, cos: 0.866 } as any)).not.toMatch(/[{}]/);
      for (const w of ['opposite', 'adjacent', 'hypotenuse']) expect(t(`words.${w}` as any)).not.toMatch(/trig\./);
    }
  });
});

describe('the viewers (server HTML)', () => {
  const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
  const html = (Viewer: any, name: string, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}, edit?: (d: any) => void) => {
    const topic = load(name);
    edit?.(topic);
    return renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(Viewer, { topic, ...props }) }));
  };
  const out = html(UnitCircleViewer, 'trig-unit-circle');
  it('the unit circle: the picture, the angle handle, and the sentences', () => {
    expect(out).toContain('data-number-model');
    expect(out).toContain('data-handle="angle"');
    expect(out).toContain('role="slider"');
    expect(out).toContain('30 degrees, sine 0.5, cosine 0.866');
    expect(out).toContain('The angle is 30 degrees, which is π/6 radians.');
    expect(out).toContain('Sine is 0.5 (1/2).');
    expect(out).toContain('Cosine is 0.866 (√3/2).');
  });
  it('a step that hides the point or the wave takes the handle or the wave away', () => {
    expect(html(UnitCircleViewer, 'trig-unit-circle', 'en', { step: { index: 0, params: {}, hidden: new Set(['point']) } })).not.toContain('data-handle="angle"');
    expect(out.match(/<path d="M/g)?.length ?? 0).toBeGreaterThan(html(UnitCircleViewer, 'trig-unit-circle', 'en', { step: { index: 0, params: {}, hidden: new Set(['wave']) } }).match(/<path d="M/g)?.length ?? 0);
  });
  it('an angle in radians is the same picture as in degrees', () => {
    const rad = html(UnitCircleViewer, 'trig-unit-circle', 'en', {}, (d) => {
      const p = d.parameters.find((x: any) => x.id === 'angle');
      Object.assign(p, { unit: 'rad', min: 0, max: 6.2832, step: 0.01, default: Math.PI / 6 });
    });
    expect(rad).toContain('The angle is 30 degrees, which is π/6 radians.');
  });
  it('the right triangle: the picture, the sides and the three ratios', () => {
    const tri = html(RightTriangleViewer, 'trig-right-triangle');
    expect(tri).toContain('data-number-model');
    expect(tri).toContain('The adjacent side is 4, the opposite side is 3 and the hypotenuse is 5. The angle is 36.87 degrees.');
    expect(tri).toContain('sine = opposite / hypotenuse = 3 / 5 = 0.6.');
    expect(tri).toContain('tangent = opposite / adjacent = 3 / 4 = 0.75.');
    expect(html(RightTriangleViewer, 'trig-right-triangle', 'en', { step: { index: 0, params: {}, hidden: new Set(['ratios']) } })).not.toContain('sine = opposite');
  });
  it('is in Urdu on /ur with the picture kept left to right', () => {
    const urdu = html(UnitCircleViewer, 'trig-unit-circle', 'ur');
    expect(urdu).toContain('سائن');
    expect(urdu).toContain('dir="ltr"');
    expect(html(RightTriangleViewer, 'trig-right-triangle', 'ur')).toContain('ملحق ضلع 4');
  });
  it('the pictures render to static markup with no listeners, hex colors or NaN', () => {
    const program = createProgram([]);
    const all = [
      circle({ wave: { fn: 'sin', fromDeg: 0, toDeg: 360 }, tangent: true, quadrants: true }),
      circle({ angleDeg: 90, wave: { fn: 'tan', fromDeg: 0, toDeg: 360 }, tangent: true }),
      buildTriangle({ given: { mode: 'sides', adjacent: 4, opposite: 3 }, program, scope: program.scope({}), words: { opposite: 'o', adjacent: 'a', hypotenuse: 'h' } }),
    ];
    for (const b of all) {
      const markup = renderToStaticMarkup(createElement(NumberModel, { prims: b.prims }));
      expect(markup).not.toMatch(/ on[A-Z]\w+=|onclick/i);
      expect(markup).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/);
      expect(markup).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('review patches (Story 3.5)', () => {
  const D = (deg: number) => ({ dx: Math.cos((deg * Math.PI) / 180), dy: Math.sin((deg * Math.PI) / 180) });
  const base = { unit: 'deg' as const, current: 30, min: 0, max: 360, snapValues: [0, 30, 45, 60, 90, 180, 360], within: 3 };
  it('a pointer direction is the angle, snapped to a special angle near it', () => {
    expect(angleFromPointer({ ...base, ...D(47) })).toEqual({ value: 45, snapped: true });
    const free = angleFromPointer({ ...base, ...D(200) })!;
    near(free.value, 200, 1e-9);
    expect(free.snapped).toBe(false);
    expect(angleFromPointer({ ...base, ...D(47), within: 0 })!.snapped).toBe(false);
  });
  it('in radians a special angle stays exact and is marked so, not moved onto a step grid', () => {
    const r = angleFromPointer({ unit: 'rad', current: 1, min: 0, max: 6.2832, snapValues: [0, Math.PI / 6, Math.PI / 4], within: 0.05, ...D(31) })!;
    expect(r.snapped).toBe(true);
    expect(r.value).toBe(Math.PI / 6);
  });
  it('a range of -180 to 180 takes the half below the axis as negative; a range of 0 to 90 is clamped, not flipped', () => {
    const below = angleFromPointer({ ...base, min: -180, max: 180, current: -60, snapValues: [], within: 0, ...D(270) })!;
    near(below.value, -90, 1e-9);
    const narrow = angleFromPointer({ ...base, min: 0, max: 90, current: 80, snapValues: [], within: 0, ...D(135) })!;
    expect(narrow.value).toBe(90);
  });
  it('snapping works across 0 and 360, and the centre has no direction', () => {
    const wrap = angleFromPointer({ ...base, current: 5, snapValues: [0, 30], ...D(359) })!;
    expect(wrap).toEqual({ value: 0, snapped: true });
    expect(angleFromPointer({ ...base, dx: 0, dy: 0 })).toBeNull();
    expect(angleFromPointer({ ...base, dx: NaN, dy: 1 })).toBeNull();
  });
  it('a ratio listed twice is refused', () => {
    const d = JSON.parse(readFileSync('content/fixtures/trig-right-triangle.json', 'utf8'));
    d.scene.ratios = ['sin', 'sin'];
    expect(createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry }).validate(d).ok).toBe(false);
  });
  it('a wave asked for beyond 0 to 360 is drawn on 0 to 360 only; an equivalent angle still has its dot', () => {
    const wide = circle({ wave: { fn: 'sin', fromDeg: -720, toDeg: 720 } });
    const plain = circle({ wave: { fn: 'sin', fromDeg: 0, toDeg: 360 } });
    expect(JSON.stringify(wide.prims)).toBe(JSON.stringify(plain.prims));
    const neg = circle({ angleDeg: -30, wave: { fn: 'sin', fromDeg: 0, toDeg: 360 } });
    const dot = neg.prims.filter((p: any) => p.t === 'dot').pop() as any;
    near(dot.x, 215 + (330 / 360) * 170, 1e-9);
    const full = circle({ angleDeg: 360, wave: { fn: 'sin', fromDeg: 0, toDeg: 360 } });
    near((full.prims.filter((p: any) => p.t === 'dot').pop() as any).x, 385, 1e-9);
  });
  it('the arc and its number agree for a negative angle; the wave axis is labelled 1 and −1', () => {
    expect(texts(circle({ angleDeg: -30 }))).toContain('330°');
    expect(texts(circle({ wave: { fn: 'sin', fromDeg: 0, toDeg: 360 } }))).toEqual(expect.arrayContaining(['1', '−1']));
  });
  const load = () => JSON.parse(readFileSync('content/fixtures/trig-unit-circle.json', 'utf8')) as any;
  const html = (edit: (d: any) => void, props: Record<string, unknown> = {}) => {
    const topic = load();
    edit(topic);
    return renderToString(createElement(NextIntlClientProvider, { locale: 'en', messages: en, children: createElement(UnitCircleViewer, { topic, ...props }) }));
  };
  const tangentLines = (out: string) => out.match(/<line[^>]*stroke-accent/g)?.length ?? 0;
  it('the Show tangent toggle decides whether the tangent is drawn; a `when` that cannot be computed draws none', () => {
    const setDefault = (v: number) => (d: any) => (d.parameters.find((p: any) => p.id === 'showTangent').default = v);
    expect(tangentLines(html(setDefault(0)))).toBe(0);
    expect(tangentLines(html(setDefault(1)))).toBe(2);
    expect(tangentLines(html((d) => { setDefault(1)(d); d.scene.tangent.when = '1/0'; }))).toBe(0);
    expect(tangentLines(html((d) => { setDefault(1)(d); delete d.scene.tangent.when; }))).toBe(2);
    expect(tangentLines(html((d) => { setDefault(1)(d); delete d.scene.tangent; }))).toBe(0);
  });
  it('with an angle in radians the handle says the same degrees and spans the radian range', () => {
    const out = html((d) => Object.assign(d.parameters.find((x: any) => x.id === 'angle'), { unit: 'rad', min: 0, max: 6.2832, step: 0.01, default: Math.PI / 6 }));
    expect(out).toContain('aria-valuetext="30 degrees, sine 0.5, cosine 0.866"');
    expect(out).toContain('aria-valuemax="6.2832"');
  });
});
