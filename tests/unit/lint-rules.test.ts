import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root, overrideConfigFile: 'eslint.config.mjs' });

async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  // An ignored file yields a "File ignored" warning and would make clean-file tests pass vacuously.
  expect(result.messages.some((m) => /ignored/i.test(m.message))).toBe(false);
  return result.messages;
}
const boundary = (m: { ruleId: string | null }[]) => m.some((x) => x.ruleId?.startsWith('boundaries/'));
const imp = (from: string) => `import { LAYER } from '${from}';\nexport const a = LAYER;\n`;

describe('layer rules: forbidden edges (AD-1)', () => {
  it('lib imports features', async () => expect(boundary(await lint(imp('../features'), 'src/lib/bad.ts'))).toBe(true));
  it('lib imports features through the @/ alias', async () => expect(boundary(await lint(imp('@/features'), 'src/lib/bad.ts'))).toBe(true));
  it('lib imports features from a nested folder', async () => expect(boundary(await lint(imp('../../features'), 'src/lib/math/bad.ts'))).toBe(true));
  it('features import server', async () => expect(boundary(await lint(imp('../server'), 'src/features/bad.ts'))).toBe(true));
  it('features import db', async () => expect(boundary(await lint(imp('../db'), 'src/features/bad.ts'))).toBe(true));
  it('scenes import features', async () => expect(boundary(await lint(imp('../features'), 'src/scenes/bad.ts'))).toBe(true));
  it('db imports server', async () => expect(boundary(await lint(imp('../server'), 'src/db/bad.ts'))).toBe(true));
});

describe('layer rules: allowed edges produce no violation', () => {
  const allowed: [string, string][] = [
    ['src/scenes/ok.ts', '../lib'],
    ['src/features/ok.ts', '../scenes'],
    ['src/features/ok.ts', '../lib'],
    ['src/server/ok.ts', '../db'],
    ['src/server/ok.ts', '../lib'],
    ['src/db/ok.ts', '../lib'],
    ['src/app/ok.ts', '../server'],
    ['src/app/ok.ts', '../features'],
    ['src/features/ok.ts', '@/scenes'],
    ['src/app/ok.ts', '@/server'],
  ];
  for (const [file, from] of allowed) {
    it(`${file} may import ${from}`, async () => expect(await lint(imp(from), file)).toEqual([]));
  }
});

describe('banned code (I/O matrix of Story 1.1)', () => {
  it('passes a clean lib file', async () => expect(await lint('export const a = 1;\n', 'src/lib/clean.ts')).toEqual([]));
  const rule = async (code: string, file: string, id: string) => (await lint(code, file)).some((x) => x.ruleId === id);
  it('eval', async () => expect(await rule("export const a = eval('1');\n", 'src/lib/bad.ts', 'no-eval')).toBe(true));
  it('new Function', async () => expect(await rule("export const a = new Function('return 1');\n", 'src/lib/bad.ts', 'no-new-func')).toBe(true));
  it('implied eval (setTimeout with a string)', async () => expect(await rule("setTimeout('x', 1);\nexport {};\n", 'src/lib/bad.ts', 'no-implied-eval')).toBe(true));

  const msg = async (code: string, re: RegExp) => (await lint(code, 'src/features/bad.tsx')).some((x) => re.test(x.message));
  it('hex color, whole string', async () => expect(await msg("export const c = '#2B4A8B';\n", /hex/)).toBe(true));
  it('hex color, short form', async () => expect(await msg("export const c = '#fff';\n", /hex/)).toBe(true));
  it('hex color inside a longer string', async () => expect(await msg("export const c = '1px solid #2B4A8B';\n", /hex/)).toBe(true));
  it('hex color in a template literal', async () => expect(await msg('export const c = `solid #2B4A8B ${1}`;\n', /hex/)).toBe(true));
  it('a short whole-string like #bed is flagged (accepted false positive; use a token or a longer string)', async () => expect(await msg("export const u = '#bed';\n", /hex/)).toBe(true));
  it('physical class names', async () => {
    for (const c of ['ml-2', 'pr-4', 'left-0', 'right-1', 'text-left', 'border-l', 'rounded-tr-lg', 'a ml-2 b']) {
      expect(await msg(`export const c = '${c}';\n`, /logical CSS/), c).toBe(true);
    }
  });
  it('physical class in a template literal', async () => expect(await msg('export const c = `ps-2 ml-${1}`;\n', /logical CSS/)).toBe(true));
  it('physical style properties', async () => {
    for (const k of ['marginLeft', 'paddingRight', 'borderLeft']) {
      expect(await msg(`export const s = { ${k}: 4 };\n`, /logical CSS/), k).toBe(true);
    }
  });
  it('a data object with left and right keys is allowed', async () => {
    expect(await lint('export const n = { left: 1, right: 2 };\n', 'src/lib/tree.ts')).toEqual([]);
  });
  it('logical classes are allowed', async () => expect(await lint("export const c = 'ms-2 text-start pe-4';\n", 'src/features/ok.tsx')).toEqual([]));
  it('dynamic import of a non-literal path', async () => expect(await msg('export const f = (p: string) => import(p);\n', /non-literal/)).toBe(true));
  it('generated token files may contain hex colors', async () => {
    expect(await lint("export const primary = '#2B4A8B';\n", 'src/styles/generated/tokens.ts')).toEqual([]);
  });
});

describe('CSS files follow the same rules (lint does not read CSS)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') ? [p] : [];
    });
  const files = walk(join(root, 'src')).filter((f) => !f.replace(/\\/g, '/').includes('/styles/generated/'));
  it('finds the CSS files it is meant to check', () => expect(files.length).toBeGreaterThan(0));
  it('has no hex colors or physical properties outside generated tokens', () => {
    const bad = /#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(^|[^-\w])(margin|padding)-(left|right)\s*:|(^|[^-\w])(left|right)\s*:/m;
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(bad);
  });
});

describe('literal interface text is blocked in components (FR-6.5)', () => {
  const flagged = async (code: string) => (await lint(code, 'src/features/Bad.tsx')).some((x) => x.ruleId === 'local/no-literal-text');
  it('text in JSX', async () => expect(await flagged('export const A = () => <p>Hello</p>;\n')).toBe(true));
  it('Urdu text in JSX', async () => expect(await flagged('export const A = () => <p>اردو</p>;\n')).toBe(true));
  it('a string literal child', async () => expect(await flagged("export const A = () => <p>{'Hello'}</p>;\n")).toBe(true));
  it('text attributes', async () => {
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
      expect(await flagged(`export const A = () => <input ${a}="Close" />;\n`), a).toBe(true);
    }
  });
  it('literals hidden in ternaries, && and + and templates', async () => {
    expect(await flagged("export const A = ({ x }: { x: boolean }) => <p>{x ? 'Yes' : 'No'}</p>;\n")).toBe(true);
    expect(await flagged("export const A = ({ x }: { x: boolean }) => <p>{x && 'Shown'}</p>;\n")).toBe(true);
    expect(await flagged("export const A = ({ n }: { n: string }) => <p>{'Hello ' + n}</p>;\n")).toBe(true);
    expect(await flagged('export const A = ({ n }: { n: string }) => <p>{`Hello ${n}`}</p>;\n')).toBe(true);
    expect(await flagged("export const A = ({ x }: { x: boolean }) => <button aria-label={x ? 'Open' : 'Close'} />;\n")).toBe(true);
    expect(await flagged('export const A = () => <input aria-valuetext="Fifty" />;\n')).toBe(true);
  });
  it('translated text, symbols and digits are allowed', async () => {
    expect(await flagged('export const A = ({ t }: { t: (k: string) => string }) => <p>{t("x")}</p>;\n')).toBe(false);
    expect(await flagged("export const A = () => <span>{'\u2713 '}</span>;\n")).toBe(false);
    expect(await flagged('export const A = () => <span>42 / 7</span>;\n')).toBe(false);
    expect(await flagged("export const A = ({ x }: { x: boolean }) => <span>{x ? '\\u2713' : '1'}</span>;\n")).toBe(false);
    expect(await flagged('export const A = () => <a className="underline" href="/en" lang="en" />;\n')).toBe(false);
  });
});
