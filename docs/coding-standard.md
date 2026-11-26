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

## Visitor submissions (FR-2.4, Story 2.7; later the contact form)

- Visitor text is cleaned on the server by `lib/report` (`cleanNote`): NFC, control and format characters removed (the Urdu joiners kept), spaces collapsed, then counted in characters. The browser only counts. It is stored and shown as text, never as HTML, in the admin under the stricter CSP.
- A public route limits first and validates second, with a strict Zod body; the database is reached only through a `security definer` function granted to `service_role`. Repeats are grouped by a key in the database, not in the handler, so two sends at the same moment cannot make two rows.
- A sheet over the page is a native modal `<dialog>` (`showModal()`): the browser gives the focus trap, Esc and the inert page. A failure never clears what the visitor typed.

## Handlers, rate limits, logs and the bundle (AD-9, AD-26, AD-28)

- Every `src/app/api/**/route.ts` handler calls `requireAdmin()` or `ratelimit()`; lint fails otherwise (`local/require-handler-guard`). Put `ratelimit()` first: `const limited = await ratelimit(request, { name, limit, windowSeconds }); if (limited) return limited;`. It is the only limiter in app code; the key is a salted daily hash, never the address.
- Errors go to `/api/log` and `recordError()`, which scrub first. Do not log request bodies, headers, cookies or addresses. `guarded()` prints the request id and the error class only.
- The CSP is built in `src/lib/security/csp.ts`. Never add a hash or nonce to `script-src`, never a third-party origin. A new admin-only relaxation needs the same review as `img-src data:`.
- `scripts/check-bundle.mjs` (in `npm run check`, after the build) fails on a service-role key, `eval` or `new Function` in the client bundle. A vendor exception goes in its `ALLOWED` list with the exact context and a reason.

## Rules checked by later stories
- Math is rendered only through `renderMath`; `dangerouslySetInnerHTML` only in `MathHtml` (AD-14).

## Process

- Run `npm run check` before every commit: typecheck, lint, unit tests, build.
- Every story has acceptance tests (NFR-6.5). A lint rule has a test that proves it fails on bad code (`tests/unit/lint-rules.test.ts`).
- Secrets live only in Vercel and Supabase. Only the variables in `.env.example` marked `NEXT_PUBLIC_` may reach the browser.
- Node 24 (`.nvmrc`). TypeScript strict. Versions are pinned exactly (`.npmrc` `save-exact`); change one only with a note in the PR.
