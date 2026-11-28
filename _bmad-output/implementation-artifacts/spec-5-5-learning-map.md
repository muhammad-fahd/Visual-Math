---
title: 'Story 5.5: Learning map (S)'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: '30605571e776bc242369d0fddb9ad03a646b1a7d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A visitor cannot see how topics lead to each other. Prerequisites exist only as a short list on each topic page, and nothing shows what comes before and after across a category.

**Approach:** A static `/{locale}/map` page with one graph per category (chosen by chips): chapters as rows, topics as nodes placed left to right by how many prerequisites come before them, arrows from a prerequisite to the topics that need it, topics from other categories shown as marked outside nodes, and the viewed topics marked. The same map is always also a text list.

## Boundaries & Constraints

**Always:** Built from the catalog only (published topics and their `prerequisites`); a prerequisite that is not published is not drawn and not listed (FR-1.9). One category per view, chosen by chips (`cat` in the address, read in the browser; first category with topics by default); only categories with topics have a chip. Layout is pure and deterministic (`lib/map`): rows are the category's chapters in tree order with topics; a topic's column is one more than its deepest in-category prerequisite (a cycle never loops, its back edge is ignored); topics of other categories that are prerequisites of, or need, a topic here are outside nodes in a last row labelled with their category, linking to their topic. The graph stays left to right in Urdu (diagram, like scenes); the page chrome mirrors. The graph is a picture: hidden from assistive technology and out of the tab order, and the list below it carries everything: per chapter, each topic as a link, with "Needs" and "Leads to" links, the outside ones named with their category, and the viewed mark. A hint says the list is the same map. Topic nodes link to the topic, show title (shortened with the full title in the node's tooltip text), the level as a word and minutes, never color alone; the viewed mark is a check and the word, from this device (same reader as the cards, no network). On a phone the graph scrolls sideways inside its own box and the page does not. Both languages for every word; tokens only, logical CSS, 44 px list targets. A category with no topics, and a topic with no prerequisites or dependents, are handled (a lone node, no arrow). Home gets a "Learning map" link.

**Never:** No dragging, zooming or editing of the graph. No `topic_prerequisite` table (the catalog carries the ids). No new topic field. No writing of progress (6.1). No site navigation bar (not built yet).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chain | A needs nothing, B needs A, C needs B | Columns 0, 1, 2 in the chapter row; arrows A to B and B to C | N/A |
| Two roots one leaf | C needs A and B | A and B in column 0 (stacked), C in column 1, two arrows | N/A |
| Across categories | Topic here needs a topic in another category | Outside node in the last row with its category named, arrow, link | N/A |
| Unpublished prerequisite | Needs a topic that is unpublished or unknown | No node, no arrow, not in the list | N/A |
| Cycle | A needs B and B needs A | Both drawn, no endless loop, one arrow ignored | N/A |
| No prerequisites at all | Category whose topics list none | Every topic in column 0, no arrows | N/A |
| Empty category | No topic | No chip; the page says there are no topics yet | N/A |
| Viewed | `vm.progress.v1` lists a topic | Check on its node and "Viewed" in the list | Invalid value: no marks, no error |
| Keyboard and screen reader | Tab through the page | Graph skipped; the list is complete with Needs and Leads to | N/A |
| Urdu | `/ur/map` | Urdu names and words; graph still left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/library/search.ts` and `src/app/[locale]/search/page.tsx`, `dev/search/page.tsx`, `features/library/SearchScreen.tsx` -- the pattern: pure data in lib, one screen component, static route plus harness page, address state
- `src/lib/library/index.ts` -- `readingOrder`, `topicById`, `linkedTopics`, `categories`, `chapters`; `src/lib/topic-schema/catalog.ts` -- `CatalogTopic.prerequisites`
- `src/features/progress/{read.ts,ViewedMark.tsx}` -- add a shared `useViewedIds` hook and use it in both
- `src/scenes/tokens.ts` -- colour token classes for SVG; DESIGN.md contrast table
- `scripts/check-static-routes.mjs` `PAGES` -- add `map`; `src/app/[locale]/page.tsx`/`HomePage.tsx` -- the Learning map link
- `tests/unit/{search,home}.test.ts`, `tests/e2e/search.spec.ts` -- patterns; `tests/unit/scene-frame-harness.test.ts` -- allowlist
- The built page has no database in tests, so the browser tests use a harness page `/{locale}/dev/map`

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/map/index.ts` -- `layoutMap(catalog, category, locale)`: rows, nodes, edges, outside nodes and the list model, pure
- [x] `src/features/progress/{useViewedIds.ts,ViewedMark.tsx}` -- one hook, used by the marks and the map
- [x] `src/features/map/{MapScreen,MapPage,MapGraph,MapList}.tsx` -- chips, SVG graph, list
- [x] `src/app/[locale]/map/page.tsx`, `dev/map/page.tsx`, `scripts/check-static-routes.mjs` -- static route, harness, `map` in the check
- [x] `src/features/library/HomePage.tsx`, `src/i18n/messages/{en,ur}.json` -- link and words
- [x] `tests/unit/*`, `tests/e2e/map.spec.ts` -- every matrix row, both languages
- [x] `docs/coding-standard.md`, sprint status, deferred work

**Acceptance Criteria:**
- Given a category, when its map shows, then a graph of its chapters and topics shows prerequisites inside and across categories, with viewed topics marked.
- Given keyboard or screen reader use, when the page is read, then a complete list of the same map exists and the picture does not trap focus.

## Implementation Notes

- `ViewedMark` now uses the shared `useViewedIds` hook. Fixtures gained prerequisites: solving needs the balance scale, graphs need solving and Equivalent fractions (another category), the cylinder fill needs the net.
- The graph is out of the tab order and hidden from assistive technology; the list carries the map. `map` is in the static-route check (its unit tests were updated).
- No reviewer agents on this story, by the owner's instruction: they run once at the end of Epic 5, now over all five stories.
- Checks: `npm run check` green (1,810 unit tests); the map spec passes on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build and static-route check pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
