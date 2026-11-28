---
title: 'Story 5.1: Catalog and tree pages'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'b2ea825f91c1c33f10a015126f3bcb386771e61f'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Visitors cannot browse. There is no catalog, no tree page, and no list of topics; the topic page is reachable only from a dev harness.

**Approach:** A pure, typed catalog (`lib/topic-schema/catalog.ts`) built by `rebuildCatalog()` on the server from database rows through a small port, and server-rendered category, subcategory and chapter pages (both locales) that read it. Chapter pages list topic cards with a viewed mark read on the device.

## Boundaries & Constraints

**Always:** `catalog.json` is generated whole from rows, never patched (AD-20); only topics with `published_hash` set and `deleted_at` null appear in any list, count or link (FR-1.9). Counts at every level are published topics only. Pages are static per locale, read no cookie, header or `searchParams` on the server, and use logical CSS, tokens only, 44 px targets, plain-text level badges (not color alone). The viewed mark is client-side and absent for an unviewed topic. Links keep `step` and `p.` keys untouched. English and Urdu strings for every new word. Addresses (owner decision): tree pages are `/{locale}/{category}`, `/{locale}/{category}/{subcategory}` and `/{locale}/{category}/{subcategory}/{chapter}`; a topic's direct link is `/{locale}/topic/{id}`, so moving a topic never breaks a link. Top-level words used by other pages (`topic`, `search`, `map`, `help`, `about`, `privacy`, `terms`, `faq`, `contact`, `progress`, `plans`, `admin`, `api`, `dev`) are reserved and never a category slug.

**Never:** No writing to Storage, no revalidation, no publish saga (Story 7.3). No thumbnail rendering (7.3; `thumb` is null until then). No search, filters, home page or learning map (5.2, 5.3, 5.5). No writing progress (6.1). No Zod in the browser bundle. No live database in tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Counts | Chapter with 2 published, 1 unpublished, 1 deleted topic | Chapter count 2; its subcategory and category add 2 | N/A |
| Empty branch | Category with no published topic | Row present with count 0; page says no topics yet, with a way back | N/A |
| Hidden topic | Unpublished or deleted topic id requested | In no list or count; its card never rendered | Tombstone for one that was once published |
| Order | Rows in any order | Tree by `position`, topics by `chapterOrder`, then id; identical input gives identical bytes except `generatedAt` | N/A |
| Unknown slug | `/algebra/nope` | Friendly not-found with a link back to the parent | N/A |
| Viewed | `vm.progress.v1` lists the topic | Card shows "Viewed" with a check icon | Invalid or missing key: no marks, no error |
| Urdu | `/ur/...` | Urdu names and titles, right-to-left, numbers per locale rules | Missing Urdu name falls back to English |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0002_math_tree_and_topics.sql` -- tables read by the catalog (`category`, `subcategory`, `chapter`, `topic`, `topic_version.doc`, `published_hash`); change nothing
- `src/lib/topic-schema/schema.ts` -- topic metadata (`path`, `level`, `estimatedMinutes`, `title`, `summary`, `tags`, `prerequisites`, `next`)
- `src/lib/text/*` -- plain text of a rich string for `searchTokens` (extend `normalizeSearch` in 5.3, not here)
- `src/server/{reports,health}.ts`, `src/server/admin/supabase-adapters.ts` -- pattern for a port plus a Supabase adapter and a stub-client test
- `src/features/topic/{TopicPage,PathLinks}.tsx` -- card and path styling; `hrefs` and `names` props are where real addresses plug in
- `src/app/[locale]/page.tsx`, `layout.tsx` -- locale root; `dynamicParams` is false for the locale only
- `src/i18n/messages/{en,ur}.json`; `tests/unit/{i18n,topic-page-render,math-tree-migration}.test.ts`; `tests/e2e/topic.spec.ts` -- patterns to follow
- Fixtures: `content/fixtures/*.json`; the harness (`VM_HARNESS=1`, set only at server start) is the only source until Epic 7

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/topic-schema/catalog.ts` -- `Catalog` types and pure `buildCatalog(rows, now)`: tree rows (`category`/`subcategory`/`chapter` ids, names, order, count), published topic entries, tombstones; sorted deterministically
- [x] `src/server/catalog.ts` -- `rebuildCatalog(port)`: reads all rows under the port's lock and returns the catalog; Supabase port; the fixture port (harness only) built from `content/fixtures/` plus a fixture tree
- [x] `src/server/catalog-source.ts` -- `getCatalog()` for pages: database when configured, fixtures under `VM_HARNESS=1`, else an empty catalog
- [x] `src/features/library/` -- `TopicCard`, `TreeList`, `ChapterTopics`, `ViewedMark` (client; hand-validated read of `vm.progress.v1`, no Zod)
- [x] `src/app/[locale]/...` -- category, subcategory and chapter pages with names, counts, path links, `generateMetadata`, not-found (the topic page's `hrefs` and `names` wiring moves to Story 5.4, which builds the topic route)
- [x] `src/i18n/messages/{en,ur}.json` -- library strings
- [x] `tests/unit/catalog.test.ts`, `catalog-port.test.ts`, `library-render.test.tsx` -- matrix rows, determinism, hidden topics, stub Supabase port, rendering in both locales, viewed mark
- [x] `tests/e2e/library.spec.ts` -- browse to a chapter in English and Urdu, counts, card links, viewed mark from seeded storage, unknown slug, no scene chunk loaded
- [x] `docs/coding-standard.md`, sprint status, deferred work -- one section; mark story done after review

**Acceptance Criteria:**
- Given published fixture rows, when `rebuildCatalog()` runs twice on shuffled input, then both results match apart from `generatedAt`.
- Given any list, count or link, when a topic is unpublished or deleted, then it is in none of them.
- Given a chapter page, when it renders, then each card shows title, summary, level text, minutes and, only if viewed, "Viewed".
- Given the three tree pages, when opened, then each shows its name and topic count and links down and back up.

## Implementation Notes

- Added migration `0006_catalog_rows.sql` (`catalog_rows()`, one snapshot, service role only), not in the task list: it is how `rebuildCatalog` reads one consistent snapshot and it is tested on PGlite.
- `content/fixtures/tree.json` places the 13 fixture topics in a tree, with `stats-dice` unpublished and `trig-right-triangle` deleted; fixtures load only under `VM_HARNESS=1`.
- Topic cards link to `/{locale}/topic/{id}`, which Story 5.4 builds; until then the link 404s.
- Learned the hard way: the `[locale]` layout's `dynamicParams = false` made every nested tree address 404, even with `true` on the pages. It is removed; unsupported languages (`/fr`) are now answered by `proxy.ts` (rewrite to a path no route matches, so the global 404 shows). Matcher test: `proxy-locales.test.ts`; `session-refresh.test.ts` updated for the third matcher entry. The 404 for a `notFound()` in a page is served as an error shell in the raw HTML and recovers on the client, in dev and in production; the status is 404.
- Not done, by design: thumbnails (`thumb` null), Storage write and revalidation (7.3), topic route (5.4), home (5.2).
- Checks: `npm run check` green (1,723 unit tests); Playwright 558 on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

| Finding (reviewer) | Verdict | Route and evidence |
|---|---|---|
| Card titles h2 under the "Topics" h2 (blind, edge) | medium | patch: cards are h3; unit and e2e updated |
| Dead `treeParams`, unused message keys (blind, gap) | low | patch: removed `treeParams` and its test, `levelBadge`, `categories` |
| Fixture hashes from id length (blind) | low | patch: hash from the id's characters |
| Search words skip languages missing in the title (blind) | low | patch: union of title and summary languages |
| Harness skips not logged (edge) | low | patch: logged like the database branch |
| "Production never bundles fixtures" is wrong (blind, edge) | low | patch: comments and standard reworded; VM_HARNESS pattern guarded by the existing allowlist test, so no extra guard |
| Task "hrefs and names" ticked, not done (gap) | medium | patch: task text moved to Story 5.4 (needs the topic route) |
| `RESERVED_SLUGS` not enforced (all three) | medium | defer: only seeded categories exist before Story 7.5 |
| Proxy rejects future non-locale routes; dotted single segment renders home (blind, edge) | low | defer: list new top-level routes in the matcher; dotted path guard |
| Raw HTML of a 404 is an error shell (blind) | medium | defer: Next behavior in dev and prod, status 404; no-JS and crawler view to check |
| Viewed mark: same-tab refresh, shared store (blind) | low | defer to Story 6.1, which writes the key |
| hreflang, description metadata (blind) | low | defer |
| 150 KB budget, tags, caching, per-render RPC (blind, edge, gap) | medium | defer to Story 7.3, which writes and revalidates the catalog (spec Never) |
| Layer rule, locale not checked in pages, orphan or duplicate rows, null `ur`, one bad row throws, missing version row, `topicsOf` by chapter id, empty title, `usePathname` null, one bad entry discards all marks, no `step`/`p.` test, migration rerun, build fails when DB down, topic route missing | false | each refuted: features may import features; the proxy answers other languages; foreign keys and primary keys forbid orphans, duplicates and a missing version; ids are unique by primary key; the catalog requires an English title; the architecture says discard a bad value whole; links add no keys; migrations run once; a failing database must not be silent; the 5.4 route is a stated non-goal |

## Design Notes

`tree` rows follow AD-20: one row per node, deeper keys null (`{category:'algebra', subcategory:null, chapter:null, ...}`). Tombstones are topics not currently published that have a version with `published_at` set. Fixtures need a tiny tree (`content/fixtures/tree.json`) because the seed has categories only.

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests and build pass
- `npm run test:e2e` -- expected: library spec passes on chrome-111 and edge-111
