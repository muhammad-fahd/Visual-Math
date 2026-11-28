'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useSyncExternalStore } from 'react';
import { PROGRESS_KEY, viewedIds } from './read';

// "Viewed" with a check, for a topic the visitor has viewed on this device; nothing for one not yet viewed
// (UX topic-card). It is a word plus an icon, never color alone (FR-1.3). The server and the first client render
// both show nothing, so the page is the same static HTML for everyone and the mark appears after hydration.

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
};
const read = (): string | null => {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null; // storage blocked: no marks, no error
  }
};

export function ViewedMark({ id }: { id: string }) {
  const t = useTranslations('library');
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const viewed = useMemo(() => viewedIds(raw), [raw]);
  if (!viewed.has(id)) return null;
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-text" data-viewed="">
      <span aria-hidden="true">✓</span>
      {t('viewed')}
    </span>
  );
}
