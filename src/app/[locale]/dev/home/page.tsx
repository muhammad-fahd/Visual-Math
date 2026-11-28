import { notFound } from 'next/navigation';
import { HomePage } from '../../../../features/library';
import { buildCatalog } from '../../../../lib/topic-schema/catalog';
import { getCatalog } from '../../../../server/catalog-source';

// The home page harness (Story 5.2): the real `HomePage` with the fixture catalog, for the browser tests, because the
// built home is prerendered without a database. `?empty=1` shows it with no topic. Like the other harnesses it exists
// only when the server is started with VM_HARNESS=1.
export const dynamic = 'force-dynamic';

export default async function Harness({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VM_HARNESS !== '1') notFound();
  const { empty } = await searchParams;
  const catalog = [empty].flat().includes('1') ? buildCatalog({ categories: [], subcategories: [], chapters: [], topics: [] }, new Date()).catalog : await getCatalog();
  return <HomePage catalog={catalog} />;
}
