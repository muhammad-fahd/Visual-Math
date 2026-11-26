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
