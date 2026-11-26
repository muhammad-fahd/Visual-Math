---
title: 'Story 1.1: Project setup, CI and the first spikes'
type: 'chore'
created: '2026-11-26'
status: 'ready-for-dev'
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
- [ ] `package.json`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` -- pinned deps and strict TS -- AD-29 stack
- [ ] `src/{lib,scenes,features,server,db,app}/` with a minimal `app/layout.tsx` and `app/page.tsx` -- layer skeleton -- AD-1
- [ ] `eslint.config.mjs` -- boundaries, no-eval, no-new-func, hex and physical-CSS bans -- AD-1, AD-11, AD-12
- [ ] `browserslist`, `playwright.config.ts` -- one target list drives build and device matrix -- AD-29
- [ ] `vitest.config.ts`, one smoke test, one lint-rule test fixture -- prove checks fail when they should -- AD-27
- [ ] `.github/workflows/ci.yml` -- typecheck, lint, test, build -- AD-24
- [ ] `docs/coding-standard.md`, `AGENTS.md`, `docs/spikes.md`, `.gitignore`, `.env.example` -- standards and spike record -- NFR-6.1

**Acceptance Criteria:**
- Given a fresh clone, when `npm ci && npm run check` runs, then typecheck, lint, tests and build pass.
- Given a `lib` file importing `features`, when lint runs, then it fails with the boundary rule.
- Given the browserslist file, when the Playwright config loads, then its device list is derived from it.
- Given `docs/spikes.md`, then each of the six spikes has a result or a `pending owner` entry with exact steps.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm ci && npm run check` -- expected: exit 0
- `npm run lint` after adding a banned line in a scratch file -- expected: non-zero exit
