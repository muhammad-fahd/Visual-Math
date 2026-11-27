/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a JSON document by path; a typed model of it would hide what they check */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import { createProgram } from '../../src/lib/params';
import { fillFormula, type Bound } from '../../src/lib/text';
import { createTopicValidator, defaultSceneRegistry, type Problem } from '../../src/lib/topic-schema';
import { DIMS, KINDS } from '../../src/lib/solid';

// The cone fixture is a whole topic: it must pass the schema, its formula checks must come out as it
// says (NFR-6.2, what Story 7.1 will do at upload), and `solid3d@1` must hold every kind.

const cone = () => JSON.parse(readFileSync('content/fixtures/geo-cone-volume.json', 'utf8')) as Record<string, any>;
const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const errors = (doc: unknown): Problem[] => {
  const r = validator.validate(doc);
  if (r.ok) throw new Error('expected problems, the topic is valid');
  return r.problems;
};
const mutated = (edit: (d: Record<string, any>) => void) => {
  const d = cone();
  edit(d);
  return d;
};

afterEach(() => vi.unstubAllEnvs());

describe('the cone topic', () => {
  it('passes the topic schema', () => {
    const r = validator.validate(cone());
    expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
  });

  it('every formula check comes out as the topic says, to its decimals', () => {
    const topic = cone();
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const defaults = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
    for (const f of topic.formulas) {
      for (const check of f.checks ?? []) {
        const scope = program.scope({ ...defaults, ...check.at });
        for (const [name, expected] of Object.entries(check.expect) as [string, number][]) {
          const b = f.bind[name];
          const got = program.evaluate(b.expr, scope);
          expect(Math.abs(got - expected), `${f.id}.${name} at ${JSON.stringify(check.at)}`).toBeLessThanOrEqual(0.5 * 10 ** -b.decimals);
        }
      }
    }
  });

  it('the live formula reads V = 1/3 x pi x r^2 x h = 94.2 at the start (FR-3.8)', () => {
    const topic = cone();
    const program = createProgram(['r', 'h'], topic.derived);
    const scope = program.scope({ r: 3, h: 10 });
    const f = topic.formulas[0];
    const bound: Record<string, Bound> = {};
    for (const [name, b] of Object.entries(f.bind) as [string, any][]) bound[name] = { value: program.evaluate(b.expr, scope), decimals: b.decimals };
    expect(fillFormula(f.latex, bound)).toBe(String.raw`V = \tfrac{1}{3} \times \pi \times 3.0^2 \times 10.0 = 94.2\ \text{cm}^3`);
  });

  it('the worked example recomputes to what it says', () => {
    const topic = cone();
    const ex = topic.example;
    const program = createProgram(ex.inputs.map((i: any) => i.id), ex.lines.map((l: any) => l.calc && { id: l.calc.name, expr: l.calc.expr }).filter(Boolean));
    const scope = program.scope(Object.fromEntries(ex.inputs.map((i: any) => [i.id, i.default])));
    for (const l of ex.lines) if (l.calc) expect(Math.abs(scope[l.calc.name]! - l.calc.expect)).toBeLessThanOrEqual(0.5 * 10 ** -l.calc.decimals);
  });
});

describe('solid3d@1', () => {
  const withSolid = (solid: unknown) => mutated((d) => (d.scene.solid = solid));
  const dimsFor = (kind: (typeof KINDS)[number]) => Object.fromEntries(DIMS[kind].map((n) => [n, n === 'sides' ? 5 : 'r']));

  it.each(KINDS)('%s takes its dimensions, as numbers or expressions of the parameters', (kind) => {
    expect(validator.validate(withSolid({ kind, dims: dimsFor(kind) })).ok).toBe(true);
    expect(validator.validate(withSolid({ kind, dims: Object.fromEntries(DIMS[kind].map((n) => [n, n === 'sides' ? 4 : 2.5])) })).ok).toBe(true);
  });
  it.each(KINDS)('%s refuses a missing dimension, a dimension of another kind, and an unknown key', (kind) => {
    const dims = dimsFor(kind);
    const first = DIMS[kind][0]!;
    expect(validator.validate(withSolid({ kind, dims: Object.fromEntries(Object.entries(dims).filter(([k]) => k !== first)) })).ok).toBe(false);
    expect(validator.validate(withSolid({ kind, dims: { ...dims, spare: 1 } })).ok).toBe(false);
    expect(validator.validate(withSolid({ kind, dims, extra: true })).ok).toBe(false);
  });
  it('an unknown kind, sides outside 3 to 12 and an unknown scene key are problems, not crashes', () => {
    expect(validator.validate(withSolid({ kind: 'torus', dims: { radius: 1 } })).ok).toBe(false);
    expect(validator.validate(withSolid({ kind: 'prism', dims: { sides: 2, side: 1, height: 1 } })).ok).toBe(false);
    expect(validator.validate(withSolid({ kind: 'prism', dims: { sides: 13, side: 1, height: 1 } })).ok).toBe(false);
    expect(validator.validate(withSolid({ kind: 'prism', dims: { sides: 4.5, side: 1, height: 1 } })).ok).toBe(false);
    expect(validator.validate(mutated((d) => (d.scene.section = { enabled: 1 }))).ok).toBe(false); // a section needs a plane
    expect(validator.validate(mutated((d) => delete d.scene.solid)).ok).toBe(false);
    expect(errors(mutated((d) => (d.scene.labels = { dimensions: 'yes' }))).some((p) => p.pointer === '/scene/labels/dimensions')).toBe(true);
  });
  it('a camera is a preset or an angle pair with a distance', () => {
    expect(validator.validate(mutated((d) => (d.scene.camera = { azimuth: 30, elevation: 20, distance: 5 }))).ok).toBe(true);
    expect(validator.validate(mutated((d) => (d.scene.camera = { preset: 'top' }))).ok).toBe(true);
    expect(validator.validate(mutated((d) => (d.scene.camera = { preset: 'underneath' }))).ok).toBe(false);
  });
});

describe('the solid harness is not part of the site', () => {
  const query = (topic?: string) => ({ searchParams: Promise.resolve(topic ? { topic } : {}) });
  it('without VM_HARNESS the page is a 404; with exactly 1 it renders the viewer', async () => {
    const { default: Harness } = await import('../../src/app/[locale]/dev/solid/page');
    vi.stubEnv('VM_HARNESS', '');
    await expect(Harness(query())).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404') });
    vi.stubEnv('VM_HARNESS', 'true');
    await expect(Harness(query())).rejects.toBeDefined();
    vi.stubEnv('VM_HARNESS', '1');
    await expect(Harness(query())).resolves.toBeDefined();
  });
  it('?topic= picks a fixture; an unknown or odd value falls back to the cone', async () => {
    vi.stubEnv('VM_HARNESS', '1');
    const { default: Harness } = await import('../../src/app/[locale]/dev/solid/page');
    const idOf = async (topic?: string) => ((await Harness(query(topic))) as any).props.children.props.topic.title.en as string;
    expect(await idOf('section')).toBe('Cutting a Cone');
    expect(await idOf('net')).toBe('The Net of a Cylinder');
    expect(await idOf('fill')).toBe('Filling a Cylinder');
    for (const odd of ['nope', '__proto__', 'constructor', 'toString', '']) expect(await idOf(odd)).toBe('The Volume of a Cone');
  });
  it('it decides per request, so a build without the variable cannot bake a 404 in', () => {
    expect(readFileSync('src/app/[locale]/dev/solid/page.tsx', 'utf8')).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('the fixtures of Story 2.5', () => {
  const load = (id: string) => JSON.parse(readFileSync(`content/fixtures/${id}.json`, 'utf8')) as Record<string, any>;
  it.each(['geo-cone-section', 'geo-cylinder-net', 'geo-cylinder-fill'])('%s passes the topic schema', (id) => {
    const r = validator.validate(load(id));
    expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
  });
  it.each(['geo-cone-section', 'geo-cylinder-net', 'geo-cylinder-fill'])('%s: every formula check and the worked example come out as the topic says', (id) => {
    const topic = load(id);
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const defaults = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
    for (const f of topic.formulas) {
      for (const check of f.checks ?? []) {
        const scope = program.scope({ ...defaults, ...check.at });
        for (const [name, expected] of Object.entries(check.expect) as [string, number][]) {
          const b = f.bind[name];
          expect(Math.abs(program.evaluate(b.expr, scope) - expected), `${f.id}.${name}`).toBeLessThanOrEqual(0.5 * 10 ** -b.decimals);
        }
      }
    }
    const ex = topic.example;
    const calc = createProgram(ex.inputs.map((i: any) => i.id), ex.lines.map((l: any) => l.calc && { id: l.calc.name, expr: l.calc.expr }).filter(Boolean));
    const scope = calc.scope(Object.fromEntries(ex.inputs.map((i: any) => [i.id, i.default])));
    for (const l of ex.lines) if (l.calc) expect(Math.abs(scope[l.calc.name]! - l.calc.expect)).toBeLessThanOrEqual(0.5 * 10 ** -l.calc.decimals);
  });
});
