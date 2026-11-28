'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { MapData } from '../../lib/map';
import { MapGraph } from './MapGraph';
import { MapList } from './MapList';

// The learning map page (Story 5.5, FR-1.7): chips pick the category, the graph and the list follow. The category
// lives in the address (`cat`), read in the browser, so a shared link restores it; the first category with topics is
// the default. An unknown `cat` is ignored.

export function MapPage({ data }: { data: MapData }) {
  const t = useTranslations('map');
  const params = useSearchParams();
  const wanted = params.get('cat') ?? '';
  const first = data.categories[0]?.id ?? '';
  const [category, setCategory] = useState(data.layouts[wanted] ? wanted : first);

  useEffect(() => {
    const query = category === first ? '' : `?cat=${encodeURIComponent(category)}`;
    const url = `${window.location.pathname}${query}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', url);
  }, [category, first]);

  if (data.categories.length === 0) {
    return (
      <p className="m-0" data-map-empty="">
        {t('empty')}
      </p>
    );
  }
  const layout = data.layouts[category]!;
  return (
    <div className="flex flex-col gap-6" data-map-page="">
      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        <legend className="mb-2 font-semibold">{t('categoryGroup')}</legend>
        {data.categories.map((c) => {
          const on = c.id === category;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setCategory(c.id)}
              className={`inline-flex min-h-11 items-center gap-1 rounded-sm border-2 px-3 font-semibold text-text ${on ? 'border-primary bg-selected' : 'border-border-strong bg-surface'}`}
              data-chip={c.id}
            >
              {on ? <span aria-hidden="true">✓</span> : null}
              {c.name}
            </button>
          );
        })}
      </fieldset>
      <p className="m-0 text-muted" data-map-hint="">
        {t('hint')}
      </p>
      <MapGraph layout={layout} />
      <MapList layout={layout} />
    </div>
  );
}
