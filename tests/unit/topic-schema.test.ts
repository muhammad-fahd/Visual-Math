/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a JSON document by path; a typed model of it would hide what they check */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LOCALES } from '../../src/i18n/locales';
import {
  CURRENT_SCHEMA_VERSION,
  createSceneRegistry,
  createTopicValidator,
  defaultSceneRegistry,
  formatProblem,
  migrate,
  type Problem,
} from '../../src/lib/topic-schema';

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;
const example = () => json('content/fixtures/trig-unit-circle.json');
const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const check = (doc: unknown) => validator.validate(doc);
const errors = (doc: unknown): Problem[] => {
  const r = check(doc);
  if (r.ok) throw new Error('expected problems, the topic is valid');
  return r.problems;
};
const codes = (doc: unknown) => errors(doc).map((p) => p.code);
const only = (doc: unknown, code: string) => errors(doc).filter((p) => p.code === code);
/** A copy of the worked example, changed by `edit`. */
const mutated = (edit: (d: Record<string, any>) => void) => {
  const d = example();
  edit(d);
  return d;
};

describe('the worked example (topic-format section 6)', () => {
  it('is the same JSON as the document shows (one fixture, one source)', () => {
    const doc = readFileSync('_bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/topic-format.md', 'utf8');
    const section = doc.slice(doc.indexOf('## 6. Worked example'));
    const block = /```json\n([\s\S]*?)\n```/.exec(section)![1]!;
    expect(JSON.parse(block)).toEqual(example());
  });
  it('validates with no problems at all', () => {
    const r = check(example());
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });
  it('an empty quiz is fine and gives no warning', () => {
    expect(check({ ...example(), quiz: [] }).problems).toEqual([]);
  });
  it('the result is the topic, deeply equal to the input', () => {
    const r = check(example());
    if (!r.ok) throw new Error('invalid');
    expect(r.value).toEqual(example());
  });
});

describe('unknown keys (E_UNKNOWN_KEY)', () => {
  it('at the top level, in a step, in the scene, in a parameter, in nested objects', () => {
    const p = errors(
      mutated((d) => {
        d.extra = 1;
        d.steps[0].zzz = 2;
        d.scene.nope = 3;
        d.parameters[0].colour = 'x';
        d.example.answer.html = '<b>';
        d.path.country = 'x';
        d.formulas[0].identity = { lhs: '1', rhs: '1', extra: 2 };
      }),
    );
    expect(p.filter((x) => x.code === 'E_UNKNOWN_KEY').map((x) => x.pointer).sort()).toEqual([
      '/example/answer/html',
      '/extra',
      '/formulas/0/identity/extra',
      '/parameters/0/colour',
      '/path/country',
      '/scene/nope',
      '/steps/0/zzz',
    ]);
  });
  it('names the allowed keys', () => {
    const p = only(mutated((d) => (d.extra = 1)), 'E_UNKNOWN_KEY')[0]!;
    expect(p.message).toMatch(/^Unknown key 'extra'\. Allowed: schemaVersion, id, path, chapterOrder,/);
    expect(p.message).toContain('quiz');
    const s = only(mutated((d) => (d.scene.nope = 1)), 'E_UNKNOWN_KEY')[0]!;
    expect(s.message).toContain('angle');
    expect(s.message).toContain('caption');
  });
  it('code-like and markup-like keys are unknown keys, not features', () => {
    for (const key of ['script', 'html', 'onclick', 'url', 'href', 'eval', 'style', 'color', '__proto__', 'constructor', 'prototype']) {
      const doc = example();
      Object.defineProperty(doc, key, { value: 'x', enumerable: true, configurable: true, writable: true });
      expect(codes(doc), key).toContain('E_UNKNOWN_KEY');
    }
  });
});

describe('scenes and the registry (E_UNKNOWN_SCENE_TYPE)', () => {
  it('an unregistered type names the type, the version and what is registered', () => {
    const p = only(mutated((d) => (d.scene.type = 'space3d')), 'E_UNKNOWN_SCENE_TYPE');
    expect(p).toHaveLength(1);
    expect(p[0]!.pointer).toBe('/scene');
    expect(p[0]!.message).toBe("Scene type 'space3d' v1 is not registered. Registered: algebra-tool@1, canvas2d@1, number-model@1, right-triangle@1, solid3d@1, unit-circle@1.");
  });
  it('a registered type at an unregistered version is unknown too', () => {
    const p = only(mutated((d) => (d.scene.v = 2)), 'E_UNKNOWN_SCENE_TYPE');
    expect(p[0]!.message).toContain("'unit-circle' v2");
  });
  it.each([[undefined], [null], [5], ['unit-circle'], [[]], [true]])('a scene that is %j is a problem, not a crash', (scene) => {
    const doc = example();
    doc.scene = scene;
    expect(check(doc).ok).toBe(false);
  });
  it('no type, no version, a version that is not an integer', () => {
    for (const edit of [(d: any) => delete d.scene.type, (d: any) => delete d.scene.v, (d: any) => (d.scene.v = 1.5), (d: any) => (d.scene.v = '1')]) {
      expect(codes(mutated(edit))).toContain('E_UNKNOWN_SCENE_TYPE');
    }
  });
  it('the scene is checked by its own schema, with pointers inside it', () => {
    const p = errors(
      mutated((d) => {
        delete d.scene.angle;
        d.scene.snap.within = -1;
        d.scene.wave.fn = 'sec';
        d.scene.quadrants = 'yes';
        d.scene.readouts[0].decimals = 9;
      }),
    ).map((x) => x.pointer);
    expect(p).toEqual(expect.arrayContaining(['/scene/angle', '/scene/snap/within', '/scene/wave/fn', '/scene/quadrants', '/scene/readouts/0/decimals']));
  });
  it('a registered fake type validates with no change to the schema (FR-3.30, AD-2)', () => {
    const fake = {
      type: 'fake',
      v: 1,
      partIds: ['a'],
      schema: (kit: any) => z.strictObject({ type: z.literal('fake'), v: z.literal(1), caption: kit.locText(120), size: z.number() }),
    };
    const v = createTopicValidator({ locales: LOCALES, registry: createSceneRegistry([...defaultSceneRegistry.definitions, fake]) });
    const doc = mutated((d) => (d.scene = { type: 'fake', v: 1, caption: { en: 'x', ur: 'ا' }, size: 3 }));
    expect(v.validate(doc).ok).toBe(true);
    expect(v.validate(mutated((d) => (d.scene = { type: 'fake', v: 1, caption: { en: 'x', ur: 'ا' }, size: 'big' }))).ok).toBe(false);
    expect(validator.validate(doc).ok).toBe(false); // and the default registry still refuses it
  });
  it('two versions of one type can coexist; the same pair twice is refused', () => {
    const v2 = { ...defaultSceneRegistry.definitions[0]!, v: 2, schema: (kit: any) => z.strictObject({ type: z.literal('unit-circle'), v: z.literal(2), caption: kit.locText(120), angle: kit.ident }) };
    const both = createSceneRegistry([...defaultSceneRegistry.definitions, v2]);
    expect(both.keys()).toEqual(['algebra-tool@1', 'canvas2d@1', 'number-model@1', 'right-triangle@1', 'solid3d@1', 'unit-circle@1', 'unit-circle@2']);
    expect(() => createSceneRegistry([v2, v2])).toThrow(/registered twice/);
    const v = createTopicValidator({ locales: LOCALES, registry: both });
    expect(v.validate(mutated((d) => (d.scene = { type: 'unit-circle', v: 2, caption: { en: 'x', ur: 'ا' }, angle: 'angle' }))).ok).toBe(true);
  });
  it('registry lookups never throw for odd inputs', () => {
    for (const [t, v] of [[undefined, undefined], [null, 1], ['__proto__', 1], ['constructor', 1], ['unit-circle', NaN], ['unit-circle', '1'], [{}, []]]) {
      expect(defaultSceneRegistry.get(t, v)).toBeUndefined();
    }
  });
  it('the fixed parts of unit-circle are the ones of topic-format 2.4', () => {
    expect(defaultSceneRegistry.get('unit-circle', 1)!.partIds).toEqual(['circle', 'point', 'radius', 'arc', 'cosine', 'sine', 'tangent', 'wave', 'quadrants']);
  });
});

describe('schemaVersion (E_SCHEMA_VERSION)', () => {
  it('a version above the current one is refused, alone', () => {
    const p = errors(mutated((d) => (d.schemaVersion = 2)));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ code: 'E_SCHEMA_VERSION', pointer: '/schemaVersion', message: 'schemaVersion 2 is not supported; this importer reads 1.' });
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
  it('0, negative, fractional, missing or not a number are schema errors', () => {
    for (const v of [0, -1, 1.5, '1', null, undefined]) {
      expect(codes(mutated((d) => (d.schemaVersion = v))), String(v)).toContain('E_SCHEMA');
    }
  });
  it('migrate: a chain of steps upgrades step by step and never mutates its input', () => {
    const input = { schemaVersion: 1, a: 1 };
    const chain = { 1: (d: Record<string, unknown>) => ({ ...d, b: 2 }), 2: (d: Record<string, unknown>) => ({ ...d, c: 3 }) };
    const r = migrate(input, chain, 3);
    expect(r).toEqual({ ok: true, value: { schemaVersion: 3, a: 1, b: 2, c: 3 }, problems: [] });
    expect(input).toEqual({ schemaVersion: 1, a: 1 });
    expect(migrate({ schemaVersion: 4 }, chain, 3).ok).toBe(false);
    expect(migrate({ schemaVersion: 1 }, {}, 3).ok).toBe(false); // a missing step is refused, not skipped
    expect(migrate({ schemaVersion: 3, a: 1 }, chain, 3)).toEqual({ ok: true, value: { schemaVersion: 3, a: 1 }, problems: [] });
  });
});

describe('the quiz field (W_QUIZ_IGNORED)', () => {
  it('a non-empty quiz is accepted with a warning that it is ignored', () => {
    const r = check({ ...example(), quiz: [{ q: 1 }] });
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([{ code: 'W_QUIZ_IGNORED', severity: 'warning', pointer: '/quiz', message: 'The quiz field is reserved and is ignored in version 1.' }]);
  });
  it('a quiz that is not a list is an error', () => {
    expect(codes({ ...example(), quiz: 'x' })).toContain('E_SCHEMA');
  });
});

describe('languages (E_LOCALE_MISSING, W_LOCALE_MISSING, E_LOCALE_EXTRA)', () => {
  it('a required Urdu text that is missing is E_LOCALE_MISSING at its pointer', () => {
    const p = errors(
      mutated((d) => {
        delete d.title.ur;
        delete d.steps[1].body.ur;
        delete d.example.lines[0].text.ur;
        delete d.scene.caption.ur;
        delete d.parameters[0].label.ur;
        delete d.scene.readouts[0].label.ur;
      }),
    ).filter((x) => x.code === 'E_LOCALE_MISSING');
    expect(p.map((x) => x.pointer).sort()).toEqual(['/example/lines/0/text/ur', '/parameters/0/label/ur', '/scene/caption/ur', '/scene/readouts/0/label/ur', '/steps/1/body/ur', '/title/ur']);
    expect(p.find((x) => x.pointer === '/title/ur')!.message).toBe("'ur' text is missing at /title/ur (required).");
  });
  it('missing tags in one language is E_LOCALE_MISSING', () => {
    const p = only(mutated((d) => delete d.tags.ur), 'E_LOCALE_MISSING');
    expect(p.map((x) => x.pointer)).toEqual(['/tags/ur']);
  });
  it('a missing default language (en) is missing too', () => {
    expect(only(mutated((d) => delete d.summary.en), 'E_LOCALE_MISSING')[0]!.pointer).toBe('/summary/en');
  });
  it('an empty string is not a text', () => {
    expect(codes(mutated((d) => (d.title.ur = '')))).toContain('E_SCHEMA');
  });
  it('optional texts: a missing Urdu is a warning, and the topic is still valid', () => {
    const r = check(
      mutated((d) => {
        delete d.formulas[0].caption.ur;
        delete d.scene.description.ur;
        delete d.terms[0].term.ur;
        delete d.terms[0].definition.ur;
        delete d.tryThis[1].ur;
        delete d.watchOut.ur;
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.problems.map((p) => p.pointer).sort()).toEqual(['/formulas/0/caption/ur', '/scene/description/ur', '/terms/0/definition/ur', '/terms/0/term/ur', '/tryThis/1/ur', '/watchOut/ur']);
    expect(r.problems.every((p) => p.code === 'W_LOCALE_MISSING' && p.severity === 'warning')).toBe(true);
    expect(r.problems[0]!.message).toMatch(/^'ur' text is missing at \/.* \(optional string\)\.$/);
  });
  it('optional fields that are absent altogether give no warning', () => {
    const r = check(
      mutated((d) => {
        delete d.tryThis;
        delete d.watchOut;
        delete d.terms;
        delete d.scene.description;
        delete d.formulas[0].caption;
      }),
    );
    expect(r.problems).toEqual([]);
  });
  it('the first language (en) is still required in an optional text', () => {
    expect(codes(mutated((d) => delete d.watchOut.en))).toContain('E_LOCALE_MISSING');
  });
  it('a language that is not configured is E_LOCALE_EXTRA', () => {
    const p = only(
      mutated((d) => {
        d.title.fr = 'Le cercle';
        d.tags.de = ['x'];
        d.watchOut.fr = 'x';
      }),
      'E_LOCALE_EXTRA',
    );
    expect(p.map((x) => x.pointer).sort()).toEqual(['/tags/de', '/title/fr', '/watchOut/fr']);
    expect(p[0]!.message).toMatch(/^Locale '.*' is not configured\.$/);
  });
  it('a new language needs no schema edit: with a fake locale the same schema code accepts it (NFR-7.4)', () => {
    const three = ['en', 'ur', 'xx'] as const;
    const v = createTopicValidator({ locales: three, registry: defaultSceneRegistry });
    const doc = JSON.parse(JSON.stringify(example(), (_k, value) => value) as string) as Record<string, any>;
    // Add 'xx' to every per-language object.
    const addLocale = (node: any): void => {
      if (Array.isArray(node)) return node.forEach(addLocale);
      if (typeof node !== 'object' || node === null) return;
      if ('en' in node && 'ur' in node) node.xx = Array.isArray(node.en) ? [...node.en] : `${node.en}`;
      Object.values(node).forEach(addLocale);
    };
    addLocale(doc);
    expect(v.validate(doc).ok).toBe(true);
    delete doc.title.xx;
    expect(v.validate(doc).problems.map((p) => p.pointer)).toEqual(['/title/xx']);
    expect(validator.validate({ ...doc, title: { ...doc.title, xx: 'x' } }).ok).toBe(false); // the two-language validator refuses xx
  });
  it('locale lists must be non-empty and distinct', () => {
    expect(() => createTopicValidator({ locales: [], registry: defaultSceneRegistry })).toThrow();
    expect(() => createTopicValidator({ locales: ['en', 'en'], registry: defaultSceneRegistry })).toThrow();
  });
});

describe('ids and names', () => {
  it('a topic id that is not a slug is E_ID_FORMAT', () => {
    for (const id of ['Trig', 'a', 'ab', 'trig_unit', 'trig--x', '-x-', 'x'.repeat(65), 'trig unit', 'trig.unit']) {
      const p = only(mutated((d) => (d.id = id)), 'E_ID_FORMAT').concat(errors(mutated((d) => (d.id = id))).filter((x) => x.pointer === '/id' && x.code !== 'E_ID_FORMAT'));
      expect(p.length, id).toBeGreaterThan(0);
    }
    expect(only(mutated((d) => (d.id = 'Trig_X')), 'E_ID_FORMAT')[0]!.message).toBe("'Trig_X' is not a valid id; use lowercase letters, digits and hyphens.");
  });
  it('parameter, derived and input ids are expression variables: no function names, constants or prototype names', () => {
    for (const name of ['sin', 'pi', 'e', 'tau', 'sum', 'if', 'min', 'constructor', 'prototype', 'nCr']) {
      expect(codes(mutated((d) => (d.parameters[0].id = name))), name).toContain('E_ID_FORMAT');
      expect(codes(mutated((d) => (d.derived[0].id = name))), name).toContain('E_ID_FORMAT');
      expect(codes(mutated((d) => (d.example.inputs[0].id = name))), name).toContain('E_ID_FORMAT');
    }
    expect(only(mutated((d) => (d.parameters[0].id = 'sin')), 'E_ID_FORMAT')[0]!.message).toMatch(/^'sin' is reserved/);
  });
  it('ids of the wrong shape: hyphen in an identifier, too long, leading digit, capital start', () => {
    for (const id of ['my-angle', 'a'.repeat(17), '1angle', 'Angle', '', 'a b']) {
      expect(codes(mutated((d) => (d.parameters[0].id = id))), id).toEqual(expect.arrayContaining([expect.stringMatching(/^E_/)]));
    }
  });
  it('part, step and formula ids may use hyphens; they are not expression variables', () => {
    const r = check(mutated((d) => (d.steps[0].id = 'drag-the-point')));
    expect(r.ok).toBe(true);
    expect(codes(mutated((d) => (d.steps[0].id = 'Drag')))).toContain('E_ID_FORMAT');
  });
  it('records keyed by ids refuse __proto__, constructor and function names as keys', () => {
    for (const key of ['__proto__', 'constructor', 'prototype', 'sin', 'pi']) {
      const doc = example();
      const bind: Record<string, unknown> = JSON.parse('{}') as Record<string, unknown>;
      Object.defineProperty(bind, key, { value: { expr: '1', decimals: 1 }, enumerable: true, configurable: true, writable: true });
      doc.formulas[0].bind = bind;
      expect(codes(doc), key).toContain('E_ID_FORMAT');
      const at = JSON.parse('{}') as Record<string, unknown>;
      Object.defineProperty(at, key, { value: 1, enumerable: true, configurable: true, writable: true });
      doc.steps[0].sceneState = { params: at };
      expect(errors(doc).some((p) => p.pointer.startsWith('/steps/0/sceneState/params')), key).toBe(true);
    }
  });
  it('nothing reaches Object.prototype while a hostile document is checked', () => {
    const doc = JSON.parse('{"__proto__": {"polluted": 1}, "constructor": {"prototype": {"polluted": 2}}}') as unknown;
    check(doc);
    check(mutated((d) => (d.formulas[0].bind = JSON.parse('{"__proto__": {"expr":"1","decimals":1}}'))));
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('types, sizes and counts (E_SCHEMA, E_RANGE)', () => {
  it('a wrong type says what was expected and what was found, with a pointer', () => {
    const p = only(mutated((d) => (d.chapterOrder = 'x')), 'E_SCHEMA')[0]!;
    expect(p.pointer).toBe('/chapterOrder');
    expect(p.message).toMatch(/expected number.*got string/);
  });
  it.each([
    ['title 81 chars', (d: any) => (d.title.en = 'x'.repeat(81)), '/title/en'],
    ['summary 161', (d: any) => (d.summary.en = 'x'.repeat(161)), '/summary/en'],
    ['goal 201', (d: any) => (d.goal.ur = 'x'.repeat(201)), '/goal/ur'],
    ['step body 401', (d: any) => (d.steps[0].body.en = 'x'.repeat(401)), '/steps/0/body/en'],
    ['step title 61', (d: any) => (d.steps[0].title.en = 'x'.repeat(61)), '/steps/0/title/en'],
    ['scene caption 121', (d: any) => (d.scene.caption.en = 'x'.repeat(121)), '/scene/caption/en'],
    ['9 parameters', (d: any) => (d.parameters = Array.from({ length: 9 }, (_, i) => ({ ...d.parameters[0], id: `p${i}` }))), '/parameters'],
    ['0 parameters', (d: any) => (d.parameters = []), '/parameters'],
    ['2 steps', (d: any) => (d.steps = d.steps.slice(0, 2)), '/steps'],
    ['7 steps', (d: any) => (d.steps = Array.from({ length: 7 }, (_, i) => ({ ...d.steps[0], id: `s${i}` }))), '/steps'],
    ['0 formulas', (d: any) => (d.formulas = []), '/formulas'],
    ['11 formulas', (d: any) => (d.formulas = Array.from({ length: 11 }, (_, i) => ({ ...d.formulas[2], id: `f${i}` }))), '/formulas'],
    ['chapterOrder 0', (d: any) => (d.chapterOrder = 0), '/chapterOrder'],
    ['chapterOrder 21', (d: any) => (d.chapterOrder = 21), '/chapterOrder'],
    ['estimatedMinutes 4', (d: any) => (d.estimatedMinutes = 4), '/estimatedMinutes'],
    ['estimatedMinutes 21', (d: any) => (d.estimatedMinutes = 21), '/estimatedMinutes'],
    ['estimatedMinutes 12.5', (d: any) => (d.estimatedMinutes = 12.5), '/estimatedMinutes'],
    ['level not allowed', (d: any) => (d.level = 'expert'), '/level'],
    ['9 tags', (d: any) => (d.tags.en = Array.from({ length: 9 }, (_, i) => `t${i}`)), '/tags/en'],
    ['0 tags', (d: any) => (d.tags.en = []), '/tags/en'],
    ['tag 31 chars', (d: any) => (d.tags.en = ['x'.repeat(31)]), '/tags/en/0'],
    ['6 prerequisites', (d: any) => (d.prerequisites = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff']), '/prerequisites'],
    ['4 next', (d: any) => (d.next = ['aaa', 'bbb', 'ccc', 'ddd']), '/next'],
    ['prerequisite not a slug', (d: any) => (d.prerequisites = ['Not A Slug']), '/prerequisites/0'],
    ['1 example line', (d: any) => (d.example.lines = d.example.lines.slice(0, 1)), '/example/lines'],
    ['9 example lines', (d: any) => (d.example.lines = Array.from({ length: 9 }, () => d.example.lines[0])), '/example/lines'],
    ['0 example inputs', (d: any) => (d.example.inputs = []), '/example/inputs'],
    ['5 example inputs', (d: any) => (d.example.inputs = Array.from({ length: 5 }, (_, i) => ({ ...d.example.inputs[0], id: `i${i}` }))), '/example/inputs'],
    ['1 tryThis', (d: any) => (d.tryThis = d.tryThis.slice(0, 1)), '/tryThis'],
    ['4 tryThis', (d: any) => (d.tryThis = Array(4).fill(d.tryThis[0])), '/tryThis'],
    ['watchOut 241', (d: any) => (d.watchOut.en = 'x'.repeat(241)), '/watchOut/en'],
    ['13 terms', (d: any) => (d.terms = Array.from({ length: 13 }, (_, i) => ({ ...d.terms[0], id: `t${i}` }))), '/terms'],
    ['21 derived', (d: any) => (d.derived = Array.from({ length: 21 }, (_, i) => ({ id: `d${i}`, expr: '1' }))), '/derived'],
    ['latex 201', (d: any) => (d.formulas[0].latex = 'x'.repeat(201)), '/formulas/0/latex'],
    ['expression 501', (d: any) => (d.derived[0].expr = '1+'.repeat(250) + '1'), '/derived/0/expr'],
    ['empty expression', (d: any) => (d.derived[0].expr = ''), '/derived/0/expr'],
    ['decimals 7', (d: any) => (d.formulas[0].bind.s.decimals = 7), '/formulas/0/bind/s/decimals'],
    ['decimals 1.5', (d: any) => (d.formulas[0].bind.s.decimals = 1.5), '/formulas/0/bind/s/decimals'],
    ['formulaRefs 4', (d: any) => (d.steps[1].formulaRefs = ['f1', 'f2', 'f3', 'f1']), '/steps/1/formulaRefs'],
    ['unit not allowed', (d: any) => (d.parameters[0].unit = 'furlong'), '/parameters/0/unit'],
    ['kind not allowed', (d: any) => (d.parameters[0].kind = 'slider'), '/parameters/0/kind'],
    ['checks 7', (d: any) => (d.formulas[0].checks = Array(7).fill(d.formulas[0].checks[0])), '/formulas/0/checks'],
    ['check expects a string', (d: any) => (d.formulas[0].checks[0].expect.s = 'zero'), '/formulas/0/checks/0/expect/s'],
    ['step param not a number', (d: any) => (d.steps[0].sceneState.params.angle = '30'), '/steps/0/sceneState/params/angle'],
    ['NaN is not a number in a document', (d: any) => (d.parameters[0].min = NaN), '/parameters/0/min'],
  ])('%s is refused at %s', (_name, edit, pointer) => {
    expect(errors(mutated(edit)).some((p) => p.pointer === pointer || p.pointer.startsWith(`${pointer}/`)), `${errors(mutated(edit)).map((p) => p.pointer).join(', ')}`).toBe(true);
  });
  it('boundary values are accepted: 80-char title, 8 parameters, 6 steps, 20 minutes, order 20', () => {
    const r = check(
      mutated((d) => {
        d.title.en = 'x'.repeat(80);
        d.estimatedMinutes = 20;
        d.chapterOrder = 20;
        d.parameters = Array.from({ length: 8 }, (_, i) => ({ ...d.parameters[0], id: i === 0 ? 'angle' : `p${i}` }));
        d.steps = Array.from({ length: 6 }, (_, i) => ({ ...d.steps[0], id: `s${i}` }));
      }),
    );
    expect(r.ok).toBe(true);
  });
  it('min must be below max (E_RANGE), for parameters and for example inputs', () => {
    const a = only(mutated((d) => (d.parameters[0].min = 400)), 'E_RANGE');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ pointer: '/parameters/0', message: "Parameter 'angle': min must be below max" });
    const b = only(mutated((d) => (d.example.inputs[0].max = 0)), 'E_RANGE');
    expect(b[0]!.message).toBe("Input 'a': min must be below max");
    expect(codes(mutated((d) => (d.parameters[0].step = 0)))).toContain('E_SCHEMA');
    expect(codes(mutated((d) => (d.parameters[0].step = -1)))).toContain('E_SCHEMA');
  });
  it('a document that is not an object at all', () => {
    for (const doc of [null, undefined, 5, 'x', [], true]) {
      const r = check(doc);
      expect(r.ok).toBe(false);
      expect(r.problems[0]).toMatchObject({ code: 'E_SCHEMA', pointer: '' });
    }
  });
  it('every required top-level field, removed, is reported by name', () => {
    for (const key of Object.keys(example()).filter((k) => !['prerequisites', 'next', 'terms', 'derived', 'tryThis', 'watchOut', 'quiz'].includes(k))) {
      const doc = example();
      delete doc[key];
      expect(errors(doc).some((p) => p.pointer === `/${key}`), key).toBe(true);
    }
  });
});

describe('problems are plain values, in the format of FR-9.3', () => {
  it('formatProblem gives file#pointer [CODE] message', () => {
    const p = only(mutated((d) => (d.extra = 1)), 'E_UNKNOWN_KEY')[0]!;
    expect(formatProblem('trig.json', p)).toMatch(/^trig\.json#\/extra \[E_UNKNOWN_KEY\] Unknown key 'extra'\. Allowed:/);
  });
  it('JSON Pointer escapes: a key with a slash or tilde is escaped', () => {
    const d = example();
    d['a/b~c'] = 1;
    expect(errors(d).some((p) => p.pointer === '/a~1b~0c')).toBe(true);
  });
  it('every problem has a code, a severity, a pointer and a message; errors have E_, warnings W_', () => {
    const bad = mutated((d) => {
      d.extra = 1;
      delete d.title.ur;
      d.chapterOrder = 'x';
      d.quiz = [1];
      delete d.watchOut.ur;
    });
    const r = check(bad);
    for (const p of r.problems) {
      expect(p.message.length).toBeGreaterThan(0);
      expect(p.pointer === '' || p.pointer.startsWith('/')).toBe(true);
      expect(p.code).toMatch(p.severity === 'error' ? /^E_[A-Z_]+$/ : /^W_[A-Z_]+$/);
    }
  });
  it('all problems of the stage are collected, not just the first', () => {
    const p = errors(mutated((d) => {
      d.extra = 1;
      d.chapterOrder = 'x';
      delete d.title.ur;
      d.steps[0].zzz = 1;
    }));
    expect(p.length).toBeGreaterThanOrEqual(4);
  });
  it('duplicate problems are not repeated', () => {
    const p = errors(mutated((d) => (d.extra = 1)));
    expect(new Set(p.map((x) => `${x.code}|${x.pointer}|${x.message}`)).size).toBe(p.length);
  });
  it('checking never throws and never changes its input', () => {
    const doc = example();
    const before = JSON.stringify(doc);
    check(doc);
    check(mutated((d) => (d.scene = null)));
    expect(JSON.stringify(doc)).toBe(before);
    for (const weird of [Object.create(null), new Date(), new Map(), () => 1, Symbol('x'), 10n]) expect(() => check(weird)).not.toThrow();
  });
});
