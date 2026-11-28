import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MapScreen } from '../../../features/map';
import { buildMapData } from '../../../lib/map';
import { getCatalog } from '../../../server/catalog-source';

// The learning map (Story 5.5, FR-1.7). Static per locale: the page carries the layout of every category's map, and the
// browser picks one by the `cat` in the address, so the server never reads the query.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t('map.title')} | ${t('site.name')}` };
}

export default async function MapRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <MapScreen data={buildMapData(await getCatalog(), locale)} />;
}
