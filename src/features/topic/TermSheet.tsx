'use client';

import { useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';

// Marked terms (FR-2.6): a word in a step, an example or a note that the topic defines opens a short
// explanation. The sheet is a native modal <dialog> like the report sheet: the browser keeps focus inside,
// closes it on Esc, makes the page behind inert and gives focus back to the word. The words and the
// definition come from the topic, in the visitor's language, and are shown as text.

export interface TermEntry {
  id: string;
  term: string;
  definition: string;
}

const OpenTerm = createContext<((id: string) => void) | null>(null);

/** Opens the sheet for a term id; null outside a `TermProvider` (the word is then plain text). */
export const useOpenTerm = () => useContext(OpenTerm);

export function TermProvider({ terms, children }: { terms: readonly TermEntry[]; children: ReactNode }) {
  const t = useTranslations('topic');
  const dialog = useRef<HTMLDialogElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const titleId = useId();
  const entry = openId === null ? undefined : terms.find((x) => x.id === openId);

  useEffect(() => {
    if (entry && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [entry]);

  return (
    <OpenTerm.Provider value={(id) => setOpenId(id)}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpenId(null)}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-xl border-2 border-border-strong bg-surface p-0 text-text backdrop:bg-scrim sm:m-auto sm:max-w-lg sm:rounded-xl"
        data-testid="term-sheet"
      >
        {entry ? (
          <div className="flex flex-col gap-4 p-4">
            <h2 id={titleId} className="m-0 text-xl font-semibold" data-testid="term-title">
              {entry.term}
            </h2>
            <p className="m-0" data-testid="term-definition">
              {entry.definition}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-md border-2 border-primary bg-primary px-4 font-semibold text-on-primary" data-testid="term-close">
                {t('termClose')}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </OpenTerm.Provider>
  );
}
