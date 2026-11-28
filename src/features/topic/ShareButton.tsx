'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

// Share (FR-1.11, S): copies this topic's own link, with no step or slider values, in the language of the page, and a
// polite toast says so. If the browser refuses to copy, the link is shown to copy by hand. Nothing is sent anywhere.

type State = { kind: 'idle' } | { kind: 'copied' } | { kind: 'failed'; link: string };

export function ShareButton() {
  const t = useTranslations('topic');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const share = async () => {
    const link = `${window.location.origin}${window.location.pathname}`;
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(link);
      setState({ kind: 'copied' });
      timer.current = setTimeout(() => setState({ kind: 'idle' }), 4000);
    } catch {
      setState({ kind: 'failed', link });
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={share} className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold text-text" data-testid="share">
        {t('share')}
      </button>
      <p role="status" aria-live="polite" className="m-0 min-h-6" data-testid="share-status">
        {state.kind === 'copied' ? t('shareCopied') : state.kind === 'failed' ? t('shareFailed') : null}
      </p>
      {state.kind === 'failed' ? (
        <input readOnly aria-label={t('shareFailed')} value={state.link} onFocus={(e) => e.currentTarget.select()} dir="ltr" className="min-h-11 w-full rounded-md border-2 border-border-strong bg-surface px-3 text-text" data-testid="share-link" />
      ) : null}
    </div>
  );
}
