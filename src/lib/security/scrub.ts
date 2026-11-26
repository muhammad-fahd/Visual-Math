// Scrubbing for the first-party error log (AD-26, NFR-2.2): an error is useful without knowing who
// had it. Nothing here proves a string is clean; it removes the usual carriers of personal data and
// the log table's length checks are the backstop.

const MAX_MESSAGE = 500;
const MAX_DETAIL = 2000;
const MAX_PATH = 200;

// A control character (other than tab and newline) would let one entry pose as several log lines.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const RULES: [RegExp, string][] = [
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, '[token]'], // a JWT
  [/[\p{L}\p{N}._+-]+@[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+/gu, '[email]'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]'],
  [/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, '[ip]'], // IPv6, full form
  [/(?<![\w:])(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{0,4}::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6})?(?![\w:])/gi, '[ip]'], // IPv6, with ::
  [/(https?:\/\/[^\s'"<>?#]*)[?#][^\s'"<>]*/g, '$1'], // a URL loses its query and fragment
  [/\b[A-Za-z0-9_\-+/=]{32,}\b/g, '[token]'], // a long opaque string: a key, a session id, a hash
  [/(?<![\d\u0660-\u0669\u06F0-\u06F9])[\d\u0660-\u0669\u06F0-\u06F9]{9,}(?![\d\u0660-\u0669\u06F0-\u06F9])/g, '[number]'], // also Eastern Arabic-Indic digits
];

function clean(input: unknown, max: number): string {
  let s = typeof input === 'string' ? input : '';
  s = s.replace(CONTROL, ' ');
  for (const [pattern, replacement] of RULES) s = s.replace(pattern, replacement);
  s = s.trim();
  // Cut by code points, so a character outside the BMP is never split into a lone surrogate.
  const points = Array.from(s);
  return points.length > max ? `${points.slice(0, max - 1).join('')}…` : s;
}

export const scrubMessage = (input: unknown): string => clean(input, MAX_MESSAGE);
export const scrubDetail = (input: unknown): string | null => {
  const s = clean(input, MAX_DETAIL);
  return s === '' ? null : s;
};

/** Keeps the path only: no query, no fragment, no host. Anything that is not a path becomes "/". */
export function scrubPath(input: unknown): string {
  if (typeof input !== 'string') return '/';
  let path = input;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) path = new URL(path).pathname;
  } catch {
    return '/';
  }
  path = path.split(/[?#]/)[0] ?? '/';
  if (!path.startsWith('/')) return '/';
  path = path.replace(CONTROL, '').replace(/[^\x20-\x7E]/g, '?');
  // A path segment that looks like a secret (a token in the URL) is not kept.
  // Each segment goes through the same rules as a message: an address or email in a path is not kept either.
  path = path
    .split('/')
    .map((seg) => (seg.length >= 32 && /^[A-Za-z0-9_\-+=]+$/.test(seg) ? '[token]' : clean(seg, MAX_PATH)))
    .join('/');
  return path.length > MAX_PATH ? path.slice(0, MAX_PATH) : path;
}
