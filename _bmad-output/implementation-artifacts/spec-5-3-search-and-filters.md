---
title: 'Story 5.3: Search and filters'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'ffa56e0fa140f4006f167aed50bca3514df515db'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The search box on Home and on the nothing-found page sends visitors to `/{locale}/search`, which does not exist. Nothing finds a topic by name, and Urdu text with alternate letter forms or digits would miss.

**Approach:** One pure `normalizeSearch` in `lib/text` and a pure `searchTopics` in `lib/library`, a static `/{locale}/search` page that carries the published topics' search data and runs the query in the browser, with category and level filters, and "Clear filters". The catalog's search words are built with the same `normalizeSearch`.

## Boundaries & Constraints

**Always:** Search is client-side over the catalog's `searchTokens` for the current language (title, summary, tags); no server search, no network call per keystroke. Every query word must appear (as a part of a word) in a topic's search words. Order: topics whose title holds every word first, then the rest, each in reading order. A result shows title, summary, level, minutes, the viewed mark and its category path (category, subcategory, chapter names). The count is announced in a live region ("12 topics found"), search runs on Enter or after a 400 ms pause, and answers well under a second. The page is static per locale and reads no cookie, header or `searchParams` on the server; the query and filters live in the address (`q`, `cat`, `level`, comma separated) and are read in the browser, so Back and a shared link restore them. Only published topics are in the data (FR-1.9). `normalizeSearch`: fold U+064A to U+06CC and U+0643 to U+06A9, drop Arabic diacritics, tatweel and ZWNJ, map Eastern digits (U+0660 to 0669, U+06F0 to 06F9) to Western, strip Latin accents, case-fold, collapse spaces. Filters: chips for category and level, multi-select within a group, a check when on, "Clear filters" resets both and keeps the text. A search with no result shows the friendly nothing-found block (search box, categories, way home), in place and not as a 404. English and Urdu for every word; logical CSS, tokens only, 44 px targets.

**Never:** No ranking beyond the order above, no typo tolerance, no suggestions, no history, no server route. No learning map (5.5). No new topic or catalog field.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Name match | `cone` | Topics with "cone" in title first, then summary or tags matches; each with category path | N/A |
| All words | `cone volume` | Only topics holding both words | N/A |
| Urdu letter forms | Query typed with Arabic yeh or kaf, or Eastern digits | Matches the same topics as the Persian forms and Western digits | N/A |
| Diacritics and case | `CÔNE`, Urdu with marks | Matches the plain form | N/A |
| Empty or blank query | `q` missing or spaces | Shows all published topics (so filters work alone), with the count | N/A |
| Nothing found | `zzzz` | Friendly block with search box, categories and Home; count says 0 | N/A |
| Filters | `level=foundation&cat=geometry` | Only Foundation topics of Geometry; chips show a check | Unknown id in the address is ignored |
| Clear filters | Filters on, text "cone" | Filters off, text stays | N/A |
| Hidden topic | Unpublished or deleted topic | In no result | N/A |
| Address | `/en/search?q=cone&level=foundation` opened directly | Query, results and chips restored | Bad or repeated params are read safely |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/catalog.ts` -- `tokensOf` builds `searchTokens`; switch it to `normalizeSearch`
- `src/lib/text/index.ts` -- add `search.ts` here; `src/lib/library/index.ts` -- `readingOrder`, `loc`, `treeHref`; add `searchTopics` and the address (de)coding
- `src/features/library/{SearchBox,NothingFound,TopicCard,TreeList}.tsx` -- the box already submits `q`; reuse the cards, add an optional path line
- `src/features/progress/ViewedMark.tsx` -- reused by the cards
- `src/app/[locale]/page.tsx`, `[category]/page.tsx` -- static page pattern; `search` is a reserved slug and a static folder wins over `[category]`
- `scripts/check-static-routes.mjs` `PAGES` -- add `search`; `tests/unit/{i18n,home,catalog}.test.ts`, `tests/e2e/home.spec.ts` -- patterns
- Client component using `useSearchParams` sits in a `Suspense` so the page stays static; zod stays out of the browser bundle

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/text/search.ts` -- `normalizeSearch`, exported from `lib/text`
- [x] `src/lib/topic-schema/catalog.ts` -- build `searchTokens` with it
- [x] `src/lib/library/search.ts` -- `searchTopics(catalog data, query, filters, locale)` and `parseSearchAddress` / `formatSearchAddress`, pure
- [x] `src/features/library/SearchPage.tsx` (client), `ResultCard` path line, `NoResults` -- field, chips, Clear filters, live count, 400 ms pause, address sync
- [x] `src/app/[locale]/search/page.tsx`, `scripts/check-static-routes.mjs` -- static page passing a minimal index (id, title, summary, level, minutes, path ids and names, tokens) from `getCatalog()`
- [x] `src/i18n/messages/{en,ur}.json` -- search words
- [x] `tests/unit/*`, `tests/e2e/search.spec.ts` -- every matrix row in both languages, address restore, no network call per keystroke, Urdu folds
- [x] `docs/coding-standard.md`, sprint status, deferred work

**Acceptance Criteria:**
- Given a current-language query, when results show, then they match names, summaries and tags, include the category path, and appear in under a second.
- Given Urdu queries with alternate letter forms or digits, when they run, then the same topics match as with the plain forms.
- Given filters, when set and cleared, then results narrow by category and level and "Clear filters" resets them.

## Implementation Notes

- Added `SearchScreen` (shared by the route and the harness page `/{locale}/dev/search`, in the VM_HARNESS allowlist test) and `SearchResults` (also the no-JavaScript fallback listing every topic). A chip click also takes the text typed so far; results do not prefetch.
- `check-static-routes.mjs` now lists `search`; its unit tests were updated.
- No reviewer agents on this story, by the owner's instruction: they run once at the end of Epic 5.
- Checks: `npm run check` green (1,769 unit tests); the search spec passes on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build and static-route check pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
