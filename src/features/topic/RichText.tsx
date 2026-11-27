'use client';

import { useTranslations } from 'next-intl';
import { tokenize } from '../../lib/text';
import { useOpenTerm } from './TermSheet';

// Topic prose as elements, never as HTML (AD-14): `**bold**` is <strong>, `{{term:id}}` is the term's
// words as a button that opens its explanation (FR-2.6). A term the topic does not define shows nothing,
// and outside a term provider the words are plain. Anything else is plain text.

export function RichText({ text, terms }: { text: string; terms: Readonly<Record<string, string>> }) {
  const open = useOpenTerm();
  const t = useTranslations('topic');
  return (
    <>
      {tokenize(text).map((token, i) => {
        if (token.kind === 'bold') return <strong key={i}>{token.text}</strong>;
        if (token.kind === 'term') {
          const words = Object.hasOwn(terms, token.id) ? terms[token.id] : undefined;
          if (!words) return null;
          if (!open) {
            return (
              <span key={i} className="font-semibold" data-term={token.id}>
                {words}
              </span>
            );
          }
          return (
            <button
              key={i}
              type="button"
              aria-haspopup="dialog"
              aria-label={t('termAbout', { term: words })}
              onClick={() => open(token.id)}
              className="inline cursor-pointer border-0 bg-transparent p-0 font-semibold text-link underline decoration-dotted underline-offset-4"
              data-term={token.id}
            >
              {words}
            </button>
          );
        }
        return token.text;
      })}
    </>
  );
}
