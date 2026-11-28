'use client';

import { useTranslations } from 'next-intl';
import { useViewedIds } from './useViewedIds';

// "Viewed" with a check, for a topic the visitor has viewed on this device; nothing for one not yet viewed
// (UX topic-card). It is a word plus an icon, never color alone (FR-1.3). The server and the first client render
// both show nothing, so the page is the same static HTML for everyone and the mark appears after hydration.

export function ViewedMark({ id }: { id: string }) {
  const t = useTranslations('library');
  const viewed = useViewedIds();
  if (!viewed.has(id)) return null;
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-text" data-viewed="">
      <span aria-hidden="true">✓</span>
      {t('viewed')}
    </span>
  );
}
