import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import type { SearchData } from '../../lib/library';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { SearchPage } from './SearchPage';
import { SearchResults } from './SearchResults';

// The whole search screen (Story 5.3): language switch, the heading, and the interactive search inside a Suspense
// boundary, because it reads the address in the browser. Before the script runs (or without it) the fallback lists
// every topic. The route and the test harness page both render this.
export function SearchScreen({ data }: { data: SearchData }) {
  const t = useTranslations('search');
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4" data-search-route="">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="m-0 text-3xl font-bold">{t('title')}</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" data-search-fallback="">
            <p className="m-0 font-semibold">{t('all')}</p>
            <SearchResults entries={data.topics} />
          </div>
        }
      >
        <SearchPage data={data} />
      </Suspense>
    </main>
  );
}
