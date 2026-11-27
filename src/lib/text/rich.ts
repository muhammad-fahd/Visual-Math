// Topic prose as tokens, never as HTML (AD-14, FR-4.6): `**bold**` and `{{term:id}}` are the only markup a
// step, a Try this or a Watch out may carry. The page turns the tokens into elements. Pure.

export type Token =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'bold'; readonly text: string }
  | { readonly kind: 'term'; readonly id: string };

const MARKUP = /\*\*([^*\n]{1,200})\*\*|\{\{term:([a-z][a-zA-Z0-9-]{0,31})\}\}/g;
const MAX = 2000;

export function tokenize(input: string): Token[] {
  const text = typeof input === 'string' ? input.slice(0, MAX) : '';
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKUP)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else out.push({ kind: 'term', id: m[2]! });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** The same prose as plain text (for an `aria-label` or the live region): markup removed, a term as its words. */
export function plainText(input: string, terms: Readonly<Record<string, string>> = {}): string {
  return tokenize(input)
    .map((t) => (t.kind === 'term' ? (Object.hasOwn(terms, t.id) ? terms[t.id]! : '') : t.text))
    .join('');
}
