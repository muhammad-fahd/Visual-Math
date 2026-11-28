import { BackLink, NothingFound } from '../../features/library';
import { categories } from '../../lib/library';
import { getCatalog } from '../../server/catalog-source';

// A page under /[locale] that found nothing (FR-1.10): the friendly page with the search box and the categories, and
// a way back one level up the address. An unsupported language (/fr) never gets here: `proxy.ts` sends it to the
// global 404.
export default async function LocaleNotFound() {
  // The friendly page must survive the failure that may have sent the visitor here: no categories, not an error.
  const list = await getCatalog().then(categories, () => []);
  return (
    <NothingFound categories={list}>
      <BackLink />
    </NothingFound>
  );
}
