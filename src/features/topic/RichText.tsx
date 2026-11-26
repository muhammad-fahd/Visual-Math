import { tokenize } from '../../lib/text';

// Topic prose as elements, never as HTML (AD-14): `**bold**` is <strong>, `{{term:id}}` is the term's
// words, set apart so Story 2.8 can make it open an explanation. Anything else is plain text.

export function RichText({ text, terms }: { text: string; terms: Readonly<Record<string, string>> }) {
  return (
    <>
      {tokenize(text).map((token, i) => {
        if (token.kind === 'bold') return <strong key={i}>{token.text}</strong>;
        if (token.kind === 'term') {
          const words = Object.hasOwn(terms, token.id) ? terms[token.id] : undefined;
          return words ? (
            <span key={i} className="font-semibold underline decoration-dotted underline-offset-4" data-term={token.id}>
              {words}
            </span>
          ) : null;
        }
        return token.text;
      })}
    </>
  );
}
