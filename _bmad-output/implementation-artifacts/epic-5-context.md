# Epic 5 Context: Math tree, search and learning map

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Visitors can find and move through topics: browse the math tree (category, subcategory, chapter, topic), land on a home page, search and filter, follow direct links with prerequisites and "what is next", and see a learning map. Topic content and the publish flow arrive in Epic 7, so this epic runs on fixtures and a database-built catalog that Epic 7 reuses unchanged.

## Stories

- Story 5.1: Catalog and tree pages
- Story 5.2: Home page and the not-found page
- Story 5.3: Search and filters
- Story 5.4: Direct links, prerequisites and what is next
- Story 5.5: Learning map (S)

## Requirements & Constraints

- The tree is category, subcategory, chapter and topic; every level shows its name and the number of topics inside. A chapter lists topic cards with title, summary, level and a viewed mark.
- An unpublished or deleted topic appears in no list, no search and no link.
- Visitor pages work in English and Urdu (right-to-left, logical CSS only), need no login, and meet WCAG 2.2 AA with keyboard and screen reader use. Touch targets 44 px.
- A page becomes usable within 3 seconds on a mid-range phone; the catalog is at most 150 KB gzip per file; no third-party scripts, fonts or analytics.

## Technical Decisions

- `catalog.json` is generated, never patched: `rebuildCatalog()` reads all rows from Postgres and builds `{version, generatedAt, tree: [{category, subcategory, chapter, name {en, ur}, order, count}], topics: [{id, hash, path, chapterOrder, level, estimatedMinutes, title, summary, prerequisites, next, searchTokens, thumb}], tombstones}`. Its type lives in `lib/topic-schema/catalog.ts` and is versioned. Story 7.3 reuses `rebuildCatalog()` for publish and unpublish.
- Tree tables: `category`, `subcategory`, `chapter` (slug ids, names in both languages, `position`), `topic` (`chapter_id`, `level`, `chapter_order`, `published_hash`, `deleted_at`) and immutable `topic_version` rows holding the validated document. A topic is published only when `published_hash` is set; a deleted topic is never published. The twelve categories are seeded.
- Home, category, chapter, topic, search and map pages are static per locale under `/en` and `/ur` with `generateStaticParams`, never read cookies, headers or `searchParams` on the server, and are revalidated by the tags `topic:{id}` and `catalog` through one helper. URL state is client-only.
- The viewed mark and filters are client features: progress lives in `localStorage` key `vm.progress.v1`, read only by `features/progress` (Epic 6). Server-rendered lists must not depend on it.
- Layers: `lib` imports nothing from the repo; `features` may import `scenes` and `lib`; database access stays in `src/db` and `src/server`. Search folds Urdu letter forms and digits in one `lib/text` function.
- Links built here must pass a topic's `step` and `p.` address keys through unchanged and use the app's locale-aware link.

## UX & Interaction Patterns

- Quiet Study design is fixed (DESIGN.md tokens only). Cards show title, summary and level with a text label, not color alone. A friendly page, with a way back, replaces an empty result.

## Cross-Story Dependencies

- 5.1 produces the catalog and tree pages that 5.2 (home), 5.3 (search over `searchTokens`), 5.4 (prerequisites and next from the catalog) and 5.5 (map from the prerequisite table) build on.
- Epic 6 supplies the viewed marks; Epic 7 supplies real published topics and calls `rebuildCatalog()`.
