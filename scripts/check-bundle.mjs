// CI check (AD-1, AD-9): scan the built client bundle for a service-role key and for `eval` or
// `new Function`. Part of `npm run check`, after the build. The browser must never hold a secret
// that opens the database, and nothing in it may execute text as code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// What visitors can download: the client chunks, and the prerendered pages and their data.
const DIST = process.env.NEXT_DIST_DIR || '.next'; // the build folder (a second one lets the browser tests build beside `next dev`)
export const CLIENT_DIR = `${DIST}/static`;
export const PRERENDERED_DIR = `${DIST}/server/app`;

/**
 * Known harmless occurrences in third-party code, each with the reason. Empty today. To add one,
 * match the exact text from the hit (`text`) and what comes right before it (`before`), so a new
 * occurrence elsewhere, even next to an allowed one, still fails.
 */
export const ALLOWED = [
  {
    rule: 'new-function',
    before: '||',
    text: 'Function("return this")()',
    reason: "core-js (Next's polyfill chunk) looks up the global object this way as its last fallback, after `function(){return this}()`; the string is constant and nothing from a topic or a visitor reaches it. The CSP has no unsafe-eval, so it could not run in a browser anyway.",
  },
];

const RULES = [
  { id: 'eval', pattern: /(?<![\w$.])eval\s*\(/g, message: 'eval(' },
  { id: 'global-eval', pattern: /\b(?:window|globalThis|self|global)\s*\.\s*eval\b/g, message: 'window.eval' },
  { id: 'eval-alias', pattern: /=\s*eval\s*[;,)]/g, message: 'an alias of eval' },
  { id: 'indirect-eval', pattern: /\(\s*0\s*,\s*eval\s*\)/g, message: '(0, eval)' },
  { id: 'new-function', pattern: /(?<![\w$.])(?:new\s+)?Function\s*\(/g, message: 'new Function(' }, // with or without new
  { id: 'service-role-name', pattern: /SUPABASE_SERVICE_ROLE_KEY/g, message: 'the name of the service-role variable' },
  { id: 'secret-key', pattern: /sb_secret_[A-Za-z0-9_-]{16,}/g, message: 'a Supabase secret key (sb_secret_...)' },
];

/** A JWT whose payload says role: service_role (the old style of Supabase service key). */
function serviceRoleJwts(text) {
  const found = [];
  for (const m of text.matchAll(/eyJ[\w-]{6,}\.(eyJ[\w-]{6,})\.[\w-]{6,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload && payload.role === 'service_role') found.push(m.index);
    } catch {
      // not a JWT after all
    }
  }
  return found;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Returns problems for one file's text. `secrets` are exact values that must not appear. */
export function scanText(file, text, secrets = []) {
  const problems = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      // An allowance matches exactly where the hit starts, so a second hit beside it is not excused.
      if (ALLOWED.some((a) => a.rule === rule.id && text.slice(m.index - a.before.length, m.index + a.text.length) === a.before + a.text)) continue;
      problems.push(`${file}:${lineOf(text, m.index)} contains ${rule.message}`);
    }
  }
  for (const index of serviceRoleJwts(text)) problems.push(`${file}:${lineOf(text, index)} contains a service-role JWT`);
  for (const secret of secrets) {
    if (secret.length >= 20 && text.includes(secret)) problems.push(`${file} contains the value of a server secret`);
  }
  return problems;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(js|mjs|css|html|json|rsc|txt)$/.test(name)) out.push(full); // not .map: not served in production
  }
  return out;
}

export function scanDir(dir = CLIENT_DIR, secrets = []) {
  let files;
  try {
    files = walk(dir);
  } catch {
    return [`no build output in ${dir}: run the build first`];
  }
  if (files.length === 0) return [`${dir} has no files to scan`];
  return files.flatMap((file) => scanText(relative(process.cwd(), file).replaceAll('\\', '/'), readFileSync(file, 'utf8'), secrets));
}

/** The seed budget for the lazy 3D chunk, gzipped (architecture, budgets): CI fails above it. */
export const THREE_BUDGET_BYTES = 450 * 1024;

/**
 * The chunks that carry three.js (found by the renderer's name) and their gzipped size together. Every
 * other chunk must be free of it: that is what keeps the 3D engine out of a page without a 3D picture.
 */
export function threeChunks(dir = CLIENT_DIR) {
  let files;
  try {
    files = walk(dir).filter((f) => f.endsWith('.js'));
  } catch {
    return { files: [], gzipBytes: 0 };
  }
  const withThree = files.filter((f) => readFileSync(f, 'utf8').includes('WebGLRenderer'));
  const gzipBytes = withThree.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
  return { files: withThree.map((f) => relative(process.cwd(), f).replaceAll('\\', '/')), gzipBytes };
}

export function threeProblems(dir = CLIENT_DIR, budget = THREE_BUDGET_BYTES) {
  const { files, gzipBytes } = threeChunks(dir);
  return gzipBytes > budget ? [`the 3D chunk is ${Math.round(gzipBytes / 1024)} KB gzip, above its budget of ${Math.round(budget / 1024)} KB (${files.join(', ')})`] : [];
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
  if (secrets.length === 0) console.log('note: SUPABASE_SERVICE_ROLE_KEY is not set here, so only patterns were checked, not its exact value');
  // An explicit directory (tests) is scanned alone; the default also covers the prerendered pages.
  const dirs = process.argv[2] ? [process.argv[2]] : [CLIENT_DIR, PRERENDERED_DIR];
  const problems = [...dirs.flatMap((d) => scanDir(d, secrets)), ...(process.argv[2] ? [] : threeProblems())];
  if (problems.length > 0) {
    console.error('bundle check failed:\n' + problems.slice(0, 30).map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  const three = process.argv[2] ? null : threeChunks();
  console.log('bundle ok (no secret, no eval, no new Function)' + (three && three.files.length > 0 ? `; 3D chunk ${Math.round(three.gzipBytes / 1024)} KB gzip of ${Math.round(THREE_BUDGET_BYTES / 1024)} KB` : ''));
}
