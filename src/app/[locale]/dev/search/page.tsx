import { notFound } from 'next/navigation';
import { SearchScreen } from '../../../../features/library';
import { buildSearchData } from '../../../../lib/library';
import { getCatalog } from '../../../../server/catalog-source';

// The search harness (Story 5.3): the real `SearchScreen` with the fixture catalog, for the browser tests, because the
// built search page is prerendered without a database. Like the other harnesses it exists only when the server is
// started with VM_HARNESS=1.
export const dynamic = 'force-dynamic';

export default async function Harness({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VM_HARNESS !== '1') notFound();
  const { locale } = await params;
  return <SearchScreen data={buildSearchData(await getCatalog(), locale)} />;
}
