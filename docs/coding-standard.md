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

## Rules checked by later stories

- Every route handler calls `requireAdmin()` or `ratelimit()` (Story 1.6).
- Math is rendered only through `renderMath`; `dangerouslySetInnerHTML` only in `MathHtml` (AD-14).
- Interface text lives in next-intl message files, never in components (Story 1.3).

## Process

- Run `npm run check` before every commit: typecheck, lint, unit tests, build.
- Every story has acceptance tests (NFR-6.5). A lint rule has a test that proves it fails on bad code (`tests/unit/lint-rules.test.ts`).
- Secrets live only in Vercel and Supabase. Only the variables in `.env.example` marked `NEXT_PUBLIC_` may reach the browser.
- Node 24 (`.nvmrc`). TypeScript strict. Versions are pinned exactly (`.npmrc` `save-exact`); change one only with a note in the PR.
