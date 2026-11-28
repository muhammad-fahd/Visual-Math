import { notFound } from 'next/navigation';
import { MapScreen } from '../../../../features/map';
import { buildMapData } from '../../../../lib/map';
import { getCatalog } from '../../../../server/catalog-source';

// The learning map harness (Story 5.5): the real `MapScreen` with the fixture catalog, for the browser tests, because
// the built page is prerendered without a database. Like the other harnesses it exists only when the server is
// started with VM_HARNESS=1.
export const dynamic = 'force-dynamic';

export default async function Harness({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VM_HARNESS !== '1') notFound();
  const { locale } = await params;
  return <MapScreen data={buildMapData(await getCatalog(), locale)} />;
}
