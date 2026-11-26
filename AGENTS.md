# AGENTS.md: Visual Math

Free web app that teaches math through interactive visuals, English and Urdu. Version 1 only: no visitor accounts, one admin. Source of truth: `docs/srs.md`. Planning: `_bmad-output/planning-artifacts/` (PRD, UX, architecture, `epics.md`). Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Commands

- `npm run check` : typecheck, lint, unit tests, build (run before finishing any change)
- `npm run lint`, `npm run test`, `npm run typecheck`, `npm run test:e2e`

## Rules that break the build

See `docs/coding-standard.md`. In short: respect the layer imports (`lib` imports nothing from the repo); no `eval`/`new Function`/dynamic import of a variable path; no hex colors (use DESIGN.md tokens); no physical CSS (Urdu mirrors, use logical properties).

## Things to know

- A topic is data (JSON or MD, format in `topic-format.md`); scene types are registered code. Nothing in a topic is ever executed.
- Design and colors are fixed: DESIGN.md (Quiet Study). Do not change tokens without updating its contrast table.
- Terms: "topic", not "lesson". Requirement IDs are the SRS IDs (FR-x.y).
- Node 24; versions pinned exactly. Do not add third-party scripts, fonts or analytics.
- Spike results and pending owner steps: `docs/spikes.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
