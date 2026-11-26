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
