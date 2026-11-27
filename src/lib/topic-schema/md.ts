import { parseDocument, visit, isScalar, type Document } from 'yaml';
import { err, type Outcome, type Problem } from './types';

// parseMd: the MD form of a topic is the same object as the JSON form, split so a person can read it
// (topic-format section 4). Front matter (YAML) holds everything that is not text; one `## <lang>`
// section per language holds the text, one `### <path>` heading per text field. The result goes into
// the same validation as JSON, and errors name the JSON path.

export interface MdOptions {
  /** The configured languages; passed in because lib imports no other layer. */
  locales: readonly string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Text fields that may be a heading, as path patterns: `:id` finds an array element by its id, `:n` by 1-based position. */
const LEAF_TOP = new Set(['title', 'summary', 'goal', 'watchOut']);

/** Finds where the per-language text object of a heading path lives: `owner[key]`. Null when the path matches nothing. */
function locate(root: Obj, segs: readonly string[]): { owner: Obj | unknown[]; key: string | number; isTags: boolean; index?: number } | null {
  const byId = (list: unknown, id: string): Obj | null => (Array.isArray(list) ? ((list.find((e) => isObj(e) && e['id'] === id) as Obj | undefined) ?? null) : null);
  const byN = (list: unknown, n: string): { list: unknown[]; index: number } | null => {
    if (!Array.isArray(list) || !/^[1-9][0-9]*$/.test(n)) return null;
    const index = Number(n) - 1;
    return index < list.length ? { list, index } : null;
  };
  const at = (owner: Obj | unknown[], key: string | number) => ({ owner, key, isTags: false });

  const [a, b, c, d, e] = segs;
  if (segs.length === 1 && a !== undefined) {
    if (LEAF_TOP.has(a)) return at(root, a);
    if (a === 'tags') return { owner: root, key: 'tags', isTags: true };
    return null;
  }
  if (a === 'parameters' && b !== undefined) {
    const p = byId(root['parameters'], b);
    if (!p) return null;
    if (segs.length === 3 && c === 'label') return at(p, 'label');
    if (segs.length === 5 && c === 'options' && d !== undefined && e === 'label') {
      const o = byN(p['options'], d);
      return o && isObj(o.list[o.index]) ? at(o.list[o.index] as Obj, 'label') : null;
    }
    return null;
  }
  if (a === 'steps' && b !== undefined && segs.length === 3 && (c === 'title' || c === 'body')) {
    const s = byId(root['steps'], b);
    return s ? at(s, c) : null;
  }
  if (a === 'formulas' && b !== undefined && segs.length === 3 && c === 'caption') {
    const f = byId(root['formulas'], b);
    return f ? at(f, 'caption') : null;
  }
  if (a === 'scene') {
    const scene = root['scene'];
    if (!isObj(scene)) return null;
    if (segs.length === 2 && (b === 'caption' || b === 'description')) return at(scene, b);
    if (segs.length === 4 && b === 'readouts' && c !== undefined && d === 'label') {
      const r = byId(scene['readouts'], c);
      return r ? at(r, 'label') : null;
    }
    return null;
  }
  if (a === 'example') {
    const ex = root['example'];
    if (!isObj(ex)) return null;
    if (segs.length === 2 && (b === 'title' || b === 'problem')) return at(ex, b);
    if (segs.length === 3 && b === 'answer' && c === 'text') return isObj(ex['answer']) ? at(ex['answer'] as Obj, 'text') : null;
    if (segs.length === 4 && b === 'inputs' && c !== undefined && d === 'label') {
      const i = byId(ex['inputs'], c);
      return i ? at(i, 'label') : null;
    }
    if (segs.length === 4 && b === 'lines' && c !== undefined && d === 'text') {
      const l = byN(ex['lines'], c);
      return l && isObj(l.list[l.index]) ? at(l.list[l.index] as Obj, 'text') : null;
    }
    return null;
  }
  if (a === 'tryThis' && segs.length === 2 && b !== undefined) {
    // The prompts are born from their headings (there is nothing in the front matter to attach to).
    if (!/^[1-9][0-9]*$/.test(b) || Number(b) > 50) return null;
    if (root['tryThis'] !== undefined && !Array.isArray(root['tryThis'])) return null;
    return { owner: root, key: 'tryThis', isTags: false, index: Number(b) - 1 };
  }
  if (a === 'terms' && b !== undefined && segs.length === 3 && (c === 'term' || c === 'definition')) {
    const t = byId(root['terms'], b);
    return t ? at(t, c) : null;
  }
  return null;
}

/** Splits the file into lines (1-based numbers kept by index) and finds the front matter. */
function frontMatter(lines: string[]): { text: string; endLine: number } | Problem {
  if (lines[0]?.trimEnd() !== '---') return err('E_MD_PARSE', '', "Not valid MD: the file must start with '---' (front matter) at line 1.", 1);
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trimEnd() === '---') return { text: lines.slice(1, i).join('\n'), endLine: i + 1 };
  }
  return err('E_MD_PARSE', '', "Not valid MD: the front matter is not closed with '---' at line 1.", 1);
}

/** Reads the YAML with the strict settings of topic-format 4: core schema, no aliases, anchors, tags or merge keys. */
function readYaml(text: string, firstLine: number): { value: Obj } | { problems: Problem[] } {
  const problems: Problem[] = [];
  let doc: Document.Parsed;
  try {
    doc = parseDocument(text, { version: '1.2', schema: 'core', merge: false, uniqueKeys: true, strict: true });
  } catch (error) {
    return { problems: [err('E_MD_PARSE', '', `Not valid MD: ${error instanceof Error ? error.message : 'the front matter cannot be read'} at line ${firstLine}.`, firstLine)] };
  }
  const lineOf = (offset: number | undefined) => {
    if (offset === undefined) return firstLine;
    return firstLine + text.slice(0, offset).split('\n').length - 1;
  };
  for (const e of [...doc.errors, ...doc.warnings]) {
    const line = e.linePos?.[0]?.line !== undefined ? firstLine + e.linePos[0].line - 1 : firstLine;
    problems.push(err('E_MD_PARSE', '', `Not valid MD: ${e.message.split('\n')[0]} at line ${line}.`, line));
  }
  if (problems.length > 0) return { problems };
  visit(doc, {
    Alias(_k, node) {
      problems.push(err('E_MD_PARSE', '', `Not valid MD: aliases are not allowed in the front matter at line ${lineOf(node.range?.[0])}.`, lineOf(node.range?.[0])));
    },
    Node(_k, node) {
      const at = lineOf((node as { range?: number[] }).range?.[0]);
      if ((node as { anchor?: string }).anchor) problems.push(err('E_MD_PARSE', '', `Not valid MD: anchors are not allowed in the front matter at line ${at}.`, at));
      if ((node as { tag?: string }).tag) problems.push(err('E_MD_PARSE', '', `Not valid MD: tags are not allowed in the front matter at line ${at}.`, at));
    },
    Pair(_k, pair) {
      if (isScalar(pair.key) && pair.key.value === '<<') {
        const at = lineOf(pair.key.range?.[0]);
        problems.push(err('E_MD_PARSE', '', `Not valid MD: merge keys are not allowed in the front matter at line ${at}.`, at));
      }
    },
  });
  if (problems.length > 0) return { problems };
  const value: unknown = doc.toJS({ maxAliasCount: 0 });
  if (!isObj(value)) return { problems: [err('E_MD_PARSE', '', `Not valid MD: the front matter must be a mapping of fields at line ${firstLine}.`, firstLine)] };
  return { value };
}

interface Leaf {
  locale: string;
  path: string;
  text: string;
  line: number;
}

export function parseMd(src: string, options: MdOptions): Outcome<Obj> {
  try {
    return parse(src, options);
  } catch {
    return { ok: false, problems: [err('E_MD_PARSE', '', 'Not valid MD: the file could not be read.')] };
  }
}

function parse(src: string, { locales }: MdOptions): Outcome<Obj> {
  if (typeof src !== 'string') return { ok: false, problems: [err('E_MD_PARSE', '', 'Not valid MD: the file is not text.')] };
  const lines = src.replace(/^﻿/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const fm = frontMatter(lines);
  if ('code' in fm) return { ok: false, problems: [fm] };
  const yaml = readYaml(fm.text, 2);
  if ('problems' in yaml) return { ok: false, problems: yaml.problems };
  const root = yaml.value;

  const problems: Problem[] = [];
  const leaves: Leaf[] = [];
  const sections = new Set<string>();
  const seenHeadings = new Set<string>();
  let locale: string | null = null;
  let current: { path: string; line: number; buffer: string[]; drop: boolean } | null = null;
  let skipSection = false;

  const flush = () => {
    if (current && locale !== null && !skipSection && !current.drop) {
      leaves.push({ locale, path: current.path, text: current.buffer.join('\n').trim(), line: current.line });
    }
    current = null;
  };

  for (let i = fm.endLine; i < lines.length; i++) {
    const line = lines[i]!;
    const n = i + 1;
    // Trim first, then match with no lazy quantifier: a line of a million spaces must not take quadratic time.
    const trimmed = line.trimEnd();
    const h2 = /^## +(\S.*)$/.exec(trimmed);
    const h3 = /^### +(\S.*)$/.exec(trimmed);
    if (h2 && !line.startsWith('###')) {
      flush();
      const name = h2[1]!;
      skipSection = false;
      if (!locales.includes(name)) {
        problems.push(err('E_LOCALE_EXTRA', '', `Locale '${name}' is not configured.`, n));
        locale = name;
        skipSection = true;
      } else if (sections.has(name)) {
        problems.push(err('E_MD_PARSE', '', `Not valid MD: the section '## ${name}' appears twice at line ${n}.`, n));
        locale = name;
        skipSection = true;
      } else {
        sections.add(name);
        locale = name;
        seenHeadings.clear();
      }
      continue;
    }
    if (h3) {
      flush();
      if (locale === null) {
        problems.push(err('E_MD_PARSE', '', `Not valid MD: the heading '### ${h3[1]}' is before the first '## <language>' section at line ${n}.`, n));
        continue;
      }
      const path = h3[1]!;
      if (!skipSection && seenHeadings.has(path)) {
        problems.push(err('E_MD_PARSE', '', `Not valid MD: the heading '### ${path}' appears twice under '## ${locale}' at line ${n}.`, n));
        current = { path, line: n, buffer: [], drop: true }; // its text is read and dropped
        continue;
      }
      seenHeadings.add(path);
      current = { path, line: n, buffer: [], drop: false };
      continue;
    }
    if (current) current.buffer.push(line);
    else if (line.trim() !== '' && locale === null) {
      problems.push(err('E_MD_PARSE', '', `Not valid MD: text before the first '## <language>' section at line ${n}.`, n));
    } else if (line.trim() !== '' && locale !== null && !skipSection) {
      problems.push(err('E_MD_PARSE', '', `Not valid MD: text without a '### <path>' heading above it at line ${n}.`, n));
    }
  }
  flush();

  // Apply leaves. A text object that already exists at the target came from the front matter.
  const made = new Set<unknown>();
  for (const leaf of leaves) {
    const segs = leaf.path.split('.');
    const where = locate(root, segs);
    if (!where) {
      problems.push(err('E_MD_PATH', '', `Heading '${leaf.path}' does not match any text field.`, leaf.line));
      continue;
    }
    const { owner, key, isTags, index } = where;
    const slot = owner as Record<string | number, unknown>;
    if (index !== undefined) {
      // tryThis.N: element N - 1 of the list, which is made when the first heading needs it.
      const list = (slot[key] as unknown[] | undefined) ?? [];
      const present = list[index];
      if (present !== undefined && !made.has(present)) {
        problems.push(err('E_MD_DUPLICATE', '', `'${leaf.path}' is given in the front matter and in a section.`, leaf.line));
        continue;
      }
      slot[key] = list;
      const target = (present as Obj | undefined) ?? {};
      if (present === undefined) {
        list[index] = target;
        made.add(target);
      }
      target[leaf.locale] = leaf.text;
      continue;
    }
    const existing = slot[key];
    if (existing !== undefined && !made.has(existing)) {
      problems.push(err('E_MD_DUPLICATE', '', `'${leaf.path}' is given in the front matter and in a section.`, leaf.line));
      continue;
    }
    let target = existing as Obj | undefined;
    if (!target) {
      target = {};
      slot[key] = target;
      made.add(target);
    }
    target[leaf.locale] = isTags ? leaf.text.split(/[,،]/).map((t) => t.trim()).filter((t) => t !== '') : leaf.text;
  }

  // The prompts are numbered from 1 without gaps.
  if (Array.isArray(root['tryThis'])) {
    const list = root['tryThis'] as unknown[];
    for (let i = 0; i < list.length; i++) {
      if (list[i] === undefined) problems.push(err('E_MD_PARSE', '', `Not valid MD: 'tryThis.${i + 1}' is missing; prompts are numbered from 1 without gaps.`));
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: root, problems: [] };
}
