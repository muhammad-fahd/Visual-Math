import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SearchScreen } from '../../../features/library';
import { buildSearchData } from '../../../lib/library';
import { getCatalog } from '../../../server/catalog-source';

// Search (Story 5.3, FR-1.4, 1.5, AD-21). Static per locale: the page carries the published topics' search data and
// the browser does the matching, so the server never reads the query.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t('search.title')} | ${t('site.name')}` };
}

export default async function Search({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SearchScreen data={buildSearchData(await getCatalog(), locale)} />;
}
