'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { PROGRESS_KEY, viewedIds } from './read';

// The ids of the topics viewed on this device, for the marks on cards, search results and the learning map. The server
// and the first client render see none, so every page is the same static HTML for everyone and the marks arrive after
// hydration. Reads the one key only (`read.ts`), validated by hand; storage that is blocked or damaged means no marks.

const subscribe = (notify: () => void) => {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
};
const read = (): string | null => {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
};

export function useViewedIds(): ReadonlySet<string> {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => viewedIds(raw), [raw]);
}
