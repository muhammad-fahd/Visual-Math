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

describe('route handlers must be guarded (AD-9, Story 1.6)', () => {
  const file = 'src/app/api/thing/route.ts';
  const flagged = async (code: string) => (await lint(code, file)).some((m) => m.ruleId === 'local/require-handler-guard');
  it('a handler with neither guard fails', async () => {
    expect(await flagged('export function POST(request: Request) { return new Response(request.url); }\n')).toBe(true);
    expect(await flagged('export async function GET() { return Response.json({}); }\n')).toBe(true);
    expect(await flagged('export const DELETE = async () => new Response(null);\n')).toBe(true);
  });
  it('each unguarded method is reported, even when another one is guarded', async () => {
    const code = "import { ratelimit } from '@/server/ratelimit';\nexport async function GET(r: Request) { const l = await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 }); return l ?? Response.json({}); }\nexport function POST() { return new Response(null); }\n";
    const found = (await lint(code, file)).filter((m) => m.ruleId === 'local/require-handler-guard');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/POST/);
  });
  it('requireAdmin() or ratelimit() anywhere in the handler, even inside a callback, passes', async () => {
    expect(await flagged("import { requireAdmin } from '@/server/admin';\nexport async function POST() { const a = await requireAdmin(); if (a instanceof Response) return a; return Response.json({}); }\n")).toBe(false);
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nconst run = (f: () => Promise<Response>) => f();\nexport function POST(r: Request) { return run(async () => { const l = await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 }); return l ?? Response.json({}); }); }\n")).toBe(false);
  });
  it('a guard that is only named, not called, does not count', async () => {
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nexport function POST() { const unused = ratelimit; return new Response(String(unused)); }\n")).toBe(true);
    expect(await flagged("export function POST() { /* requireAdmin() ratelimit() */ return new Response(null); }\n")).toBe(true);
  });
  it('export { POST } is checked through the local function', async () => {
    expect(await flagged('function POST() { return new Response(null); }\nexport { POST };\n')).toBe(true);
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nasync function POST(r: Request) { return (await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 })) ?? new Response(null); }\nexport { POST };\n")).toBe(false);
  });
  it('re-exports, destructured exports and wrappers cannot be checked and fail', async () => {
    expect(await flagged("export * from './handlers';\n")).toBe(true);
    expect(await flagged("export { POST } from './handlers';\n")).toBe(true);
    expect(await flagged("export { POST as GET } from './handlers';\n")).toBe(true);
    expect(await flagged("const handlers = { POST: async () => new Response(null) };\nexport const { POST } = handlers;\n")).toBe(true);
    expect(await flagged("const wrap = (f: () => Response) => f;\nexport const POST = wrap(() => new Response(null));\n")).toBe(true);
  });
  it('a guard whose answer is ignored does not count (a bare statement enforces nothing)', async () => {
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nexport async function POST(r: Request) { await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 }); return new Response(null); }\n")).toBe(true);
    expect(await flagged("import { requireAdmin } from '@/server/admin';\nexport async function POST() { requireAdmin(); return new Response(null); }\n")).toBe(true);
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nexport async function POST(r: Request) { const l = await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 }); if (l) return l; return new Response(null); }\n")).toBe(false);
  });
  it('an alias export and a const function are resolved', async () => {
    expect(await flagged("const handler = async () => new Response(null);\nexport { handler as POST };\n")).toBe(true);
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nconst handler = async (r: Request) => (await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 })) ?? new Response(null);\nexport { handler as POST };\n")).toBe(false);
    expect(await flagged("import { ratelimit } from '@/server/ratelimit';\nexport { POST };\nasync function POST(r: Request) { return (await ratelimit(r, { name: 'a', limit: 1, windowSeconds: 1 })) ?? new Response(null); }\n")).toBe(false);
  });
  it('route files with other extensions and folders are covered', async () => {
    const other = async (code: string, f: string) => (await lint(code, f)).some((m) => m.ruleId === 'local/require-handler-guard');
    expect(await other('export function GET() { return new Response(null); }\n', 'src/app/api/x/route.js')).toBe(true);
    expect(await other('export function GET() { return new Response(null); }\n', 'src/app/feed/route.ts')).toBe(true);
  });
  it('helpers and other exports in a route file are not handlers', async () => {
    expect(await flagged("export const dynamic = 'force-dynamic';\nexport function helper() { return 1; }\n")).toBe(false);
  });
  it('the rule applies only to route files', async () => {
    expect((await lint('export function POST() { return new Response(null); }\n', 'src/server/other.ts')).some((m) => m.ruleId === 'local/require-handler-guard')).toBe(false);
  });
  it('every handler in the repository passes', async () => {
    const results = await eslint.lintFiles(['src/app/api/**/route.ts']);
    const bad = results.flatMap((r) => r.messages.filter((m) => m.ruleId === 'local/require-handler-guard').map(() => r.filePath));
    expect(bad).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(7); // the five admin auth handlers, health and log at the time of writing
  });
});

describe('the scene frame owns input (AD-15, Story 2.3)', () => {
  const flagged = async (code: string, file: string) => (await lint(code, file)).filter((m) => ['no-restricted-imports', 'no-restricted-properties', 'no-restricted-syntax'].includes(m.ruleId ?? '') && !/hex|logical|dynamic import/i.test(m.message));
  const renderer = 'src/scenes/types/cone/render.tsx';
  it('a renderer may not import a controls class', async () => {
    expect((await flagged("import { OrbitControls } from '@react-three/drei';\nexport const A = OrbitControls;\n", renderer)).length).toBeGreaterThan(0);
    expect((await flagged("import { TrackballControls } from '@react-three/drei';\nexport const A = TrackballControls;\n", renderer)).length).toBeGreaterThan(0);
    expect((await flagged("import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';\nexport const A = OrbitControls;\n", renderer)).length).toBeGreaterThan(0);
    expect((await flagged("import { OrbitControls } from 'three-stdlib';\nexport const A = OrbitControls;\n", renderer)).length).toBeGreaterThan(0);
  });
  it('a renderer may not attach a listener', async () => {
    expect((await flagged("export const a = (el: HTMLElement) => el.addEventListener('pointerdown', () => 1);\n", renderer)).length).toBeGreaterThan(0);
    expect((await flagged("export const a = () => window.addEventListener('keydown', () => 1);\n", 'src/scenes/types/cone/hooks.ts')).length).toBeGreaterThan(0);
  });
  it('a renderer may not put input handler props on its elements', async () => {
    for (const prop of ['onPointerDown', 'onPointerMove', 'onMouseDown', 'onTouchStart', 'onWheel', 'onKeyDown', 'onDragStart', 'onContextMenu', 'onClick']) {
      expect((await flagged(`export const A = () => <div ${prop}={() => 1} />;\n`, renderer)).length, prop).toBeGreaterThan(0);
    }
  });
  it('the other controls and gesture libraries are blocked too', async () => {
    for (const name of ['PresentationControls', 'ScrollControls', 'KeyboardControls', 'WalkControls']) {
      expect((await flagged(`import { ${name} } from '@react-three/drei';\nexport const A = ${name};\n`, renderer)).length, name).toBeGreaterThan(0);
    }
    expect((await flagged("import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nexport const A = OrbitControls;\n", renderer)).length).toBeGreaterThan(0);
    expect((await flagged("import { useDrag } from '@use-gesture/react';\nexport const A = useDrag;\n", renderer)).length).toBeGreaterThan(0);
  });
  it('more handler props and plain property assignments are blocked', async () => {
    for (const prop of ['onDoubleClick', 'onAuxClick', 'onScroll', 'onLostPointerCapture', 'onGotPointerCapture']) {
      expect((await flagged(`export const A = () => <div ${prop}={() => 1} />;\n`, renderer)).length, prop).toBeGreaterThan(0);
    }
    expect((await flagged('export const a = (el: HTMLElement) => { el.onpointerdown = () => 1; };\n', renderer)).length).toBeGreaterThan(0);
    expect((await flagged('export const a = (el: HTMLElement) => { el.onwheel = () => 1; };\n', renderer)).length).toBeGreaterThan(0);
  });
  it('the frame itself may do all of it', async () => {
    const f = 'src/scenes/frame/inner.tsx';
    expect(await flagged("export const A = (el: HTMLElement) => el.addEventListener('wheel', () => 1);\n", f)).toEqual([]);
    expect(await flagged('export const B = () => <div onPointerDown={() => 1} onKeyDown={() => 1} />;\n', f)).toEqual([]);
    expect(await flagged("import { OrbitControls } from '@react-three/drei';\nexport const C = OrbitControls;\n", f)).toEqual([]);
  });
  it('other drei imports and ordinary renderer code are fine', async () => {
    expect(await flagged("import { Line } from '@react-three/drei';\nexport const A = Line;\n", renderer)).toEqual([]);
    expect(await flagged('export const A = ({ view }: { view: number }) => <div>{view}</div>;\n', renderer)).toEqual([]);
  });
  it('code outside src/scenes is not touched by this rule', async () => {
    expect(await flagged("export const a = (el: HTMLElement) => el.addEventListener('click', () => 1);\n", 'src/features/x/y.ts')).toEqual([]);
  });
  it('the existing syntax rules still apply inside scenes (hex colors)', async () => {
    expect((await lint("export const c = '#2B4A8B';\n", renderer)).some((m) => /hex/i.test(m.message))).toBe(true);
  });
  it('the real scene sources pass', async () => {
    const results = await eslint.lintFiles(['src/scenes/**/*.{ts,tsx}']);
    expect(results.flatMap((r) => r.messages.filter((m) => m.severity === 2))).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(8);
  });
});
