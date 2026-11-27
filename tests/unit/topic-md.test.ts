/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a JSON document by path; a typed model of it would hide what they check */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import { createTopicValidator, defaultSceneRegistry, parseMd, type Problem } from '../../src/lib/topic-schema';

// A Windows checkout may turn line endings into CRLF (git autocrlf); the tests that cut the text by hand need LF.
const read = (p: string) => readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const md = () => read('content/fixtures/trig-unit-circle.md');
const jsonTwin = () => JSON.parse(read('content/fixtures/trig-unit-circle.json')) as Record<string, any>;
const parse = (src: string) => parseMd(src, { locales: LOCALES });
const problems = (src: string): Problem[] => {
  const r = parse(src);
  if (r.ok) throw new Error('expected problems, the file parsed');
  return r.problems;
};
const codes = (src: string) => problems(src).map((p) => p.code);

/** A tiny valid MD file around `front` and `body`. */
const file = (front: string, body = '') => `---\n${front}\n---\n${body}`;

describe('the MD twin of the worked example (topic-format section 4)', () => {
  it('parseMd gives an object deeply equal to the JSON file', () => {
    const r = parse(md());
    if (!r.ok) throw new Error(r.problems.map((p) => p.message).join('\n'));
    expect(r.value).toStrictEqual(jsonTwin());
  });
  it('and the result validates exactly like the JSON does', () => {
    const v = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
    const r = parse(md());
    if (!r.ok) throw new Error('parse');
    expect(v.validate(r.value)).toEqual(v.validate(jsonTwin()));
    expect(v.validate(r.value).ok).toBe(true);
  });
  it('is readable: the text is outside the front matter, Urdu stays as written, math markup is untouched', () => {
    const text = md();
    expect(text).toMatch(/^---\nschemaVersion: 1\n/);
    expect(text).toContain('\n## en\n');
    expect(text).toContain('\n## ur\n');
    expect(text).toContain('### steps.s2.body\nThe height of the point is the **sine**. At 30 degrees it is 0.5.');
    expect(text).toContain('اکائی دائرہ اور سائن کی موج');
    expect(text).toContain('{{a}} degrees');
    // No text field is left in the front matter.
    const front = text.slice(0, text.indexOf('\n---\n', 4));
    expect(front).not.toContain('The Unit Circle');
  });
  it('the order of the sections and headings does not matter', () => {
    const text = md();
    const [head, rest] = [text.slice(0, text.indexOf('\n## en\n')), text.slice(text.indexOf('\n## en\n'))];
    const [en, ur] = rest.split('\n## ur\n') as [string, string];
    const swapped = `${head}\n## ur\n${ur}\n## en${en.slice('\n## en'.length)}`;
    const r = parse(swapped);
    if (!r.ok) throw new Error(r.problems.map((p) => p.message).join('\n'));
    expect(r.value).toEqual(jsonTwin());
    // Reverse the headings inside a section too.
    const reversedHeadings = (section: string) => {
      const parts = section.split('\n### ');
      return [parts[0], ...parts.slice(1).reverse()].join('\n### ');
    };
    const r2 = parse(`${head}\n## en${reversedHeadings(en.slice('\n## en'.length))}\n## ur\n${ur}`);
    if (!r2.ok) throw new Error(r2.problems.map((p) => p.message).join('\n'));
    expect(r2.value).toEqual(jsonTwin());
  });
  it('Windows line endings and a byte-order mark read the same', () => {
    const r = parse('﻿' + md().replaceAll('\n', '\r\n'));
    if (!r.ok) throw new Error(r.problems.map((p) => p.message).join('\n'));
    expect(r.value).toEqual(jsonTwin());
  });
});

describe('where each heading path lands', () => {
  const body = (front: string, sections: string) => parse(file(front, sections));
  const value = (front: string, sections: string): Record<string, any> => {
    const r = body(front, sections);
    if (!r.ok) throw new Error(r.problems.map((p) => p.message).join('\n'));
    return r.value;
  };
  const FRONT = [
    'parameters:',
    '  - { id: angle, kind: number, min: 0, max: 1, step: 1, default: 0, unit: none }',
    '  - { id: mode, kind: choice, min: 0, max: 2, step: 1, default: 0, unit: none, options: [{ value: 0 }, { value: 1 }] }',
    'scene: { type: unit-circle, v: 1, readouts: [{ id: rs }] }',
    'steps: [{ id: s1 }]',
    'formulas: [{ id: f1 }]',
    'terms: [{ id: ring }]',
    'example: { inputs: [{ id: n }], lines: [{ math: a }, { math: b }], answer: {} }',
    'tryThis: []',
  ].join('\n');
  it('every documented path', () => {
    const v = value(
      FRONT,
      [
        '## en',
        '### title', 'T', '### summary', 'S', '### goal', 'G', '### watchOut', 'W',
        '### parameters.angle.label', 'Angle',
        '### parameters.mode.label', 'Mode',
        '### parameters.mode.options.1.label', 'Zero',
        '### parameters.mode.options.2.label', 'One',
        '### steps.s1.title', 'ST', '### steps.s1.body', 'SB',
        '### formulas.f1.caption', 'FC',
        '### scene.caption', 'C', '### scene.description', 'D', '### scene.readouts.rs.label', 'RS',
        '### example.title', 'ET', '### example.problem', 'EP', '### example.answer.text', 'EA',
        '### example.inputs.n.label', 'EN',
        '### example.lines.1.text', 'L1', '### example.lines.2.text', 'L2',
        '### terms.ring.term', 'ring', '### terms.ring.definition', 'a ring',
      ].join('\n'),
    );
    expect(v.title).toEqual({ en: 'T' });
    expect(v.watchOut).toEqual({ en: 'W' });
    expect(v.parameters[0].label).toEqual({ en: 'Angle' });
    expect(v.parameters[1].options.map((o: any) => o.label.en)).toEqual(['Zero', 'One']);
    expect(v.steps[0]).toEqual({ id: 's1', title: { en: 'ST' }, body: { en: 'SB' } });
    expect(v.formulas[0].caption).toEqual({ en: 'FC' });
    expect(v.scene.caption).toEqual({ en: 'C' });
    expect(v.scene.readouts[0].label).toEqual({ en: 'RS' });
    expect(v.example.answer.text).toEqual({ en: 'EA' });
    expect(v.example.inputs[0].label).toEqual({ en: 'EN' });
    expect(v.example.lines.map((l: any) => l.text.en)).toEqual(['L1', 'L2']);
    expect(v.terms[0]).toEqual({ id: 'ring', term: { en: 'ring' }, definition: { en: 'a ring' } });
  });
  it('tryThis is one heading per prompt, 1-based', () => {
    const v = value('id: x', '## en\n### tryThis.1\nFirst\n### tryThis.2\nSecond\n## ur\n### tryThis.2\nدوسرا');
    expect(v.tryThis).toEqual([{ en: 'First' }, { en: 'Second', ur: 'دوسرا' }]);
  });
  it('tryThis prompts with a gap are refused; one also given in the front matter is a duplicate', () => {
    expect(problems(file('id: x', '## en\n### tryThis.1\nA\n### tryThis.3\nC\n'))[0]!.message).toContain("'tryThis.2' is missing");
    expect(codes(file('tryThis: [{ en: a }]', '## en\n### tryThis.1\nx\n'))).toEqual(['E_MD_DUPLICATE']);
    expect(codes(file('tryThis: 5', '## en\n### tryThis.1\nx\n'))).toEqual(['E_MD_PATH']);
    expect(codes(file('id: x', '## en\n### tryThis.51\nx\n'))).toEqual(['E_MD_PATH']);
  });
  it('tags are a comma-separated list, ASCII or Arabic comma, trimmed, empty items dropped', () => {
    const v = value('id: x', '## en\n### tags\nsine,  cosine ,unit circle,\n## ur\n### tags\nسائن، کوسائن ,  زاویہ ،');
    expect(v.tags).toEqual({ en: ['sine', 'cosine', 'unit circle'], ur: ['سائن', 'کوسائن', 'زاویہ'] });
  });
  it('multi-line text keeps its inner line breaks and blank lines; outer blank lines are trimmed', () => {
    const v = value('id: x', '## en\n### title\n\n  First line\nsecond line\n\nthird paragraph  \n\n\n### summary\nS\n');
    expect(v.title.en).toBe('First line\nsecond line\n\nthird paragraph');
  });
  it('a #### line or a # line inside text is text, not a heading', () => {
    const v = value('id: x', '## en\n### title\nA\n#### not a heading\n# neither\n##not heading either\n');
    expect(v.title.en).toBe('A\n#### not a heading\n# neither\n##not heading either');
  });
  it('markup and Unicode in text arrive unchanged (rules for them are later stages)', () => {
    const v = value('id: x', '## en\n### title\n$\\sin\\theta$ and **bold** and {{term:x}} − <b>\n');
    expect(v.title.en).toBe('$\\sin\\theta$ and **bold** and {{term:x}} − <b>');
  });
  it('a language section with no headings is fine; a missing language is the schema\'s job (E_LOCALE_MISSING)', () => {
    expect(parse(file('id: x', '## en\n## ur\n')).ok).toBe(true);
    expect(parse(file('id: x')).ok).toBe(true);
  });
});

describe('errors of the MD file itself', () => {
  it('no front matter: E_MD_PARSE at line 1', () => {
    for (const src of ['', 'hello', '## en\n### title\nx', ' ---\nid: x\n---\n']) {
      const p = problems(src);
      expect(p[0]).toMatchObject({ code: 'E_MD_PARSE', line: 1 });
      expect(p[0]!.message).toMatch(/^Not valid MD: .* at line 1\.$/);
    }
  });
  it('front matter that is never closed', () => {
    expect(problems('---\nid: x\n## en\n')[0]).toMatchObject({ code: 'E_MD_PARSE', line: 1 });
    expect(problems('---\nid: x\n')[0]!.message).toContain("not closed with '---'");
  });
  it('YAML errors carry the line of the file', () => {
    const p = problems('---\nid: x\nbad: [1, 2\nother: y\n---\n');
    expect(p[0]!.code).toBe('E_MD_PARSE');
    expect(p[0]!.line).toBeGreaterThanOrEqual(3);
    expect(p[0]!.message).toMatch(/at line \d+\.$/);
    expect(codes('---\na: 1\na: 2\n---\n')).toContain('E_MD_PARSE'); // a duplicate key
    expect(codes('---\n\t: x\n---\n')).toContain('E_MD_PARSE');
  });
  it('front matter that is not a mapping', () => {
    for (const front of ['- a\n- b', 'just text', '42', '', 'null']) expect(problems(`---\n${front}\n---\n`)[0]!.code, front).toBe('E_MD_PARSE');
  });
  it('YAML features the format forbids: aliases, anchors, tags, merge keys', () => {
    expect(problems('---\na: &x 1\nb: *x\n---\n').map((p) => p.message).join(' ')).toMatch(/aliases are not allowed/);
    expect(problems('---\na: &x 1\n---\n').map((p) => p.message).join(' ')).toMatch(/anchors are not allowed/);
    expect(problems('---\na: !!str 1\n---\n').map((p) => p.message).join(' ')).toMatch(/tags are not allowed/);
    expect(problems('---\na: !custom 1\n---\n')[0]!.code).toBe('E_MD_PARSE');
    expect(problems('---\nbase: &b { x: 1 }\nuse:\n  <<: *b\n---\n').map((p) => p.message).join(' ')).toMatch(/merge keys|aliases|anchors/);
    expect(codes('---\nuse:\n  <<: { x: 1 }\n---\n')).toContain('E_MD_PARSE');
  });
  it('YAML 1.2 core schema: yes, no, on and off are strings; dates are strings; 0x10 is a number', () => {
    const r = parse(file('a: yes\nb: no\nc: on\nd: off\ne: 2026-11-26\nf: 0x10\ng: 1e3\nh: ~\ni: "007"'));
    if (!r.ok) throw new Error('parse');
    expect(r.value).toEqual({ a: 'yes', b: 'no', c: 'on', d: 'off', e: '2026-11-26', f: 16, g: 1000, h: null, i: '007' });
  });
  it('a key named __proto__ in the front matter does not pollute and stays an unknown key for the schema', () => {
    const r = parse(file('__proto__:\n  polluted: 1\nid: x'));
    if (!r.ok) throw new Error('parse');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(r.value)).toBe(Object.prototype);
    const v = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
    expect(v.validate(r.value).problems.map((p) => p.pointer)).toContain('/__proto__');
  });
  it('text before the first language section, and headings outside one', () => {
    expect(codes(file('id: x', 'stray text\n## en\n'))).toEqual(['E_MD_PARSE']);
    const p = problems(file('id: x', '### title\nT\n## en\n'));
    expect(p[0]).toMatchObject({ code: 'E_MD_PARSE', line: 4 });
    expect(p[0]!.message).toContain('before the first');
  });
  it('text under a language but without a heading', () => {
    expect(problems(file('id: x', '## en\nloose text\n### title\nT\n'))[0]!.message).toContain("without a '### <path>' heading");
  });
  it('a language that is not configured: E_LOCALE_EXTRA, with the line', () => {
    const p = problems(file('id: x', '## en\n### title\nT\n## fr\n### title\nLe\n'));
    expect(p).toEqual([{ code: 'E_LOCALE_EXTRA', severity: 'error', pointer: '', message: "Locale 'fr' is not configured.", line: 7 }]);
  });
  it('a language section twice, and a heading twice in one section', () => {
    expect(problems(file('id: x', '## en\n### title\nA\n## en\n### goal\nB\n'))[0]!.message).toContain("the section '## en' appears twice");
    const p = problems(file('id: x', '## en\n### title\nA\n### title\nB\n'));
    expect(p[0]).toMatchObject({ code: 'E_MD_PARSE', line: 7 });
    expect(p[0]!.message).toContain("appears twice under '## en'");
    // The same heading in two different languages is normal.
    expect(parse(file('id: x', '## en\n### title\nA\n## ur\n### title\nب\n')).ok).toBe(true);
  });
  it('E_MD_PATH: a heading that matches nothing, with the exact message and the line', () => {
    const p = problems(file('parameters: [{ id: angle }]', '## en\n### nope\nx\n### parameters.zzz.label\nx\n### parameters.angle.colour\nx\n### steps.s9.title\nx\n### title.en\nx\n### example.lines.9.text\nx\n### tryThis.0\nx\n'));
    expect(p.every((x) => x.code === 'E_MD_PATH')).toBe(true);
    expect(p).toHaveLength(7);
    expect(p[0]).toMatchObject({ message: "Heading 'nope' does not match any text field.", line: 5 });
  });
  it('E_MD_PATH: a path that would hit something that is not a text (an id, a number, an expression)', () => {
    const p = problems(file('parameters: [{ id: angle, min: 0 }]\nsteps: [{ id: s1 }]', '## en\n### parameters.angle.min\nx\n### steps.s1.id\nx\n### id\nx\n### schemaVersion\nx\n### scene.angle\nx\n### formulas.f1.latex\nx\n'));
    expect(p.every((x) => x.code === 'E_MD_PATH')).toBe(true);
    expect(p).toHaveLength(6);
  });
  it('E_MD_PATH: the element must exist in the front matter (ids and numbers)', () => {
    expect(codes(file('id: x', '## en\n### steps.s1.title\nx\n'))).toEqual(['E_MD_PATH']);
    expect(codes(file('steps: []', '## en\n### steps.s1.title\nx\n'))).toEqual(['E_MD_PATH']);
    expect(codes(file('steps: not-a-list', '## en\n### steps.s1.title\nx\n'))).toEqual(['E_MD_PATH']);
    expect(codes(file('scene: 5', '## en\n### scene.caption\nx\n'))).toEqual(['E_MD_PATH']);
    expect(codes(file('tryThis: [{}]', '## en\n### tryThis.01\nx\n'))).toEqual(['E_MD_PATH']);
  });
  it('E_MD_DUPLICATE: a leaf in the front matter and under a heading', () => {
    const p = problems(file('title: { en: Hello }', '## en\n### title\nHello\n'));
    expect(p).toEqual([{ code: 'E_MD_DUPLICATE', severity: 'error', pointer: '', message: "'title' is given in the front matter and in a section.", line: 5 }]);
    expect(codes(file('title: { en: Hello, ur: ہیلو }', '## ur\n### title\nx\n'))).toEqual(['E_MD_DUPLICATE']); // even for a language the front matter lacks
    expect(codes(file('steps: [{ id: s1, title: { en: a } }]', '## en\n### steps.s1.title\nx\n'))).toEqual(['E_MD_DUPLICATE']);
    expect(codes(file('example: { answer: { text: { en: a } } }', '## en\n### example.answer.text\nx\n'))).toEqual(['E_MD_DUPLICATE']);
  });
  it('a leaf given only in the front matter, as {en, ur}, is allowed', () => {
    const r = parse(file('title: { en: Hello, ur: ہیلو }'));
    if (!r.ok) throw new Error('parse');
    expect(r.value).toEqual({ title: { en: 'Hello', ur: 'ہیلو' } });
  });
  it('all problems of the file are listed, in one pass', () => {
    const p = problems(file('title: { en: x }', '## en\n### title\ny\n### nope\nz\n## fr\n## en\n'));
    expect(p.map((x) => x.code).sort()).toEqual(['E_LOCALE_EXTRA', 'E_MD_DUPLICATE', 'E_MD_PATH', 'E_MD_PARSE'].sort());
  });
  it('never throws, for any input', () => {
    for (const src of [undefined, null, 5, {}, [], () => 1, Symbol('x'), '\u0000', '---', '---\n---\n', '---\n\n---\n## en\n###\n']) {
      expect(() => parseMd(src as unknown as string, { locales: LOCALES })).not.toThrow();
    }
    expect(parseMd(undefined as unknown as string, { locales: LOCALES }).ok).toBe(false);
  });
  it('a heading with only spaces after ### is not a heading', () => {
    expect(parse(file('id: x', '## en\n###   \n')).ok).toBe(false); // loose text without a heading
  });
});

describe('the front matter object is plain data', () => {
  it('has no prototype surprises: plain objects and arrays only', () => {
    const r = parse(md());
    if (!r.ok) throw new Error('parse');
    const seen = new Set<unknown>();
    const check = (n: unknown): void => {
      if (typeof n !== 'object' || n === null || seen.has(n)) return;
      seen.add(n);
      expect([Object.prototype, Array.prototype]).toContain(Object.getPrototypeOf(n));
      Object.values(n).forEach(check);
    };
    check(r.value);
    expect(seen.size).toBeGreaterThan(50);
  });
  it('parsing twice gives equal, independent objects', () => {
    const a = parse(md());
    const b = parse(md());
    if (!a.ok || !b.ok) throw new Error('parse');
    expect(a.value).toEqual(b.value);
    expect(a.value).not.toBe(b.value);
  });
});

describe('hostile size and shape', () => {
  it('a line of very many spaces is read in linear time (no backtracking)', () => {
    const started = performance.now();
    const spaces = ' '.repeat(300_000);
    parse(file('id: x', `## en\n### title${spaces}x\n###${spaces}\n##${spaces}y\n## en${spaces}\n`));
    expect(performance.now() - started).toBeLessThan(1500);
  });
  it('a long file of headings is read quickly', () => {
    const body = ['## en', ...Array.from({ length: 5000 }, (_, i) => `### steps.s${i}.title\nx`)].join('\n');
    const started = performance.now();
    const r = parse(file('id: x', body));
    expect(r.ok).toBe(false); // none of the paths exist, and every one is reported
    expect(performance.now() - started).toBeLessThan(3000);
    if (!r.ok) expect(r.problems).toHaveLength(5000);
  });
  it('an alias bomb is refused before anything is expanded', () => {
    const bomb = ['a: &a [x, x, x, x, x, x, x, x, x]', 'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]', 'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]', 'd: [*c, *c, *c, *c, *c, *c, *c, *c, *c]'].join('\n');
    const started = performance.now();
    expect(problems(file(bomb))[0]!.code).toBe('E_MD_PARSE');
    expect(performance.now() - started).toBeLessThan(500);
  });
});
