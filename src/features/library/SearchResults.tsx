import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { topicHref, type SearchEntry } from '../../lib/library';
import { ViewedMark } from '../progress';

// The search results (FR-1.4): each card is one link to the topic with title, summary, level, minutes, the viewed
// mark and the category path. Plain markup with no state, so the page can show it before any script runs. No prefetch:
// a long list would otherwise fetch every topic page it shows.

export function SearchResults({ entries }: { entries: readonly SearchEntry[] }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" data-results="">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={topicHref(locale, e.id)} prefetch={false} className="flex min-h-11 flex-col gap-2 rounded-md border border-border bg-surface p-4 text-text no-underline" data-result={e.id}>
            <h2 className="m-0 text-xl font-semibold">{e.title}</h2>
            <p className="m-0 text-muted" data-path="">
              {e.path.map((part, i) => (
                <span key={i}>
                  {i > 0 ? (
                    <span aria-hidden="true" className="mx-1 inline-block rtl:rotate-180">
                      ›
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </p>
            <p className="m-0">{e.summary}</p>
            <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="rounded-full border border-border-strong px-3" data-level={e.level}>
                {t(`topic.level.${e.level}`)}
              </span>
              <span>{t('topic.minutes', { n: e.minutes })}</span>
              <ViewedMark id={e.id} />
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
