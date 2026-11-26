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
- Every new table gets row level security and no grants to `anon` or `authenticated`.
- Admin text lives in `src/i18n/messages/admin.en.json` (English only), not in components.

## Rules checked by later stories

- Every route handler calls `requireAdmin()` or `ratelimit()` (Story 1.6).
- Math is rendered only through `renderMath`; `dangerouslySetInnerHTML` only in `MathHtml` (AD-14).

## Process

- Run `npm run check` before every commit: typecheck, lint, unit tests, build.
- Every story has acceptance tests (NFR-6.5). A lint rule has a test that proves it fails on bad code (`tests/unit/lint-rules.test.ts`).
- Secrets live only in Vercel and Supabase. Only the variables in `.env.example` marked `NEXT_PUBLIC_` may reach the browser.
- Node 24 (`.nvmrc`). TypeScript strict. Versions are pinned exactly (`.npmrc` `save-exact`); change one only with a note in the PR.
