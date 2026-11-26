import en from './en.json';
import ur from './ur.json';

// One line per language file. Static imports on purpose: no dynamic import of a computed path (AD-1).
// Urdu text is an AI draft until the admin has checked it (NFR-6.4).
export type Messages = typeof en;
const BY_LOCALE: Record<string, unknown> = { en, ur };

export type Tree = { [key: string]: string | Tree };

const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep merge: `over` wins; keys it lacks keep the `base` value. Ignores `__proto__` and arrays. */
export function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k === '__proto__') continue;
    const b = out[k];
    if (isTree(v) && isTree(b)) out[k] = merge(b, v);
    else if (typeof v === 'string' || isTree(v)) out[k] = v;
  }
  return out;
}

/** English is the base; the locale's messages override it, so a missing key falls back to English. */
export function messagesFor(locale: string): Messages {
  const own = BY_LOCALE[locale];
  return (locale === 'en' || !isTree(own) ? en : merge(en as Tree, own)) as Messages;
}

export const MESSAGE_LOCALES = Object.keys(BY_LOCALE);
