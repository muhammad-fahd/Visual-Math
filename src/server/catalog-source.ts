import 'server-only';
import { cache } from 'react';
import { buildCatalog, type Catalog } from '../lib/topic-schema/catalog';
import { databasePort, rebuildCatalog } from './catalog';

// The catalog the visitor pages read (Story 5.1): from the database when one is configured, from the fixtures
// under the harness (VM_HARNESS=1, set only when a test server starts), and otherwise an empty catalog, which the
// pages show as "no topics yet". A database that is configured but fails is an error, never a silent empty site.
// Revalidation by the `catalog` tag belongs to Story 7.3.

export const emptyCatalog = (): Catalog => buildCatalog({ categories: [], subcategories: [], chapters: [], topics: [] }, new Date()).catalog;

export const getCatalog = cache(async (): Promise<Catalog> => {
  if (process.env['VM_HARNESS'] === '1') {
    const { fixturePort } = await import('./fixture-catalog');
    const { catalog, skipped } = await rebuildCatalog(fixturePort);
    if (skipped.length > 0) console.error(JSON.stringify({ event: 'catalog.skipped', skipped }));
    return catalog;
  }
  const port = databasePort();
  if (!port) return emptyCatalog();
  const { catalog, skipped } = await rebuildCatalog(port);
  if (skipped.length > 0) console.error(JSON.stringify({ event: 'catalog.skipped', skipped }));
  return catalog;
});
