---
title: 'Story 5.4: Direct links, prerequisites and what is next'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: '97c48e683464d1a80c7319dbb31d6ae07cf6366c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every card, result and Start button links to `/{locale}/topic/{id}`, which does not exist. The topic page cannot be opened by its address, shows no prerequisites or what to learn next, and cannot be shared.

**Approach:** A real topic route `/{locale}/topic/{id}` that loads the published topic through one `loadTopic(id)` and renders the existing `TopicPage` with real path names and links, the neighbours in its chapter, a "what you need first" box, a "what to learn next" list, and a Share button.

## Boundaries & Constraints

**Always:** A direct link opens the topic with no login, in the link's language (`/ur/topic/x` is Urdu). Only a published, not deleted topic opens (FR-1.9); any other id, and any malformed id, is the friendly not-found page with status 404. `loadTopic(id)` is the single place the topic document is read (AD-19, version 2 gate seam): from the database's published version in production (new migration `0007`, function `published_topic`, service role only, returns the published document of a live topic or null), from the fixtures under `VM_HARNESS=1`, and null with neither. The page is static per locale and reads no cookie, header or `searchParams` on the server; the step and slider values stay in the address and are read in the browser as before. "What you need first" lists the topic's `prerequisites` that are published, each as a link with its title; one that is not published is not listed and not linked; prerequisites never lock a topic (no gate, no disabled state, the topic is fully usable). "What to learn next" lists the topic's `next` that are published; with none listed the page shows the next topic of its chapter as before. Path links carry the real names from the tree. Previous and Next topic are the neighbours within the chapter in reading order. Share (S) copies the topic's own link, `{origin}/{locale}/topic/{id}` with no step or slider values, and a toast says it was copied; if copying is refused the link is shown to copy by hand. Titles and the page `<title>` are in the page's language; both languages for every new word; logical CSS, tokens only, 44 px targets.

**Never:** No topic document, no hash and no prerequisite list from the visitor's side; no write of any kind. No start-of-topic refusal from a re-read `catalog.json` (Story 7.3 writes that file). No new field in the topic format. No viewed-mark writing (6.1). No learning map (5.5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Direct link | `/en/topic/geo-cone-volume`, published | The topic, English, path with names, no login | N/A |
| Shared Urdu link | `/ur/topic/geo-cone-volume?step=2&p.r=3` | Urdu topic at step 2 with the slider restored | Bad `step` or `p.` values ignored as before |
| Not published | Unpublished or deleted id | 404 friendly page, no topic text | N/A |
| Unknown or malformed id | `/en/topic/nope`, `/en/topic/A%20B` | 404 friendly page | N/A |
| Prerequisites | Two listed, one unpublished | Box lists the published one with a link; topic fully usable | N/A |
| No prerequisites | None listed | No box | N/A |
| Next | `next` lists a published and an unpublished topic | Only the published one, as a link | N/A |
| No `next` | Empty | The next topic of the chapter is offered as before | N/A |
| Share | Click Share | Link copied, toast "Link copied" | Clipboard refused: the link is shown |
| Neighbours | Middle topic of a chapter | Previous and Next within the chapter | N/A |

</frozen-after-approval>

## Code Map

- `src/features/topic/TopicPage.tsx` -- takes `hrefs`, `names`, `previous`, `next`; add `prerequisites`, `upNext`, Share; `PathLinks.tsx` path
- `src/app/[locale]/dev/topic/page.tsx` -- harness pattern; keep it
- `src/server/catalog-source.ts`, `fixture-catalog.ts`, `catalog.ts` -- `getCatalog`, fixtures, database port pattern; add `topic-source.ts` with `loadTopic`
- `supabase/migrations/0005_problem_report.sql`, `0006_catalog_rows.sql` -- function and grant style; `tests/unit/catalog-port.test.ts` -- PGlite pattern
- `src/lib/library/index.ts` -- `topicsOf`, `topicById`, `chapterNode`..., `topicHref`, `treeHref`; add the neighbour and link-resolving helpers (pure)
- `src/app/[locale]/[category]/...` -- on-demand static route pattern; `topic` is a reserved slug and a static folder
- `src/i18n/messages/{en,ur}.json` -- `topic` block; `tests/e2e/topic.spec.ts` -- patterns
- Under the harness the built catalog is empty, so topic routes render on demand with the fixtures, as the tree pages do

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0007_published_topic.sql` -- `published_topic(p_id)`, service role only
- [x] `src/server/topic-source.ts` -- `loadTopic(id)`: database, fixtures, none; id checked first
- [x] `src/lib/library/index.ts` -- `neighbours(catalog, id)`, `linksFor(catalog, ids, locale)` (published only), pure
- [x] `src/features/topic/{TopicPage,Prerequisites,ShareButton}.tsx` -- the box, what is next, Share with toast and fallback
- [x] `src/app/[locale]/topic/[id]/page.tsx` -- the route: metadata, static params from the catalog, 404 for anything unpublished
- [x] `src/i18n/messages/{en,ur}.json` -- new words
- [x] `tests/unit/*`, `tests/e2e/topic-link.spec.ts` -- the matrix in both languages, the PGlite function, the 404s, Share
- [x] `docs/coding-standard.md`, sprint status, deferred work

**Acceptance Criteria:**
- Given a direct link, when opened, then the published topic shows with no login in the link's language.
- Given prerequisites, when the page renders, then "what you need first" lists the published ones with links, and the topic is never locked.
- Given the Share button, when pressed, then the topic link is copied and a toast confirms.

## Implementation Notes

- Migration `0007_published_topic.sql` (`published_topic`, service role only) tested on PGlite. `geo-cone-section` and `geo-cone-volume` fixtures gained `prerequisites` and `next` (a published, an unpublished and an unknown id) so the links and their omissions are tested.
- The viewer refusing a topic the re-read `catalog.json` no longer lists waits for Story 7.3, which writes that file.
- No reviewer agents on this story, by the owner's instruction: they run once at the end of Epic 5.
- Checks: `npm run check` green (1,787 unit tests); the topic-link spec passes on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build and static-route check pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
