---
title: 'Story 5.2: Home page and the not-found page'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'b8e2daaa0d9119e7e8345e4770beae3c48bb1cf4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The home page is a title and two toggles. A visitor cannot see what Visual Math is, find a category, or start. A link that finds nothing ends on a plain page with no search and no list.

**Approach:** A `HomePage` component that takes the catalog: a three-line explanation, a search box, the 12 categories with topic counts, featured topics, and Start. One shared friendly "nothing found" block, used by the locale not-found page (with a search box and the categories) and later by search (Story 5.3).

## Boundaries & Constraints

**Always:** Static per locale, no cookie, header or `searchParams` on the server; no login or account wording anywhere. Logical CSS, tokens only, 44 px targets, one `h1`, headings in order. Both languages for every new word. The categories come from the catalog tree, topic counts included (published only, FR-1.9). Owner decisions: **featured topics are derived**, up to 6 published topics, one per category in tree order (a category with none is skipped), the Foundation topic first within a category, then by chapter order, no new data field; **Start opens the first published topic** (first Foundation topic in tree order, else the first topic), which is `topicHref`, and with no published topic Start is replaced by a line saying topics are coming. The search box is a plain `GET` form to `/{locale}/search` with field `q` (the page is Story 5.3); it works without JavaScript.

**Never:** No search page, no filtering, no live search (5.3). No topic route (5.4). No viewed-based "Continue" button (6.2). No new catalog or topic field. No images or thumbnails (7.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full catalog | 12 categories, topics in 5 of them | 12 categories with counts, featured: 5 topics, one per category with topics, Start to the first Foundation topic | N/A |
| More than 6 categories with topics | 9 categories have topics | Featured is the first 6 in tree order | N/A |
| Empty catalog | No published topic | Categories listed with zero counts, no featured block, Start replaced by "topics are coming", no error | N/A |
| Hidden topic | The only topic of a category is unpublished | That category has count 0 and no featured card | N/A |
| Category with only Intermediate topics | No Foundation | Featured is its first topic by chapter order | N/A |
| Urdu | `/ur` | Urdu text, right to left, Urdu names, links in `/ur` | Missing Urdu name falls back to English |
| Search box | Visitor types text and presses Enter | `GET /{locale}/search?q=text`, works with no JavaScript | Empty text is not submitted (the field is required) |
| Not found | Link to a missing page, in either language | Status 404, friendly heading, search box, the categories, a link Home | An unsupported language keeps the global 404 |

</frozen-after-approval>

## Code Map

- `src/app/[locale]/page.tsx` -- the home route; reads `getCatalog()`, renders `HomePage`
- `src/app/[locale]/dev/topic/page.tsx`, `src/server/fixture-catalog.ts` -- harness pattern; fixture catalog under `VM_HARNESS=1`
- `src/features/library/{TopicCard,TreeList,LibraryPage,BackLink}.tsx` -- reuse for featured cards and the category list; `src/app/[locale]/not-found.tsx` -- widen
- `src/lib/library/index.ts` -- catalog lookups and `treeHref`, `topicHref`; add `featuredTopics` and `startTopic` here (pure)
- `src/i18n/messages/{en,ur}.json` -- `home` block; `tests/e2e/home.spec.ts`, `tests/unit/{catalog,library-render}.test.ts` -- patterns
- The built home is prerendered without a database, so the real `/en` shows an empty catalog in tests; the harness page `/{locale}/dev/home` renders the same component with the fixture catalog

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/library/index.ts` -- `featuredTopics(catalog, 6)` and `startTopic(catalog)`, pure and deterministic
- [x] `src/features/library/{HomePage,SearchBox,NothingFound}.tsx` -- the home layout, the GET search form, the shared friendly block with search, categories and a way home
- [x] `src/app/[locale]/page.tsx`, `src/app/[locale]/dev/home/page.tsx` -- real route and fixture harness
- [x] `src/app/[locale]/not-found.tsx` -- use `NothingFound` (the tree-address case keeps its back link)
- [x] `src/i18n/messages/{en,ur}.json` -- home and nothing-found words
- [x] `tests/unit/*`, `tests/e2e/home.spec.ts` -- matrix rows in both languages, the form without JavaScript, no login wording, one `h1`
- [x] `docs/coding-standard.md`, sprint status, deferred work -- one section

**Acceptance Criteria:**
- Given Home, when it renders, then it explains Visual Math in three lines and shows the search box, the 12 categories, featured topics and Start, and no account or login wording.
- Given a link that finds nothing, when it opens, then a friendly page with a way back appears with status 404.
- Given the same catalog, when the home page is built twice, then featured topics and Start are identical.

## Implementation Notes

- Added `readingOrder` as the shared base of `featuredTopics` and `startTopic`; the harness page is `src/app/[locale]/dev/home/page.tsx` (added to the VM_HARNESS allowlist test).
- The real `/en` is prerendered with no database, so its categories list is empty in a test build; production builds with the database and shows the 12.
- The search box submits to `/{locale}/search`, a route Story 5.3 builds; until then it leads to the friendly not-found page, which now has its own search box.
- Start and the featured cards link to `/{locale}/topic/{id}`, which Story 5.4 builds; until then they lead to the not-found page.
- Checks: `npm run check` green (1,741 unit tests); the home spec passes on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

| Finding (reviewer) | Verdict | Route and evidence |
|---|---|---|
| Whitespace-only search is sent (blind, edge) | medium | patch: `pattern` on the field; unit and e2e tests |
| `featuredTopics` with limit 0 or negative (edge) | low | patch: guard and `>=` |
| Not-found page fails when the catalog read fails (blind, edge) | medium | patch: falls back to no categories |
| Fragile keyboard e2e test (blind, edge) | low | patch: loops until the category is focused, named checks |
| `?empty` given twice (edge) | low | patch: `flat().includes` |
| Start dead until 5.4 not stated; `readingOrder` missing in the standard (blind) | low | patch: notes and standard |
| English fallback text in an Urdu page has no `lang` (blind) | medium | defer: also true of the 5.1 cards |
| Home built with no database shows an empty catalog; no tags, no revalidation (blind) | medium | already deferred to Story 7.3 |
| Search leads to a missing route until 5.3; route and not-found wiring barely tested; Start e2e only checks the href (blind, edge) | low | rejected: stated in the spec, 5.2 and 5.3 ship together, the route is three lines |
| Home throws when the catalog fails (edge); `readingOrder` keyed by chapter slug (edge); Foundation chosen over chapter order (edge); placeholder as only hint (blind); status mismatch, "deferred work" task, Firefox and WebKit coverage (blind); no-login regexes differ (blind) | false or low | refuted: a failing database must not be silent (5.1 decision); chapter ids are unique by primary key; Foundation first is the owner's decision; the label exists; sprint status is set at done; the matrix is the Chrome and Edge set; the unit test is the full check |

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests and build pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
