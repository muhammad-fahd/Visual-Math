import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import { createSceneRegistry, defaultSceneRegistry, fieldTableMarkdown, fieldTables, type FieldRow } from '../../src/lib/topic-schema';

// AD-27: the field table generated from the schema is diffed against topic-format.md. The schema wins;
// a difference is a bug in the document (or a schema change nobody documented), and this test names it.

const DOC_PATH = '_bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/topic-format.md';
const options = { locales: LOCALES, registry: defaultSceneRegistry };

type Table = Record<string, FieldRow[]>;

/** The rows of the first Markdown table after `heading` (a line that contains it). */
function tableAfter(doc: string, heading: string): string[][] {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.includes(heading));
  if (start < 0) throw new Error(`heading not found in the document: ${heading}`);
  const rows: string[][] = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('|')) {
      inTable = true;
      rows.push(line.split('|').slice(1, -1).map((c) => c.trim()));
    } else if (inTable) break;
    else if (line.startsWith('### ') || line.startsWith('## ')) break;
  }
  return rows.slice(2); // the header and the separator
}

/** A table's first cell may name several fields (`min`, `max`): one row each. */
const names = (cell: string) => cell.split(',').map((c) => c.replaceAll('`', '').trim());
const fieldsOf = (rows: string[][], required: (row: string[], field: string) => boolean): FieldRow[] =>
  rows.flatMap((r) => names(r[0]!).map((field) => ({ name: field, required: required(r, field) })));

/** `{id, title: LocaleText(max 60), formulaRefs?: id[] (max 3)}` as rows: split at top-level commas. */
function braceRows(text: string): FieldRow[] {
  const open = text.indexOf('{');
  let depth = 0;
  let end = -1;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const inner = text.slice(open + 1, end);
  const parts: string[] = [];
  let cur = '';
  depth = 0;
  for (const ch of inner) {
    if ('({['.includes(ch)) depth++;
    if (')}]'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((part) => {
    const field = part.split(':')[0]!.trim();
    return { name: field.replace(/\?$/, ''), required: !field.endsWith('?') };
  });
}

/** The lines of section 1.2 that define a sub-object inline. */
function inline(doc: string, label: string): FieldRow[] {
  const line = doc.split('\n').find((l) => new RegExp(`^(- )?\`${label}\``).test(l) && l.includes('`{'));
  if (!line) throw new Error(`inline definition not found: ${label}`);
  return braceRows(line.slice(line.indexOf('`{') + 1));
}

function fromDocument(doc: string): Table {
  const topic = fieldsOf(tableAfter(doc, '### 1.1 Top level'), (r) => r[2] === 'yes');
  // The Parameter table has no Req column: every field is required except `options` ("`choice` only").
  const parameter = fieldsOf(tableAfter(doc, '`Parameter` (the only values a visitor can change'), (_r, field) => field !== 'options');
  const common = fieldsOf(tableAfter(doc, '### 2.1 Common to every scene type'), (r) => r[2] === 'yes');
  const unitCircle = fieldsOf(tableAfter(doc, '### 2.4 `unit-circle`'), (r) => r[2] === 'yes');
  const solid3d = fieldsOf(tableAfter(doc, '### 2.8 `solid3d`'), (r) => r[2] === 'yes');
  // `trace` is added by Story 3.1 and not yet in the document (it is a deferred reconciliation).
  const canvas2d = [...fieldsOf(tableAfter(doc, '### 2.3 `canvas2d`'), (r) => r[2] === 'yes'), { name: 'trace', required: false }];
  // Section 2.6 describes the one field, `model`, and then a table per `kind`; the kinds are tested in number-model.test.ts.
  const numberModel = [{ name: 'model', required: true }];
  const algebraTool = [{ name: 'tool', required: true }];
  const rightTriangle = fieldsOf(tableAfter(doc, '### 2.5 `right-triangle`'), (r) => r[2] === 'yes');
  return {
    Topic: topic,
    Parameter: parameter,
    SceneCommon: common,
    'scene:unit-circle@1': unitCircle,
    'scene:solid3d@1': solid3d,
    'scene:canvas2d@1': canvas2d,
    'scene:number-model@1': numberModel,
    'scene:algebra-tool@1': algebraTool,
    'scene:right-triangle@1': rightTriangle,
    Term: inline(doc, 'Term'),
    Derived: inline(doc, 'Derived'),
    Step: inline(doc, 'Step'),
    Formula: inline(doc, 'Formula'),
    Example: inline(doc, 'Example'),
    Input: inline(doc, 'Input'),
    Line: inline(doc, 'Line'),
  };
}

/** Every disagreement, in words. Empty means the document and the schema describe the same fields. */
function diff(generated: Table, documented: Table): string[] {
  const out: string[] = [];
  for (const [group, doc] of Object.entries(documented)) {
    const gen = generated[group];
    if (!gen) {
      out.push(`${group}: the document describes it but the schema has no such object`);
      continue;
    }
    const genMap = new Map(gen.map((r) => [r.name, r.required]));
    const docMap = new Map(doc.map((r) => [r.name, r.required]));
    for (const [field, req] of docMap) {
      if (!genMap.has(field)) out.push(`${group}.${field}: in the document, not in the schema`);
      else if (genMap.get(field) !== req) out.push(`${group}.${field}: the document says ${req ? 'required' : 'optional'}, the schema says ${genMap.get(field) ? 'required' : 'optional'}`);
    }
    for (const field of genMap.keys()) if (!docMap.has(field)) out.push(`${group}.${field}: in the schema, not in the document`);
  }
  return out;
}

const doc = readFileSync(DOC_PATH, 'utf8');

describe('the generated field table matches topic-format.md (AD-27)', () => {
  it('has no differences', () => {
    expect(diff(fieldTables(options), fromDocument(doc))).toEqual([]);
  });
  it('covers every object kind the document defines inline or in a table', () => {
    expect(Object.keys(fromDocument(doc)).sort()).toEqual(['Derived', 'Example', 'Formula', 'Input', 'Line', 'Parameter', 'SceneCommon', 'Step', 'Term', 'Topic', 'scene:algebra-tool@1', 'scene:canvas2d@1', 'scene:number-model@1', 'scene:right-triangle@1', 'scene:solid3d@1', 'scene:unit-circle@1']);
  });
  it('every registered scene type has a table in the document', () => {
    for (const d of defaultSceneRegistry.definitions) {
      expect(fromDocument(doc)[`scene:${d.type}@${d.v}`], `${d.type}@${d.v} is registered but its table is not diffed`).toBeDefined();
    }
  });
  it('the generated top-level table has the 22 documented fields', () => {
    expect(fieldTables(options)['Topic']!.map((r) => r.name)).toEqual([
      'schemaVersion', 'id', 'path', 'chapterOrder', 'level', 'estimatedMinutes', 'title', 'summary', 'goal', 'tags', 'prerequisites', 'next', 'terms',
      'parameters', 'derived', 'scene', 'steps', 'formulas', 'example', 'tryThis', 'watchOut', 'quiz',
    ]);
  });
  it('a markdown rendering exists, for a reader or a snapshot', () => {
    const md = fieldTableMarkdown(options);
    expect(md).toContain('### Topic');
    expect(md).toContain('| `schemaVersion` | yes |');
    expect(md).toContain('| `quiz` | no |');
    expect(md).toContain('### scene:unit-circle@1');
  });
});

describe('the diff really catches differences (so a green test means something)', () => {
  const generated = fieldTables(options);
  it('a field removed from the document', () => {
    const edited = doc.replace(/^\| `watchOut` .*\n/m, '');
    expect(diff(generated, fromDocument(edited))).toEqual(['Topic.watchOut: in the schema, not in the document']);
  });
  it('a field the schema does not have', () => {
    const edited = doc.replace('| `quiz` |', '| `colour` | string | no | x |\n| `quiz` |');
    expect(diff(generated, fromDocument(edited))).toEqual(['Topic.colour: in the document, not in the schema']);
  });
  it('a field the document marks required but the schema makes optional, and the reverse', () => {
    expect(diff(generated, fromDocument(doc.replace(/^\| `watchOut` \| LocaleText \| no \|/m, '| `watchOut` | LocaleText | yes |')))).toEqual([
      'Topic.watchOut: the document says required, the schema says optional',
    ]);
    expect(diff(generated, fromDocument(doc.replace(/^\| `title` \| LocaleText \| yes \|/m, '| `title` | LocaleText | no |')))).toEqual([
      'Topic.title: the document says optional, the schema says required',
    ]);
  });
  it('an inline definition that drifts', () => {
    expect(diff(generated, fromDocument(doc.replace('formulaRefs?: id[] (max 3), ', '')))).toEqual(['Step.formulaRefs: in the schema, not in the document']);
    expect(diff(generated, fromDocument(doc.replace('math?: string(max 200), calc?:', 'math: string(max 200), calc?:')))).toEqual([
      'Line.math: the document says required, the schema says optional',
    ]);
  });
  it('a scene table that drifts', () => {
    const edited = doc.replace(/^\| `quadrants` \| `boolean` \| no \|/m, '| `quadrants` | `boolean` | yes |');
    expect(diff(generated, fromDocument(edited))).toEqual(['scene:unit-circle@1.quadrants: the document says required, the schema says optional']);
  });
  it('a registered scene type the document does not describe is found by the coverage test', () => {
    const extra = createSceneRegistry([...defaultSceneRegistry.definitions, { type: 'zzz', v: 1, partIds: [], schema: (kit) => defaultSceneRegistry.definitions[0]!.schema(kit) }]);
    expect(fromDocument(doc)['scene:zzz@1']).toBeUndefined();
    expect(Object.keys(fieldTables({ locales: LOCALES, registry: extra }))).toContain('scene:zzz@1');
  });
});
