import { useLocale, useTranslations } from 'next-intl';
import { topicHref } from '../../lib/library';
import type { MapLayout, MapRef } from '../../lib/map';
import { ViewedMark } from '../progress';

// The learning map as a list (Story 5.5): the way to read it with a keyboard or a screen reader, and a plain reading on
// a phone. One group per chapter; each topic is a link with what it needs and what it leads to, and a topic of another
// category is named with its category. Same data as the picture, nothing more or less.

function Refs({ label, refs }: { label: string; refs: readonly MapRef[] }) {
  const locale = useLocale();
  if (refs.length === 0) return null;
  return (
    <p className="m-0" data-refs={label}>
      <span className="font-semibold">{label}: </span>
      {refs.map((r, i) => (
        <span key={r.id}>
          {i > 0 ? ', ' : ''}
          <a href={topicHref(locale, r.id)} className="inline-flex min-h-11 items-center text-link underline">
            {r.categoryName ? `${r.title} (${r.categoryName})` : r.title}
          </a>
        </span>
      ))}
    </p>
  );
}

export function MapList({ layout }: { layout: MapLayout }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <section aria-labelledby="map-list-title" className="flex flex-col gap-4" data-map-list="">
      <h2 id="map-list-title" className="m-0 text-2xl font-semibold">
        {t('map.listTitle')}
      </h2>
      {layout.list.map((group, i) => (
        <section key={i} className="flex flex-col gap-2">
          <h3 className="m-0 text-xl font-semibold">{group.name}</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {group.topics.map((topic) => (
              <li key={topic.id} className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3" data-map-item={topic.id}>
                <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a href={topicHref(locale, topic.id)} className="inline-flex min-h-11 items-center text-lg font-semibold text-link underline">
                    {topic.title}
                  </a>
                  <span className="rounded-full border border-border-strong px-3" data-level={topic.level}>
                    {t(`topic.level.${topic.level}`)}
                  </span>
                  <span>{t('topic.minutes', { n: topic.minutes })}</span>
                  <ViewedMark id={topic.id} />
                </p>
                <Refs label={t('map.needs')} refs={topic.needs} />
                <Refs label={t('map.leads')} refs={topic.leads} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
