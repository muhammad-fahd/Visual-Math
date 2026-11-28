import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import type { MapData } from '../../lib/map';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { MapGraph } from './MapGraph';
import { MapList } from './MapList';
import { MapPage } from './MapPage';

// The whole learning map screen (Story 5.5): language switch, the heading, and the interactive map inside a Suspense
// boundary because it reads the address in the browser. Before the script runs (or without it) the fallback is the
// first category's map. The route and the test harness page both render this.
export function MapScreen({ data }: { data: MapData }) {
  const t = useTranslations('map');
  const first = data.categories[0] ? data.layouts[data.categories[0].id] : undefined;
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4" data-map-route="">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="m-0 text-3xl font-bold">{t('title')}</h1>
      <Suspense
        fallback={
          first ? (
            <div className="flex flex-col gap-6" data-map-fallback="">
              <p className="m-0 text-muted">{t('hint')}</p>
              <MapGraph layout={first} />
              <MapList layout={first} />
            </div>
          ) : (
            <p className="m-0">{t('empty')}</p>
          )
        }
      >
        <MapPage data={data} />
      </Suspense>
    </main>
  );
}
