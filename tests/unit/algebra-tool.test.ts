/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { AlgebraToolViewer, type AlgebraToolTopic } from '../../src/features/scene';
import { buildTool, factorTiles, polyText, sideText, type Built, type Tool } from '../../src/lib/algebra';
import { createProgram } from '../../src/lib/params';
import { createSceneRegistry, createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { checkSolverLines } from '../../src/lib/topic-schema/scenes/algebra-tool';
import { NumberModel } from '../../src/scenes/numbermodel';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 3.4: the four algebra tools as pictures and text, the step solver's check at upload (E_SOLVER_LINE),
// and the registry hook that runs it. Each row of the spec's I/O matrix has a test here.

const build = (tool: Tool, params: Record<string, number> = {}, hidden?: Set<string>): Built => {
  const program = createProgram(Object.keys(params));
  return buildTool({ tool, program, scope: program.scope(params), hidden });
};
const rects = (b: Built) => b.prims.filter((p) => p.t === 'rect');
const keys = (b: Built) => b.sentences.map((s) => s.key);
const sentence = (b: Built, key: string) => b.sentences.find((s) => s.key === key);
const texts = (b: Built) => (b.prims.filter((p) => p.t === 'text') as any[]).map((p) => p.text as string);

describe('text of polynomials and sides', () => {
  it('leaves out unit coefficients and zero terms', () => {
    expect(polyText(1, 5, 6)).toBe('x² + 5x + 6');
    expect(polyText(2, 0, 1)).toBe('2x² + 1');
    expect(polyText(0, 1, 0)).toBe('x');
    expect(polyText(0, 0, 0)).toBe('0');
    expect(sideText(2, 3)).toBe('2x + 3');
    expect(sideText(1, 0)).toBe('x');
    expect(sideText(0, 7)).toBe('7');
    expect(sideText(0, 0)).toBe('0');
  });
});

describe('balance scale', () => {
  const scale = (extra: object = {}): Tool => ({ kind: 'balanceScale', left: { xs: 'a', ones: 3 }, right: { xs: 0, ones: 11 }, x: 'w', ...extra }) as Tool;
  const beamOf = (b: Built) => b.prims.find((p) => p.t === 'line' && (p as any).width === 4 && (p as any).x1 < 100) as any;
  it('2x + 3 against 11 with x = 1 tips right; with x = 4 it is level; with x = 5 it tips left', () => {
    const p = (w: number) => ({ a: 2, w });
    const right = build(scale(), p(1));
    expect(keys(right)).toEqual(['balance', 'tipsRight']);
    expect(sentence(right, 'balance')!.values).toEqual({ left: '2x + 3', right: '11', l: '5', r: '11', x: '1' });
    const level = build(scale(), p(4));
    expect(keys(level)).toEqual(['balance', 'balanced']);
    const left = build(scale(), p(5));
    expect(keys(left)).toContain('tipsLeft');
  });
  it('the heavier side is lower; a level beam is flat', () => {
    const end = (b: Built) => {
      const beam = beamOf(b);
      return { leftY: beam.y1, rightY: beam.y2 };
    };
    const tipsRight = end(build(scale(), { a: 2, w: 1 }));
    expect(tipsRight.rightY).toBeGreaterThan(tipsRight.leftY);
    const tipsLeft = end(build(scale(), { a: 2, w: 5 }));
    expect(tipsLeft.leftY).toBeGreaterThan(tipsLeft.rightY);
    const level = end(build(scale(), { a: 2, w: 4 }));
    expect(level.leftY).toBe(level.rightY);
  });
  it('draws a block for each x and each one; counts are clamped to 10 and 20; labels can be hidden', () => {
    const b = build(scale(), { a: 2, w: 4 });
    expect(rects(b).filter((r: any) => r.w === 26)).toHaveLength(2);
    expect(rects(b).filter((r: any) => r.w === 12)).toHaveLength(14); // 3 + 11
    const big = build({ kind: 'balanceScale', left: { xs: 12, ones: 30 }, right: { xs: 0, ones: 0 }, x: 1 });
    expect(sentence(big, 'balance')!.values['left']).toBe('10x + 20');
    expect(texts(build(scale(), { a: 2, w: 4 }, new Set(['labels']))).length).toBeLessThan(texts(b).length);
    expect(texts(build(scale(), { a: 2, w: 4 }, new Set(['labels'])))).toEqual([]);
  });
  it('a count or weight that cannot be computed draws nothing', () => {
    expect(build(scale({ x: '1/0' }), { a: 2 }).prims).toEqual([]);
    expect(build(scale({ left: { xs: 'nope(', ones: 1 } }), {}).prims).toEqual([]);
  });
});

describe('algebra tiles', () => {
  const tiles = (x2: number, x: number, one: number, mode: 'expand' | 'factor' = 'factor'): Tool => ({ kind: 'algebraTiles', terms: { x2, x, one }, mode });
  it('x^2 + 5x + 6 is the rectangle (x + 2)(x + 3), with 1 + 5 + 6 tiles', () => {
    const b = build(tiles(1, 5, 6));
    expect(sentence(b, 'factor')!.values).toEqual({ poly: 'x² + 5x + 6', sides: '(x + 2)(x + 3)' });
    expect(rects(b)).toHaveLength(12);
  });
  it('expand reads the sides first', () => {
    expect(keys(build(tiles(1, 5, 6, 'expand')))).toEqual(['expand']);
  });
  it('x^2 + 2x + 5 has no rectangle: a pile and a sentence that says so; so does a set with no x^2 tile', () => {
    const b = build(tiles(1, 2, 5));
    expect(keys(b)).toEqual(['noRectangle']);
    expect(rects(b)).toHaveLength(8);
    expect(keys(build(tiles(0, 3, 2)))).toEqual(['noRectangle']);
  });
  it('the search finds m, n, p, q that satisfy all three equations, or nothing', () => {
    for (const [a, b, c] of [[1, 5, 6], [2, 7, 3], [1, 2, 1], [4, 4, 1], [1, 3, 0], [2, 3, 1], [6, 5, 1]] as const) {
      const f = factorTiles(a, b, c)!;
      expect(f, `${a} ${b} ${c}`).not.toBeNull();
      expect(f.m * f.n).toBe(a);
      expect(f.p * f.q).toBe(c);
      expect(f.m * f.q + f.n * f.p).toBe(b);
    }
    expect(factorTiles(1, 2, 5)).toBeNull();
    expect(factorTiles(0, 2, 1)).toBeNull();
  });
  it('counts are clamped; labels can be hidden; nothing is drawn for a count that cannot be computed', () => {
    expect(sentence(build(tiles(9, 0, 0)), 'factor')!.values['poly']).toBe('6x²'); // 9 is clamped to 6
    expect(texts(build(tiles(1, 5, 6), {}, new Set(['labels']))).length).toBeLessThan(texts(build(tiles(1, 5, 6))).length);
    expect(build({ kind: 'algebraTiles', terms: { x2: 'nope(', x: 1, one: 1 }, mode: 'factor' }).prims).toEqual([]);
  });
});

describe('function machine', () => {
  const machine = (extra: object = {}): Tool => ({ kind: 'functionMachine', input: 'i', rule: '2*x + 1', showRule: true, ...extra }) as Tool;
  it('2x + 1 takes 3 and gives 7, and the rule is shown', () => {
    const b = build(machine(), { i: 3 });
    expect(sentence(b, 'machine')!.values).toEqual({ input: '3', output: '7' });
    expect(sentence(b, 'rule')!.values).toEqual({ rule: '2*x + 1' });
    expect(texts(b)).toContain('2*x + 1');
    expect(texts(b)).toContain('7');
  });
  it('a hidden rule (the tool or a step) is out of the picture and the text', () => {
    for (const b of [build(machine({ showRule: false }), { i: 3 }), build(machine(), { i: 3 }, new Set(['rule']))]) {
      expect(keys(b)).toEqual(['machine']);
      expect(texts(b)).not.toContain('2*x + 1');
      expect(texts(b)).toContain('?');
    }
  });
  it('a rule with no value reads undefined; a bad input draws nothing; a hostile rule is not a throw', () => {
    const b = build(machine({ rule: '1/0' }), { i: 3 });
    expect(keys(b)).toContain('machineUndefined');
    expect(texts(b)).toContain('—');
    expect(build(machine(), { i: NaN }).prims).toEqual([]);
    expect(() => build(machine({ rule: 'constructor(1)' }), { i: 3 })).not.toThrow();
    expect(keys(build(machine({ rule: 'constructor(1)' }), { i: 3 }))).toContain('machineUndefined');
  });
});

describe('step solver view', () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ latex: `x = ${i}`, lhs: 'x', rhs: String(i), note: { en: `n${i}`, ur: `ن${i}` } }));
  const solver = (n = 4): Tool => ({ kind: 'stepSolver', variable: 'x', solution: 0, lines: lines(n), reveal: 'm' });
  it('shows the lines up to `reveal`, clamped to 1 and to the number of lines', () => {
    expect(build(solver(), { m: 2 }).solver!.revealed).toBe(2);
    expect(build(solver(), { m: 0 }).solver!.revealed).toBe(1);
    expect(build(solver(), { m: 9 }).solver!.revealed).toBe(4);
    expect(build(solver(), { m: 2.6 }).solver!.revealed).toBe(3);
    expect(build(solver(), {}).solver!.revealed).toBe(1);
    expect(build(solver(), { m: 2 }).prims).toEqual([]);
  });
  it('a step that hides `notes` takes the notes out', () => {
    expect(build(solver(), { m: 2 }).solver!.notes).toBe(true);
    expect(build(solver(), { m: 2 }, new Set(['notes'])).solver!.notes).toBe(false);
  });
});

describe('the step solver check at upload (E_SOLVER_LINE)', () => {
  const scene = (lines: { lhs: string; rhs: string }[], extra: object = {}) => ({ tool: { kind: 'stepSolver', variable: 'x', solution: 4, lines, ...extra } });
  it('true lines pass', () => {
    expect(checkSolverLines(scene([{ lhs: '2*x + 3', rhs: '11' }, { lhs: '2*x', rhs: '8' }, { lhs: 'x', rhs: '4' }]))).toEqual([]);
  });
  it('a false line names its number, the variable, the solution and its place', () => {
    const p = checkSolverLines(scene([{ lhs: '2*x + 3', rhs: '11' }, { lhs: '2*x', rhs: '9' }]));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ code: 'E_SOLVER_LINE', severity: 'error', pointer: '/scene/tool/lines/1', message: 'stepSolver line 2 is not true at x = 4.' });
  });
  it('an expression that does not parse is E_EXPR_SYNTAX at that side, and an unknown name is refused', () => {
    const p = checkSolverLines(scene([{ lhs: '2*', rhs: '8' }, { lhs: 'y', rhs: '4' }]));
    expect(p.map((x) => x.code)).toEqual(['E_EXPR_SYNTAX', expect.stringMatching(/^E_EXPR/)]);
    expect(p[0]!.pointer).toBe('/scene/tool/lines/0/lhs');
  });
  it('rounding is tolerated; a side with no value is not equal to anything', () => {
    expect(checkSolverLines(scene([{ lhs: '0.1 + 0.2', rhs: '0.3' }], { solution: 4 }))).toEqual([]);
    expect(checkSolverLines(scene([{ lhs: '1/0', rhs: '1/0' }]))).toHaveLength(1);
  });
  it('nothing else is checked, and nothing throws on odd input', () => {
    for (const odd of [null, undefined, 3, 'x', {}, { tool: null }, { tool: { kind: 'balanceScale' } }, { tool: { kind: 'stepSolver' } }, { tool: { kind: 'stepSolver', variable: 'x', solution: 1, lines: [null, 3, {}] } }]) {
      expect(() => checkSolverLines(odd)).not.toThrow();
      expect(checkSolverLines(odd)).toEqual([]);
    }
  });
});

describe('the registry check hook', () => {
  const registry = createSceneRegistry(
    defaultSceneRegistry.definitions.map((d) => (d.type === 'canvas2d' ? { ...d, check: () => [{ code: 'W_PROBE', severity: 'warning' as const, pointer: '/scene', message: 'a warning' }] } : d)),
  );
  it('a warning from a check is kept and the topic is still valid', () => {
    const v = createTopicValidator({ locales: LOCALES, registry });
    const doc = JSON.parse(readFileSync('content/fixtures/alg-quadratic-graph.json', 'utf8'));
    const r = v.validate(doc);
    expect(r.ok).toBe(true);
    expect(r.problems.some((p) => p.code === 'W_PROBE')).toBe(true);
  });
});

describe('the schema and the fixtures (algebra-tool@1)', () => {
  const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
  const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
  const ok = (name: string, edit: (d: any) => void) => {
    const d = load(name);
    edit(d);
    return validator.validate(d);
  };
  it('both fixture topics pass', () => {
    for (const name of ['alg-balance-scale', 'alg-solve-steps']) {
      const r = validator.validate(load(name));
      expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
    }
  });
  it('a topic with a false solver line fails upload with E_SOLVER_LINE', () => {
    const r = ok('alg-solve-steps', (d) => (d.scene.tool.lines[2].rhs = '9'));
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.code)).toContain('E_SOLVER_LINE');
    expect(r.problems.find((p) => p.code === 'E_SOLVER_LINE')!.pointer).toBe('/scene/tool/lines/2');
    expect(ok('alg-solve-steps', (d) => (d.scene.tool.solution = 5)).ok).toBe(false);
  });
  it('refuses an unknown tool, an unknown key, one or nine lines, a bad mode and a missing tool', () => {
    expect(ok('alg-solve-steps', (d) => (d.scene.tool.kind = 'abacus')).ok).toBe(false);
    expect(ok('alg-solve-steps', (d) => (d.scene.tool.extra = 1)).ok).toBe(false);
    expect(ok('alg-solve-steps', (d) => (d.scene.tool.lines = d.scene.tool.lines.slice(0, 1))).ok).toBe(false);
    expect(ok('alg-solve-steps', (d) => (d.scene.tool.lines = Array.from({ length: 9 }, () => d.scene.tool.lines[0]))).ok).toBe(false);
    expect(ok('alg-balance-scale', (d) => (d.scene.tool = { kind: 'algebraTiles', terms: { x2: 1, x: 5, one: 6 }, mode: 'multiply' })).ok).toBe(false);
    expect(ok('alg-balance-scale', (d) => delete d.scene.tool).ok).toBe(false);
  });
  it('accepts every tool', () => {
    const tools = [
      { kind: 'algebraTiles', terms: { x2: 1, x: 5, one: 6 }, mode: 'factor' },
      { kind: 'functionMachine', input: 'a', rule: '2*x + 1', showRule: true },
    ];
    for (const tool of tools) expect(ok('alg-balance-scale', (d) => (d.scene.tool = tool)).ok, tool.kind).toBe(true);
  });
  it('the formula checks of the balance topic come out as the topic says', () => {
    const topic = load('alg-balance-scale');
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

describe('every message the tools use resolves (English and Urdu)', () => {
  it('no key, brace or placeholder is left', () => {
    const tools: Tool[] = [
      { kind: 'balanceScale', left: { xs: 2, ones: 3 }, right: { xs: 0, ones: 11 }, x: 4 },
      { kind: 'balanceScale', left: { xs: 2, ones: 3 }, right: { xs: 0, ones: 11 }, x: 1 },
      { kind: 'balanceScale', left: { xs: 2, ones: 3 }, right: { xs: 0, ones: 11 }, x: 5 },
      { kind: 'algebraTiles', terms: { x2: 1, x: 5, one: 6 }, mode: 'factor' },
      { kind: 'algebraTiles', terms: { x2: 1, x: 5, one: 6 }, mode: 'expand' },
      { kind: 'algebraTiles', terms: { x2: 1, x: 2, one: 5 }, mode: 'factor' },
      { kind: 'functionMachine', input: 3, rule: '2*x + 1', showRule: true },
      { kind: 'functionMachine', input: 3, rule: '1/0', showRule: true },
    ];
    for (const [locale, messages] of [['en', en], ['ur', ur]] as const) {
      const t = createTranslator({ locale, messages: messages as any, namespace: 'algebra' });
      for (const tool of tools) {
        for (const s of build(tool).sentences) expect(t(`sentence.${s.key}` as any, s.values as any), `${locale} ${s.key}`).not.toMatch(/algebra\.|sentence\.|[{}]/);
      }
      expect(t('solver.move' as any, { n: 1, total: 5, text: 'x = 4', note: 'note' } as any)).not.toMatch(/[{}]/);
    }
  });
});

describe('the viewer (server HTML)', () => {
  const load = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
  const html = (name: string, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
    renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(AlgebraToolViewer, { topic: load(name) as AlgebraToolTopic, ...props }) }));
  it('the balance scale has the picture and the sentences', () => {
    const out = html('alg-balance-scale');
    expect(out).toContain('data-number-model');
    expect(out).toContain('The left pan holds 2x + 3 (that is 5) and the right pan holds 11 (that is 11), when x is 1.');
    expect(out).toContain('The scale tips to the right.');
  });
  it('the solver shows the first line and its note, and not the second until it is revealed', () => {
    const out = html('alg-solve-steps');
    expect(out).toContain('data-algebra-solver');
    expect(out).toContain('data-line="1"');
    expect(out).not.toContain('data-line="2"');
    expect(out).toContain('Start with the equation.');
    const three = html('alg-solve-steps', 'en', { step: { index: 1, params: { m: 3 }, hidden: new Set() } });
    expect(three).toContain('data-line="1"');
  });
  it('is in Urdu on /ur with the picture kept left to right', () => {
    const urdu = html('alg-balance-scale', 'ur');
    expect(urdu).toContain('ترازو');
    expect(urdu).toContain('dir="ltr"');
    expect(html('alg-solve-steps', 'ur')).toContain('مساوات سے شروع کریں۔');
  });
  it('the three picture tools render to static markup with no listeners, hex colors or NaN', () => {
    const all = [
      build({ kind: 'balanceScale', left: { xs: 2, ones: 3 }, right: { xs: 0, ones: 11 }, x: 4 }),
      build({ kind: 'algebraTiles', terms: { x2: 1, x: 5, one: 6 }, mode: 'factor' }),
      build({ kind: 'algebraTiles', terms: { x2: 2, x: 3, one: 4 }, mode: 'factor' }),
      build({ kind: 'functionMachine', input: 3, rule: '2*x + 1', showRule: true }),
    ];
    for (const b of all) {
      const markup = renderToStaticMarkup(createElement(NumberModel, { prims: b.prims }));
      expect(markup).not.toMatch(/ on[A-Z]\w+=|onclick/i);
      expect(markup).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/);
      expect(markup).not.toMatch(/NaN|Infinity/);
    }
  });
});
