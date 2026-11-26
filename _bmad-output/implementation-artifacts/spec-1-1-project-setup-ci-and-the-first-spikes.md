---
title: 'Story 1.1: Project setup, CI and the first spikes'
type: 'chore'
created: '2026-11-26'
status: 'done'
baseline_commit: '1bf76da126564748c0f232d674e8989cee861f56'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository holds only planning files. No code, pipeline or standards exist, so no later story has a place to land or a check to pass.

**Approach:** Scaffold the Next.js 16.4 / TypeScript project in the repo root with the pinned stack and the layered `src/` structure, enforce the architecture rules by lint and CI, and record the first spikes in `docs/spikes.md`.

## Boundaries & Constraints

**Always:** Versions exactly as the Stack table. Layers `lib, scenes, features, server, db, app` with `eslint-plugin-boundaries` (lib imports nothing; client never imports server). One `browserslist` file feeds build targets and the Playwright matrix. Lint bans hex colors outside generated tokens, physical CSS properties, `eval`/`new Function`. `docs/coding-standard.md` and `AGENTS.md` exist and name the lint rules.

**Never:** No product features, theme, i18n or database in this story. No Server Actions, no third-party analytics or fonts. No secrets in git. No placeholder app copy beyond a bare home page.

**Decisions (owner, 2026-11-26):** (1) Run `git init` and make a first commit; write `.github/workflows/ci.yml`; the Vercel preview-deployment criterion stays pending until the owner connects Vercel. (2) Pin Node: `engines` `>=24 <25` and `.nvmrc` 24; Node 26 only warns. (3) Run the four local spikes now; the Supabase spikes (CDN behavior, TOTP `aal2`) and the real-phone check are written as exact owner steps marked `pending owner`, and do not block 1.1.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean build | fresh clone, `npm ci` | typecheck, lint, Vitest, `next build` pass | N/A |
| Layer violation | `lib` file imports from `features` | lint fails naming the rule | CI red |
| Banned code | `eval(` or `#2B4A8B` in a component | lint fails | CI red |
| Spike not runnable | needs Supabase, Vercel or a phone | row in `docs/spikes.md` marked `pending owner` with exact steps | does not block 1.1 |

</frozen-after-approval>

## Code Map

- Repo root is empty of code: `docs/srs.md`, `_bmad*`, `.claude` only. Nothing to reuse or protect except those.
- Authoritative inputs: `ARCHITECTURE-SPINE.md` (AD-1, AD-24, AD-27, AD-29, Stack, Structural Seed tree), `epics.md` Story 1.1.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` -- pinned deps and strict TS -- AD-29 stack
- [x] `src/{lib,scenes,features,server,db,app}/` with a minimal `app/layout.tsx` and `app/page.tsx` -- layer skeleton -- AD-1
- [x] `eslint.config.mjs` -- boundaries, no-eval, no-new-func, hex and physical-CSS bans -- AD-1, AD-11, AD-12
- [x] `browserslist`, `playwright.config.ts` -- one target list drives build and device matrix -- AD-29
- [x] `vitest.config.ts`, one smoke test, one lint-rule test fixture -- prove checks fail when they should -- AD-27
- [x] `.github/workflows/ci.yml` -- typecheck, lint, test, build -- AD-24
- [x] `docs/coding-standard.md`, `AGENTS.md`, `docs/spikes.md`, `.gitignore`, `.env.example` -- standards and spike record -- NFR-6.1

**Acceptance Criteria:**
- Given a fresh clone, when `npm ci && npm run check` runs, then typecheck, lint, tests and build pass.
- Given a `lib` file importing `features`, when lint runs, then it fails with the boundary rule.
- Given the browserslist file, when the Playwright config loads, then its device list is derived from it.
- Given `docs/spikes.md`, then each of the six spikes has a result or a `pending owner` entry with exact steps.

## Implementation Notes

- Direct implementation (no subagent). `eslint-plugin-boundaries` v7 needs `policies` (not `rules`) and a resolver: the default node resolver never resolves `.ts`, so every import looked "unknown" and nothing was enforced. Added `eslint-import-resolver-typescript` so the `@/` alias is covered too; tests prove both.
- `eslint-import-resolver-typescript` was added to devDependencies beyond the Stack table (lint tooling only).
- `tsconfig.json` was extended by `next build` (`allowJs`, `.next/dev/types`); kept.
- Not run locally: Playwright e2e (browsers not installed here); it runs in CI. Vercel preview deployment pending owner (no Vercel project).
- Spikes (6): 1 passed (4), 1 failed as assumed (3), 1 measured (5), 1 partly done (1: bundle sizes done, devices pending owner), 2 pending owner (2, 6). All in `docs/spikes.md`. Throwaway spike code deleted.
- Local Node is 26.4; `engines` warns as decided. CI uses `.nvmrc` 24.

## Spec Change Log

## Review Triage Log

Three reviewers (blind, edge-case, verification-gap). Verdicts after checking each claim against the repo:

| Finding | Verdict | Evidence / action |
| --- | --- | --- |
| `.gitignore` absent from diff; no `package-lock.json` | false | `.gitignore` is in the baseline commit; the lockfile exists and was excluded from the review diff only. |
| Hex and physical-class bans miss template literals and hex inside longer strings | medium | Reproduced (0 errors). Fixed: template selectors, 6/8-digit hex anywhere, prefix match for `ml-${n}`; tests added. |
| `left`/`right` object keys flagged | low | Real false positive on non-CSS data. Fixed: only margin/padding/border Left/Right. |
| Only negative boundary tests; allowed edges, nested folders, alias unproven | medium | Fixed: 10 positive edge tests, nested-folder and alias cases. Nested folders were already enforced. |
| `no-implied-eval` unpinned | medium | Test showed it never fired: timer globals were undeclared. Fixed with globals plus test. |
| `src/styles/generated/**` exemption untested | low | Fixed: test added. |
| Lint test could pass vacuously (ignored file, cwd) | low | Fixed: fixed cwd, result and "ignored" asserted. |
| CSS files not linted | medium | Fixed for now with a vitest scan of `src/**/*.css`; stylelint deferred. |
| CI e2e: msedge not installed; no permissions, concurrency, artifact | medium | Fixed in `ci.yml`; `webServer` timeout added. |
| Matrix test breaks on a `#` comment or duplicate names | low | Fixed with a unique-name test and comment filter. |
| browserslist versions not applied to Playwright | low | True limit; documented in `tests/playwright-matrix.ts`. Floors are covered by the device spike. |
| `@types/node` not exact | low | Fixed to 24.19.4, lockfile updated. |
| Spec note counted spikes wrongly | low | Wording fixed. |
| engine-strict false vs `engines` | false | Owner decision (Node 26 warns). |
| Hardcoded `lang="en"`, root `page.tsx` vs `[locale]`, no CSP, no README or prettier | false | Placeholder by design; Stories 1.3 and 1.6 replace them. |
| Unused deps installed early | false | Intentional: validates the pinned stack peers. |
| Spike results not reproducible | low | Fixed: commands added to `docs/spikes.md`. |
| "topic not lesson" conflicts with memory "120 lessons" | false | Memory was updated after the SRS change. |
| Unclassified dirs (`src/styles`, `src/i18n`, `proxy.ts`) | defer | Added when Stories 1.2 and 1.3 create them. |
| `'use client'` app file can import `server` | defer | Enforce with a lint rule in Story 1.6. |
| `require(var)`, indirect `globalThis.eval` | rejected | Low; ESM project and more rules than the risk justifies. |
| No `npm audit` or Dependabot | defer | Story 9.4 (security review). |

## Verification

**Commands:**
- `npm ci && npm run check` -- expected: exit 0
- `npm run lint` after adding a banned line in a scratch file -- expected: non-zero exit
