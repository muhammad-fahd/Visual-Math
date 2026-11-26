// CI check (AD-1, AD-9): scan the built client bundle for a service-role key and for `eval` or
// `new Function`. Part of `npm run check`, after the build. The browser must never hold a secret
// that opens the database, and nothing in it may execute text as code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

// What visitors can download: the client chunks, and the prerendered pages and their data.
export const CLIENT_DIR = '.next/static';
export const PRERENDERED_DIR = '.next/server/app';

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
  const problems = dirs.flatMap((d) => scanDir(d, secrets));
  if (problems.length > 0) {
    console.error('bundle check failed:\n' + problems.slice(0, 30).map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('bundle ok (no secret, no eval, no new Function)');
}
