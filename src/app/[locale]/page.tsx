import { HomePage } from '../../features/library';
import { getCatalog } from '../../server/catalog-source';

// Home (Story 5.2). Static per locale: the catalog is read when the page is built or revalidated, never per request.
export default async function Home() {
  return <HomePage catalog={await getCatalog()} />;
}
