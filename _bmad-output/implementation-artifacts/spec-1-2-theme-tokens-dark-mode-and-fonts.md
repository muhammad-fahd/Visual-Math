---
title: 'Story 1.2: Theme tokens, dark mode and fonts'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '7660f3c9e8e68a624c7dd2e6f11747bccc5d1d21'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Visual Math-2026-11-26/DESIGN.md'
  - '{project-root}/docs/spikes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The site has no theme: colors live only in DESIGN.md, there is no dark mode, and Urdu has no font strategy, so no later UI can be built on tokens.

**Approach:** Generate `tokens.css` and `tokens.ts` from the DESIGN.md frontmatter (unchanged), apply Light, Dark or System before first paint from one constant inline script, wire Tailwind to the variables, and load the Urdu font after a visible fallback on `/ur` only.

## Boundaries & Constraints

**Always:** DESIGN.md frontmatter is the only source of color, type, spacing and radius values; never edit its values. Components use CSS variables, never hex. Saved choice lives in `localStorage` key `vm.theme` (`light`, `dark`, `system`; default `system`). Switching never reloads the page or remounts content. Export the script's sha256 for the CSP (Story 1.6). Urdu font is self-hosted WOFF2, `font-display: swap`, with the OFL licence text in the repo.

**Never:** No locale routing (Story 1.3), no scene components, no nav bar. No third-party fonts or scripts. Do not change DESIGN.md colors or the contrast table values.

**Decision (owner, 2026-11-26):** Urdu font is regular weight 400 only (about 125 KB WOFF2). Urdu headings use the same weight at heading size; no bold file, no faux bold.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit, OS dark | no saved value | `<html data-theme="dark">` before first paint | N/A |
| Saved choice | `vm.theme=light`, OS dark | light | N/A |
| System follows OS | `vm.theme=system`, OS switches | theme updates live, no reload | N/A |
| Toggle | user picks Dark | attribute and storage change, page state kept | N/A |
| Bad stored value | `vm.theme=banana` or storage blocked | falls back to system | no throw |
| JS disabled | no script | CSS `prefers-color-scheme` still themes the page | N/A |
| Token drift | DESIGN.md edited, generated files stale | test fails naming the stale file | CI red |
| Hex in code | hex outside generated files | lint fails (Story 1.1) | CI red |
| Contrast | any DESIGN.md contrast row | computed ratio within 0.05 of the listed value and at least its threshold, light and dark | test fails listing the pair |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-Visual Math-2026-11-26/DESIGN.md` -- frontmatter `colors` (light plus `-dark` twins), `typography`, `rounded`, `spacing`; contrast table in the body. Read-only input.
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` -- placeholder shell from Story 1.1; extend, do not restructure.
- `eslint.config.mjs` -- hex rule already exempts `src/styles/generated/**`; no change needed.
- `docs/spikes.md` section 5 -- font measurements and the subset commands.
- `tests/unit/lint-rules.test.ts` -- pattern for tests that scan `src` CSS; generated CSS is exempt there.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `yaml` (exact version) as devDependency -- parse DESIGN.md
- [x] `scripts/build-tokens.mjs`, `package.json` scripts `tokens`, `prebuild` -- generate `src/styles/generated/tokens.css` (`:root`, `[data-theme="dark"]`, no-JS `prefers-color-scheme` block) and `tokens.ts` (typed) -- single source
- [x] `src/styles/generated/tailwind-theme.css` (generated), `src/app/globals.css` -- Tailwind `@theme` mapped to variables; base body colors and focus ring token -- utilities use tokens
- [x] `src/lib/theme/` (`prepaint.ts`, `resolve.ts`) -- pure resolve function and the constant script string plus its sha256 -- one testable source
- [x] `src/app/layout.tsx` -- inline script in `<head>`, `suppressHydrationWarning` on `<html>` -- no flash
- [x] `src/features/theme/ThemeToggle.tsx`, `src/app/page.tsx` -- Light / Dark / System control with visible words, 44 px targets -- toggle works without reload
- [x] `src/styles/fonts.css`, `public/fonts/` (woff2 and `OFL-NotoNastaliqUrdu.txt`) -- Urdu fallback `@font-face` with size and ascent overrides, then subset Nastaliq; per the font decision -- no blocking
- [x] `tests/unit/tokens.test.ts`, `tests/unit/contrast.test.ts`, `tests/unit/theme.test.ts` -- drift, contrast table and matrix rows -- AC proof
- [x] `tests/e2e/theme.spec.ts` -- no flash, persistence, system follow -- runs in CI

**Acceptance Criteria:**
- Given DESIGN.md, when `npm run tokens` runs, then both generated files match it and the drift test passes.
- Given a saved theme, when the page loads, then `data-theme` is set before first paint.
- Given the toggle, when the user switches, then no navigation occurs and the choice persists.
- Given an Urdu page, when fonts load, then text is visible in the fallback first and the Nastaliq file is requested only on `/ur`.

## Implementation Notes

- Direct implementation (no subagent). Generated: `tokens.css`, `tokens.ts`, `tailwind-theme.css` (committed; `prebuild` and `predev` regenerate; a drift test compares them to DESIGN.md).
- Added `yaml` 2.9.1 (devDependency, as the Stack note planned). Font: Noto Nastaliq Urdu regular only, subset 124 KB WOFF2 (budget 150), OFL text beside it in `public/fonts/`.
- The pre-paint script also follows OS changes live while the choice is `system`, so the follow works on every page without the toggle mounted. Its sha256 is exported from `src/server/csp-hashes.ts` for Story 1.6.
- All 26 rows of the DESIGN.md contrast table pass against the real tokens (within 0.05 of the listed values); DESIGN.md was not edited.
- Playwright: Chromium installed locally; all 10 e2e tests (1 home, 9 theme and font) pass on `chrome-111`; 103 unit tests pass. Firefox, WebKit and Edge projects run in CI only.
- Toggle labels are English literals until Story 1.3 moves strings to message files. Urdu fallback metric overrides are approximate (see Design Notes).
- Not done here: scene frame dark surface (later story); font preload on `/ur` (Story 1.3 creates the route).

## Spec Change Log

## Review Triage Log

Three reviewers (blind, edge-case, verification-gap), claims checked against the repo:

| Finding | Verdict | Evidence / action |
| --- | --- | --- |
| Toggle shows System pressed on first render | medium | Real flicker. Fixed: reads `data-theme-choice` with `useSyncExternalStore`; e2e added. |
| Explicit choice overridden by an OS change when storage is blocked | medium | Real. Fixed: script uses the attribute as the in-page truth; unit test added. |
| No `storage` event: other tabs stay stale | low | Fixed in the script; unit test added. |
| `applyChoice` throws if `matchMedia` is missing | low | Fixed with a guard. |
| `addListener` fallback untested | low | Unit test added. |
| Font e2e passes even if the file 404s; no 150 KB check | medium | Fixed: response status and type, `document.fonts.check`, unit test for size, WOFF2 magic and licence. |
| Inline script not checked against the CSP hash | low | Done now rather than deferred: e2e hashes the served script. |
| No test with JavaScript disabled | low | Added. 44 px target and pressed-state tests added. |
| `build-tokens.mjs` emits `undefined`/`null` on bad input; BOM; EOF frontmatter | medium | Fixed: `validate()` plus tests; required typography roles. |
| Contrast test: fragile parsing, no guard on heading or cells | low | Fixed; extra pairs the toggle uses are asserted. |
| `--vm-type-urdu-body-*` could silently vanish | low | Test asserts the variables exist. |
| Tailwind fallback `local()` fonts too few | low | Added Noto Sans Arabic and Arial. |
| ✓ in the toggle read aloud | low | Wrapped in `aria-hidden`. |
| Generated files and font missing from diff; Playwright dependency not added | false | They exist and were excluded from the review diff only; Playwright arrived in Story 1.1. |
| Task names `theme.css` and `OFL.txt` differ from files | low | Spec task text corrected. |
| Tailwind spacing and type not mapped to tokens | rejected | Tailwind's 4 px spacing scale equals the DESIGN.md scale; the story covers color and radius. |
| `:focus-visible` replaces component box-shadows | rejected | The ring with inner gap is specified by DESIGN.md; cards and frames are not focus targets. |
| Hardcoded `lang="en"` means Urdu never reachable | false | Story 1.3 makes it dynamic; e2e exercises Urdu text via an injected element. |
| `lang=ur` on a nested element gets English body size | defer | Story 1.3 sets `lang` on `<html>`; revisit with mixed-language blocks. |
| Urdu `b`/`strong` lose all emphasis | defer | Real readability gap; owner decided on weight 400 only. Needs an emphasis cue (underline or color) in the topic page story. |
| `prebuild` rewrites committed tokens | rejected | The drift test runs before build in `npm run check` and fails first. |
| Firefox, WebKit `matchMedia` behavior unverified | defer | Runs in CI projects. |

## Design Notes

Fallback metrics cannot be measured exactly without the target devices; set approximate `size-adjust`/`ascent-override` and rely on container `line-height` (Urdu body 36 px) so a swap shifts at most one line. Verify on real phones in Story 9.3.

## Verification

**Commands:**
- `npm run check` -- expected: exit 0
- `npm run tokens && git diff --exit-code src/styles/generated` -- expected: no diff
