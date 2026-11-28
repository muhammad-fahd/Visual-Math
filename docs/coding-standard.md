# Coding standard

Short rules. Each one is enforced by a check, not by memory. Source of the rules: `_bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/ARCHITECTURE-SPINE.md` (AD numbers below).

## Layers (AD-1)

`src/lib` (pure) <- `src/scenes` <- `src/features` <- `src/app`; `src/server` and `src/db` are server only.

| Layer | May import |
| --- | --- |
| lib | lib |
| scenes | scenes, lib |
| features | features, scenes, lib |
| server | server, lib, db |
| db | db, lib |
| app | app, features, scenes, server, lib |

Enforced by `eslint-plugin-boundaries` (`boundaries/dependencies`), including through the `@/` alias. A client layer never imports `server` or `db`.

## Forbidden in `src/` (lint)

- `eval`, `new Function`, implied eval, and `import()` of a non-literal path (a topic is data and is never executed, AD-1).
- Hex color literals. Use tokens from DESIGN.md (AD-11). Generated files in `src/styles/generated/` are exempt.
- Physical CSS: `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`, `rounded-l`, `rounded-r` and properties `marginLeft`, `paddingRight`, `left`, `right`. Use logical equivalents (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`) so Urdu mirrors (AD-12).

- Literal user-facing text in `.tsx` files: JSX text, string children and the attributes `aria-label`, `title`, `alt`, `placeholder`, `label` must come from message files (`local/no-literal-text`, FR-6.5). Symbols and digits are allowed.
- Every new language: add it to `src/i18n/locales.ts` and add its message file plus one line in `src/i18n/messages/index.ts`. A parity test fails if an English key is missing in another language.

## Admin and the database (AD-8, AD-9, AD-17)

- Admin pages call `requireAdminPage()` in the layout and in the page; admin handlers call `requireAdmin()` first and return its `Response` if it is one. Never trust a client flag.
- Admin writes are Postgres functions that call `record_audit()` in the same transaction. `audit_log` is append-only for every role (`tests/unit/audit-migration.test.ts` runs the migration on PGlite).
- Every new table gets row level security and no grants to `anon` or `authenticated`. `scripts/check-migrations.mjs` (part of `npm run check`) applies every migration on PGlite, in `public` and in a `preview_ci` schema, and fails on a table without RLS, a browser-role grant, policy or executable function, or a view that is not `security_invoker`.
- Migrations are forward-only: never edit an applied one. Write SQL with `public.` qualified names so the check can retarget it to the preview schema.
- Admin text lives in `src/i18n/messages/admin.en.json` (English only), not in components.

## Expressions (AD-3)

- `src/lib/expr/` is the only code that parses or evaluates an expression string: topic formulas, slider ranges, curves, and the typed value beside a slider. Do not add another evaluator, and never `mathjs` or `expr-eval`. `tests/unit/expr-reject.test.ts` also scans the module's own source for `eval`, `new Function`, dynamic import and outside imports.
- Changes to the grammar, whitelist or caps change `topic-format.md` section 3 first, and need updated property tests (`tests/unit/expr-property.test.ts`, AD-27).
- A parsed expression can be re-checked cheaply: `staticCost(expression)` is the worst-case steps and feeds the scene cost of Story 2.2 (E_SCENE_COST above 3,000,000).

## Topics, schema and scenes (AD-2, AD-19, AD-27)

- `src/lib/topic-schema/` is the topic format as code; `topic-format.md` is its contract, and `tests/unit/topic-format-doc.test.ts` diffs the generated field table against it. Change the schema and the document together; the schema wins a disagreement.
- A scene type is one registry entry: its meta (`lib/topic-schema/scenes/meta.ts`, no imports), its schema (`lib/topic-schema/scenes/<type>.ts`), and later its renderers in `src/scenes`. Never edit the topic schema to add a scene type. A `type@v` used by a stored topic is never removed or changed: a contract change is a new `v`.
- The viewer registry (`src/scenes/registry.ts`) imports only `scenes/meta`, so zod and yaml never reach a visitor's browser through it. Keep it so.
- Every author-chosen key is checked: ids that name a function, a constant or `__proto__`/`constructor`/`prototype` are refused, and an own `__proto__` key anywhere is a problem.
- Hashing: `contentHash(doc)` is `sha256:` of `canonicalize(doc)` (NFC, sorted keys, no whitespace). Add golden vectors, never edit one.
- Regexes in parsers must be linear: no lazy `.*?` followed by `\s*$`. `tests/unit/topic-md.test.ts` times a hostile line.

## Scene input (AD-15)

- `src/scenes/frame/` is the only code that listens to the pointer, wheel and keyboard for a scene, and the only place a camera control may be imported. Outside it, `src/scenes` may not import `OrbitControls` and its relatives, `three/examples|addons/controls`, `three-stdlib` or `@use-gesture`, may not call `addEventListener`, assign `on...` properties, or put input handler props on elements (lint). A renderer gets the view from the frame's render prop.
- A scene type's view toggles go through `FrameToggle` (`extraControls`). Every gesture has a button with an icon and a visible word.
- The frame's props are: `title`, `caption`, optional `description`, `camera`, `capabilities`, `extraControls`, `onEscapeFromToolbar`, `onViewChange`, and the render prop. Pass `capabilities` and `camera` as stable values.
- Never call `setTimeout` or `clearTimeout` as a method of another object (a browser throws "Illegal invocation"); wrap them. Never let a hint or label collapse its space when focus moves: a click that moves under the pointer is lost.
- The harness page (`VM_HARNESS=1`) is for the browser tests only (docs/environments.md).

## Solids, tiers and live formulas (AD-13, AD-14, Story 2.4)

- A solid is data in `src/lib/solid/` (vertices, faces, edges, labelled dimensions, exact volume and area, projection). Tier A (`src/scenes/solid3d/Solid3D.tsx`, three.js) and Tier B and C (`Solid2D.tsx`, SVG) read the same geometry and the same projection, so they cannot disagree. A new solid kind is one entry in `kinds.ts` with a known-value test for its volume and area.
- three.js and react-three-fiber come in only through the `next/dynamic` import of `Solid3D` in `src/features/scene/SolidViewer.tsx`. Do not export `Solid3D` from an index, and do not import it anywhere else: `scripts/check-bundle.mjs` fails above 450 KB gzip for the chunk that carries `WebGLRenderer`, and the browser tests fail if a page without a 3D picture downloads it.
- Tier A is chosen after mount (a device's WebGL is unknown on the server). B is remembered in `localStorage` key `vm.tier`; C is for no WebGL 2 or a lost context. Anything that listens to the canvas (`webglcontextlost`) lives in `features`, attached the moment the canvas exists.
- Colors in three.js are read from the CSS tokens (`--vm-color-*`) and re-read when `data-theme` changes; never write a color in a scene.
- Every number on the page comes from `createProgram` (parameters, then `derived`, then one expression): a value that cannot be computed is NaN and is shown as a dash or "undefined", never an error. A typed value goes through `checkTyped`, a slider through `snap`.
- Formulas: `fillFormula` (placeholders take only a plain number, a real minus, `\text{undefined}` or a dash), then `renderMath` (one frozen options object), then `MathHtml` (the only `dangerouslySetInnerHTML` of math; `tests/unit/inner-html.test.ts` keeps that list). The LaTeX command allowlist is an upload-stage check (Story 7.1).
- Labels are written beside their line, away from the solid, and radii run along x so the front view shows them at full length.

## Cross-section, net and fill (FR-3.10 to 3.12, Story 2.5)

- `lib/solid/layers.ts` (`compose`) is the one place that decides what a solid scene is made of at a moment: the solid or its net, the cutting plane and cut face, the liquid. Both renderers draw those layers; a renderer never decides geometry. A color is a token on the layer (`fill`, `section`, `curve1`), never a value.
- The net is a hinge tree over the solid's real faces (`panels` in `kinds.ts`); `netPose` turns each child about its hinge by `progress` times the angle that lays it flat. A new kind with a net needs its `panels`, its exact `netParts`, and passes the net tests (folded is the solid, flat is one plane, no overlap, parts add up to the surface area).
- A cut is the plane's intersection with the convex mesh (`clipBelow`); the shape name comes from the polygon (`section.ts`). Offsets are measured from the centre of the solid. A curved cut is named only for curved solids.
- Play animates the parameter a field names, only when the field is a bare parameter id (`play` in `SolidViewer`); an expression has no Play. `requestAnimationFrame` lives in `features`, never in `src/scenes`. Reduced motion (read at start and at each press) starts at the finished state and jumps instead of animating.
- A section or a fill makes the solid see-through (`glass`), otherwise the cut and the liquid would be hidden.
- To build beside a running `next dev`, use a second build folder: `NEXT_DIST_DIR=.next-e2e npm run build`, then the same variable for `playwright test`. Building into `.next` while `next dev` runs breaks the dev server ("unexpected Turbopack error").

## The topic page (FR-2.1 to 2.3, FR-4, UX-DR7, Story 2.6)

- `src/features/topic/TopicPage.tsx` is the page; routes only pass it a validated topic, the tree names, the hrefs and the neighbours (Epics 5 and 7). Until then `/[locale]/dev/topic` (`VM_HARNESS=1`) shows the fixtures.
- The layout is CSS only and uses logical properties, so Urdu mirrors by itself. Phone: one column in the order picture, sliders, cut and parts, step, results, formulas (`order-*`, wrappers are `contents`); the picture is `sticky` and at most `--vm-space-scene-ratio-phone` high. It un-sticks by media queries in `rem` (`max-height: 40rem`, so a larger text size un-sticks it) and below `22.5rem` wide; "Back to picture" links to `#scene`. Laptop: `lg:grid-cols-3`, the picture two thirds.
- A step is advice, not a gate. `sceneAtStep` rebuilds the scene at step N from step 1 (Back is exact); `enterStep` applies it only to parameters the visitor has not touched (`useNumberFields` records a slider, a typed value or a choice as touched; code and Play do not). The first step is applied in the initial state, so server and client agree.
- Prose is tokens, never HTML: `tokenize` knows `**bold**` and `{{term:id}}` only; `fillText` and `fillFormula` take only formatted numbers. Next and Back are `aria-disabled` at the ends, not `disabled`, so a press never drops focus; the new step title is said once, politely.
- The wheel zooms a picture only with focus, Ctrl or full screen (`SceneFrame`); otherwise it scrolls the page, so the picture is never a scroll trap.

- Place in the address (AD-6, FR-2.7, Story 2.8): `parseUrlState` (`lib/params/url`) reads only `step` and `p.<id>`; it is hostile-input safe (first of a repeated key, one finite number in either digit set, clamped and snapped, unknown and inherited names dropped, 2000-character cap, no prototype) and fuzzed. It is read on the client after mount, never on the server. `mergeUrlState` writes back only what the visitor changed (and the step) with `history.replaceState`, leaving every other key and the hash alone, so the language switcher (which carries query and hash) keeps the place. Values from the address are restored as touched, so a step does not override them; `resetAll` clears them.
- Reset all is a counter (`resetSeq`) that the viewer, the frame and the worked example react to; the page does not reach into their state. An effect that applies values must run after the step effect (the address wins over a step), and a queued animation frame is cancelled by `playId`, not only by cleanup.
- Marked terms: `TermProvider` is one native modal sheet for the page; `RichText` turns a defined `{{term:id}}` into a button, an undefined one into nothing. Everything beside the sticky picture that the visitor presses (Play, the cut, the parts) is in the right column; anything below a sticky element in the same column is hidden by it.

## Visitor submissions (FR-2.4, Story 2.7; later the contact form)

- Visitor text is cleaned on the server by `lib/report` (`cleanNote`): NFC, control and format characters removed (the Urdu joiners kept), spaces collapsed, then counted in characters. The browser only counts. It is stored and shown as text, never as HTML, in the admin under the stricter CSP.
- A public route limits first and validates second, with a strict Zod body; the database is reached only through a `security definer` function granted to `service_role`. Repeats are grouped by a key in the database, not in the handler, so two sends at the same moment cannot make two rows.
- A sheet over the page is a native modal `<dialog>` (`showModal()`): the browser gives the focus trap, Esc and the inert page. A failure never clears what the visitor typed.

## Handlers, rate limits, logs and the bundle (AD-9, AD-26, AD-28)

- Every `src/app/api/**/route.ts` handler calls `requireAdmin()` or `ratelimit()`; lint fails otherwise (`local/require-handler-guard`). Put `ratelimit()` first: `const limited = await ratelimit(request, { name, limit, windowSeconds }); if (limited) return limited;`. It is the only limiter in app code; the key is a salted daily hash, never the address.
- Errors go to `/api/log` and `recordError()`, which scrub first. Do not log request bodies, headers, cookies or addresses. `guarded()` prints the request id and the error class only.
- The CSP is built in `src/lib/security/csp.ts`. Never add a hash or nonce to `script-src`, never a third-party origin. A new admin-only relaxation needs the same review as `img-src data:`.
- `scripts/check-bundle.mjs` (in `npm run check`, after the build) fails on a service-role key, `eval` or `new Function` in the client bundle. A vendor exception goes in its `ALLOWED` list with the exact context and a reason.

## Scene viewers (Story 3.1)

A scene type is one registry entry in `lib/topic-schema/scenes`, one pure renderer in `scenes/<type>`, and one line in `features/scene/viewers.tsx`. A viewer takes its parameters, steps, address and Reset all from `useSceneState`. Pointer code lives only in `scenes/frame` and in feature-layer handles that stop the event and have a keyboard form. Curves differ by dash and marker as well as color.

Geometry shapes (Story 3.2) name `point` elements by id, so the one drag mechanism moves every shape built on them. A measure (length, angle in degrees, perimeter, area) is a pure function in `lib/graph/geometry`, drawn beside the shape and listed as text; a transform image is dashed and never draggable.

Number and fraction models (Story 3.3) are `number-model@1`: `lib/numbermodel` lays the picture out as prims, controls and sentences. Drag and drop is a control with discrete positions: the pointer picks the nearest, the keyboard the next, and the value is written to the parameter the field is exactly bound to. A step's `hide` is cumulative, so a later step must `show` a part an earlier one hid.

Algebra tools (Story 3.4) are `algebra-tool@1` with one `tool: {kind, ...}`; every move is a parameter. The balance scale, tiles and machine are prims drawn by the shared `NumberModel` renderer; the step solver is HTML. A scene type may register a `check` (stage S5) that runs after the schema passes: the solver's evaluates each line at its solution and a false line is E_SOLVER_LINE.

Trigonometry (Story 3.5): `unit-circle@1` and `right-triangle@1` are laid out by `lib/trig` as prims for the shared renderer (a `path` prim draws the wave). The unit circle's point is dragged by `AngleHandle`: the pointer's direction about the centre is the angle, snapped to special angles near them. Values shown are computed (4 decimals) with exact forms at multiples of 30 and 45 degrees; a tangent at a pole is "undefined", never a number.

Statistics (Story 3.6): `stats@1` is laid out by `lib/stats` as prims for the shared renderer (a `poly` prim fills a shaded area). Chance is `mulberry32` from an integer `seed`, never `Math.random`; a longer run extends a shorter one. Quartiles are the medians of the halves (middle value left out when n is odd), outliers lie 1.5 IQR beyond a quartile, and probabilities come from `normcdf`, `normpdf` and `binompmf` in `lib/expr`.

Static pictures (Epic 3 goal): `static2D` in `src/features/scene/static2d.tsx` draws any scene type at its start values as a pure React element (no `'use client'`, no hook, no browser API), from the same `lib` layouts and `src/scenes` renderers as the viewer, so a thumbnail is the picture the visitor first sees. A new scene type is one case there and one line in `viewers.tsx`; `tests/unit/static2d.test.ts` fails when the lists drift from the scene registry.

## Catalog and tree pages (AD-20, FR-1.2, 1.3, 1.9, Story 5.1)

- The catalog is built whole from rows, never patched: `buildCatalog` in `lib/topic-schema/catalog.ts` is pure (rows in, catalog out, same bytes except `generatedAt`); `rebuildCatalog(port)` in `server/catalog.ts` reads the rows through a port. The database port is one call to `catalog_rows()` (migration 0006), so the catalog is one snapshot; Story 7.3 calls `rebuildCatalog` and writes the result to Storage.
- Only a topic with `published_hash` set and `deleted_at` null is in a list, a count or a link (FR-1.9). One published once and not now is a tombstone. A published topic the catalog cannot describe is left out and named in `skipped`, never guessed.
- Pages read the catalog only through `getCatalog()` (`server/catalog-source.ts`): the database when configured, the fixtures only under `VM_HARNESS=1`, else empty; a configured database that fails is an error. The fixture rows are loaded by a literal dynamic import only under the flag: they sit in the server build, but nothing runs them without it.
- Addresses (owner decision): `/{locale}/{category}/{subcategory}/{chapter}` for the tree and `/{locale}/topic/{id}` for a topic, built only by `treeHref` and `topicHref` in `lib/library`. The words in `RESERVED_SLUGS` are never a category slug: `buildCatalog` leaves such a category (and its topics) out and names it in `skipped`.
- The `[locale]` layout leaves `dynamicParams` on, so a tree address added after the build renders on demand (AD-10); a `false` there would 404 every such address. An address in a language that does not exist (`/fr/...`) is answered by `proxy.ts`, which rewrites it to a path no route matches, so the global 404 shows; `tests/unit/proxy-locales.test.ts` keeps the matcher equal to `LOCALES`.
- The viewed mark is client-side: `features/progress/read.ts` is the one place that names `vm.progress.v1`; it validates by hand (no Zod in the browser) and throws a bad value away whole. Server and first client render show no mark, so the page is the same static HTML for everyone.

## Home and the nothing-found page (FR-1.1, FR-1.10, Story 5.2)

- `HomePage` takes the catalog as a prop and is static per locale; the route passes `getCatalog()`. The built home is prerendered without a database, so browser tests use the harness page `/{locale}/dev/home` (same component, fixture catalog, `?empty=1` for no topic).
- Featured topics and Start are derived, never stored: `featuredTopics` (up to 6, one per category in tree order, Foundation first) and `startTopic` (first Foundation topic in reading order), both built on `readingOrder`, in `lib/library`. A real featured flag waits for the admin tools.
- The search box is a plain `GET` form to `/{locale}/search?q=` with a required field, so it works without JavaScript; the results page is Story 5.3.
- `NothingFound` is the one friendly page for a link or search that finds nothing: a search box, the categories and a way home. An unsupported language is still the global 404 from `proxy.ts`.
- Nothing on Home or in the nothing-found page may mention an account, login or password; `tests/unit/home.test.ts` checks both languages.

## Search and filters (AD-21, FR-1.4, 1.5, Story 5.3)

- `normalizeSearch` in `lib/text` is the one normalization: it builds the catalog's `searchTokens` and reads what a visitor types, so they always agree (Arabic yeh and kaf folded to the Persian forms, diacritics, tatweel and ZWNJ dropped, Eastern digits to Western, Latin accents stripped, case-folded). Never fold text anywhere else.
- `searchTopics` in `lib/library/search.ts` is pure: every query word must be part of a topic's words, topics with every word in the title first, then reading order; filters narrow by category and level; a blank query matches all. `buildSearchData` reduces the catalog to what the page needs, per language.
- `/{locale}/search` is a static page that carries that data; the browser does the matching, runs it on Enter or after a 400 ms pause, makes no request, and keeps `q`, `cat` and `level` in the address (`parseSearchAddress`, `formatSearchAddress`), read safely. The server never reads the query. `search` is in the static-route check.
- Result links set `prefetch={false}`: a long list must not fetch every topic page it shows.
- Browser tests use the harness page `/{locale}/dev/search` (same `SearchScreen`, fixture catalog), because the built page has no database.

## Direct links, prerequisites and sharing (FR-1.6, 1.8, 1.9, 1.11, Story 5.4)

- `/{locale}/topic/{id}` is the one address of a topic. `loadTopic(id)` in `server/topic-source.ts` is the only place a visitor's topic document is read (a version 2 gate attaches there): the database's published version through `published_topic()` (migration 0007), the fixtures under `VM_HARNESS=1`, null with neither. An id is checked with `isTopicId` before anything is read; anything unpublished, deleted, unknown or malformed is the friendly 404.
- Prerequisites and "what to learn next" are links to published topics only (`linkedTopics`), in the order the topic lists them. A prerequisite is a suggestion: never a gate, never a disabled state.
- Previous and Next topic are the neighbours within the chapter (`chapterNeighbours`).
- Share copies `{origin}/{locale}/topic/{id}` without the step or slider values and confirms in a polite toast; if copying is refused the link is shown to copy by hand. It sends nothing.
- The built catalog has no database in tests, so topic routes render on demand with the fixtures under the harness, like the tree pages.

## The learning map (FR-1.7, Story 5.5)

- `layoutMap` in `lib/map` is pure and deterministic: chapters are rows in tree order, a topic's column is one more than its deepest prerequisite in the category (a cycle's closing edge is ignored, so it cannot loop), arrows run from a prerequisite to the topic that needs it, and topics of other categories that touch the category are outside nodes in a last row. A prerequisite that is not published is never drawn or listed (FR-1.9). The same layout also gives the list.
- `/{locale}/map` is a static page that carries every category's layout; the category is the `cat` in the address, read in the browser, unknown values ignored. `map` is in the static-route check.
- The graph is a picture: `aria-hidden`, its links `tabIndex={-1}`, and it scrolls sideways inside its own box on a phone. The list beside it is the full map for keyboard and screen reader use; keep the two in step. The picture stays left to right in Urdu; the words inside a node follow their own direction. Level is a word in each node, and a viewed topic has a check, never color alone.
- `useViewedIds` in `features/progress` is the one hook that reads the device's viewed topics (cards, search results, map).
- Browser tests use the harness page `/{locale}/dev/map` (same `MapScreen`, fixture catalog).

## Rules checked by later stories
- Math is rendered only through `renderMath`; `dangerouslySetInnerHTML` only in `MathHtml` (AD-14).

## Process

- Run `npm run check` before every commit: typecheck, lint, unit tests, build.
- Every story has acceptance tests (NFR-6.5). A lint rule has a test that proves it fails on bad code (`tests/unit/lint-rules.test.ts`).
- Secrets live only in Vercel and Supabase. Only the variables in `.env.example` marked `NEXT_PUBLIC_` may reach the browser.
- Node 24 (`.nvmrc`). TypeScript strict. Versions are pinned exactly (`.npmrc` `save-exact`); change one only with a note in the PR.
