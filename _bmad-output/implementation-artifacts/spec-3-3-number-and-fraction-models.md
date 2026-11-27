---
title: 'Story 3.3: Number and fraction models'
type: 'feature'
created: '2026-11-28'
status: 'review'
baseline_commit: '71d69825cbc9b29db41c75d26100a3b38b8c0ad0'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-1-2d-graphs-canvas2d.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Foundation topics (place value, fractions, percent) need pictures a beginner can move: a number line, place-value blocks, ten-frames, fraction bars and circles, area models and a percent grid, with drag and drop by pointer and by keyboard (FR-3.19). No scene type draws them.

**Approach:** Register `number-model@1` as topic-format 2.6 defines it (one `model` per scene, seven kinds). `lib/numbermodel` turns a model and the parameters into a flat picture (rectangles, sectors, lines, text) plus a list of controls and a list of sentences. A pure SVG renderer draws it; a feature-layer handle moves along a control's track of positions and writes the parameter it is bound to. The page, steps, address and Reset all are unchanged.

## Boundaries & Constraints

**Always:**
- Every number comes from `lib/expr`; the picture is a pure function of `(model, params)`; no listener in `src/scenes`; colors are tokens, no hex, logical CSS; the picture stays left to right in Urdu.
- Drag and drop writes a parameter and nothing else. A thing is draggable only when its field is exactly a parameter id (`num: "n"`); the handle moves along discrete positions (a tick, a cell, a rim point, a column's stack), snaps to the nearest, and the parameter clamps and snaps it. Keyboard: the handle is a focusable `slider`; Left/Down and Right/Up move one position, Shift moves ten, Home and End go to the ends.
- Fields are clamped to the table of topic-format 2.6 (`den` 1 to 24, rows 1 to 4, area rows and columns 1 to 20, ten-frame count 0 to 20, place value 0 to 9999, percent 0 to 100, number-line at most 400 steps); counts are rounded to whole numbers; a value that cannot be computed draws nothing.
- Two fraction bars with `alignLine` draw one line at the end of the first bar's filled part across every bar; the text says which bars reach the same length (cross-multiplied exactly, so 2/4 and 1/2 are equal) and the fraction in lowest terms.
- Everything drawn is also text: a list of sentences (what each model shows, its numbers, the distributive sum, the digits) and the live region, in the visitor's language.
- `partIds` a step may hide or show: `marks`, `jumps`, `align`, `labels`.

**Never:**
- No free dragging of loose pieces to arbitrary places (every move is a parameter); no `canvas2d` change; no algebra tools (Story 3.4); no new dependency; no change to the frame, colors or fonts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fraction bars | rows 2/4 and 1/2, `alignLine` | two bars, 2 of 4 and 1 of 2 filled, one line at half; text "bars 1 and 2 reach the same length: 1/2" | den 0 or NaN: bar not drawn |
| Unequal bars | 1/3 and 1/2 | line at the first bar's end, no "same length" sentence | N/A |
| Drag a bar's end | `num` is a parameter | nearest cell edge; parameter follows; arrow keys step 1 | not a parameter id: no handle |
| Fraction circle | 3/8 | 8 sectors, 3 filled; rim handle moves `num` | den over 24: clamped to 24 |
| Number line | 0 to 10, step 1, marker `m`, one jump 2 to 7 | ticks, labels, an arc "+5", marker handle on ticks | step <= 0, max <= min or over 400 steps: nothing drawn |
| Place value | 3,405 | columns 1000, 100, 10, 1 with 3, 4, 0, 5 blocks; a column handle changes only its digit (3,405 to 3,505) | value over 9999 or below 0: clamped |
| Ten-frame | count 7, then 13 | 7 counters on frame one; 10 and 3 on two frames; text "3 more to make ten" | over 20: 20 |
| Area model | 3 by 12, `splitCols` 10 | grid; two regions; text "3 x 10 + 3 x 2 = 36" | split 0 or equal to cols: no split |
| Percent grid | 35 | 35 of 100 cells filled; text "35 out of 100" | over 100: 100 |
| Step hides `align` | `hide: ["align"]` | the line and its sentence are gone | unknown id ignored |
| SSR | first render | picture and sentences are in the HTML | N/A |
| Urdu | `/ur` | words in Urdu; picture and numbers left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/number-model.ts` (new), `meta.ts` (`NUMBER_MODEL_META`, parts), `index.ts` -- strict schema from topic-format 2.6; add `marker: Num` to `numberLine` (the draggable point); caps and `Num` fields as for `canvas2d`.
- `src/lib/numbermodel/` (new: `build.ts`, `index.ts`) -- pure: `buildModel({model, program, scope, params, hidden, text})` returns `{prims, controls, sentences}`; reduce fractions by gcd; positions per control.
- `src/scenes/numbermodel/NumberModel.tsx` (new) -- pure SVG of the prims (reuse the token tables idea of `scenes/canvas2d/Canvas2D.tsx`); `overlay` slot for handles.
- `src/features/scene/NumberModelViewer.tsx`, `ModelHandles.tsx` (new), `viewers.tsx` -- viewer on `useSceneState`, sentences, live region; handles by control; register `number-model`.
- `src/i18n/messages/{en,ur}.json` -- `models.*` sentences and drag labels (Urdu is an AI draft).
- `content/fixtures/num-fraction-bars.json`, `src/app/[locale]/dev/topic/page.tsx` -- fixture "Equivalent fractions" with 2/4 and 1/2, steps showing the line; harness key `fractions`.
- `tests/unit/number-model.test.ts`, `tests/e2e/models.spec.ts`, `tests/unit/scene-frame-harness.test.ts` allowlist, `docs/coding-standard.md` one line.
- Reuse: `useSceneState`, `ParameterControls`, `SceneFrame`, the 3.1 `Handles` idea (pointer to picture units through the SVG matrix). Not to change: `lib/expr`, `SolidViewer`, `canvas2d`, the frame.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/numbermodel/build.ts` -- the seven kinds as prims, controls and sentences -- tested against the matrix
- [x] `src/lib/topic-schema/scenes/number-model.ts`, `meta.ts`, `index.ts` -- the schema and registry entry -- tests for caps, unknown keys, bad kind
- [x] `src/scenes/numbermodel/NumberModel.tsx` -- the pure picture
- [x] `src/features/scene/NumberModelViewer.tsx`, `ModelHandles.tsx`, `viewers.tsx`, messages -- viewer, handles by pointer and keyboard, text
- [x] fixture, harness registration, unit and e2e tests, docs line

**Acceptance Criteria:**
- Given number line, place-value blocks, ten-frames, fraction bars and circles, and area models, when a handle is dragged or moved with the keyboard, then the bound parameter follows and the picture and text update (FR-3.19).
- Given two fraction bars, when `alignLine` is on, then a line shows that 2/4 and 1/2 reach the same length.
- Given the graph, geometry and solid topics, when this lands, then their tests pass unchanged; `npm run check` and Playwright (Chrome, Edge) pass.

## Implementation Notes

- `lib/numbermodel/build.ts` is the one place that lays out the seven kinds: it returns prims (rect, line, text, sector, dot, jump), controls and sentences. `scenes/numbermodel/NumberModel.tsx` draws them; `features/scene/{NumberModelViewer,ModelHandles}.tsx` are the viewer and the single handle component. `NumberModel` is registered in `lib/topic-schema/scenes` (with `marker` added to `numberLine`) and in `features/scene/viewers.tsx`.
- The color-token class tables moved to `src/scenes/tokens.ts`, shared by `Canvas2D` and `NumberModel` (no behavior change; clears a 3.1 deferred item).
- Fixture is `content/fixtures/num-equivalent-fractions.json` (harness key `fractions`), not the name in the Code Map. A step's `hide` is cumulative, so step 2 `show`s `align`.
- Verified: `npm run check` green (1444 unit tests, 3D chunk 238 of 450 KB gzip); Playwright 484 tests on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

Three reviewers (blind hunter, edge-case hunter, verification-gap), then triage. Patched in this story:
- medium (patch): a number line whose step does not divide its length drew ticks and the marker past the end (edge case and blind hunter, `build.ts` numberLine). Ticks now stop at the last whole step; the marker sentence reports the clamped value.
- medium (patch): pointer reach of the whole fraction circle: positions 0 and den were the same point, so a pointer could never pick the whole. The whole now sits slightly left of the top.
- medium (patch): handles started a drag on any button and left `dragging` set if a release was missed; `preventDefault` stopped focus, so the arrow keys did nothing after a mouse drag. Both `Handles` (3.1 and 3.2) and `ModelHandles` now ignore non-primary presses, stop when no button is held, and focus the handle.
- medium (patch): hiding `labels` did not hide mark labels; `alignLine` aligned to the second bar when the first bar was not drawable; the fixture readout said 1.25 where the picture showed a full bar (it now uses `min(n, d) / d`).
- low (patch): a count of exactly ten read "0 more to make ten" (now "Ten is full."); area-model dimension labels sat under the split handles; the slider's `aria-valuetext` was a bare number (now "2 of 4"); the sentence lists were forced left to right, which put Urdu prose on the wrong side (only the picture is LTR now, in both 2D viewers).
- Verification gaps closed by tests: every sentence and handle label of every kind resolves in English and Urdu with nothing left over; `labels` hidden; a whole circle renders a `<circle>`; the other patches above each have a test.
Rejected:
- false: "handles break touch input" (no `touch-action: none`): the frame surface the picture sits in already has `touch-none`, so touch drags reach the handle.
- false: the place-value handle sits 20 units off its stack: it sits just above the top block by design, as the grab point.
- low: Shift+arrow jumps to the end of a short control (clamped, expected); marks and jumps outside the line are skipped without a word (the author sees it in the preview); the pointer drag test is shallow (the unit tests cover nearest-position picking).
- reject (edits the spec): the fixture file name in the Code Map; the claim that the canvas2d renderer changed. The `Never` meant no new canvas2d behavior; the token tables only moved to a shared file and the 3.1 and 3.2 tests pass unchanged.
Deferred: see `deferred-work.md`.

## Design Notes

Drag and drop stays a parameter write: a control is `{param, values[], positions[], index}`. The pointer picks the nearest position, the keyboard the next one, and `toParam` maps the picked value to the parameter (identity, except a place-value column, which replaces one digit of the number). One handle component then serves every kind.

## Verification

**Commands:**
- `NEXT_DIST_DIR=.next-e2e npm run check` -- expected: all green
- `NEXT_DIST_DIR=.next-e2e npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
