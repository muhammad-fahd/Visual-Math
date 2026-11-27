---
title: 'Story 3.5: Trigonometry scenes'
type: 'feature'
created: '2026-11-28'
status: 'review'
baseline_commit: '2203e8c443ef2a99ab3ca35d520bd6ff3ae1f1bd'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-3-number-and-fraction-models.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trigonometry topics need a unit circle with a draggable angle that shows sine, cosine and tangent and the wave they trace, and a right triangle whose sides can change (FR-3.21). The schema knows `unit-circle@1` but nothing draws it, and `right-triangle@1` is not registered.

**Approach:** Draw `unit-circle@1` (topic-format 2.4) and register and draw `right-triangle@1` (2.5). `lib/trig` computes the angle, the three ratios, exact values at special angles, the wave's points, snapping, and the triangle's sides and ratios; it emits the same flat prims as the other models (plus a polyline) for the shared SVG renderer. A feature-layer handle on the circle's point drags the angle parameter by pointer and keyboard and snaps to special angles. The page, steps, address and Reset all are unchanged.

## Boundaries & Constraints

**Always:**
- Every number comes from `lib/expr`; the picture is a pure function of `(scene, params)`; no listener in `src/scenes`; colors are tokens, no hex, logical CSS; the picture stays left to right in Urdu.
- Unit circle: the angle parameter's unit is `deg` or `rad` (anything else is read as degrees); the point is at (cos, sin); parts a step may hide or show are `circle`, `point`, `radius`, `arc`, `cosine`, `sine`, `tangent`, `wave`, `quadrants`. The cosine (along the x-axis) and the sine (vertical) differ by dash as well as color; the tangent is drawn only when the scene has `tangent` and its `when` is non-zero, and not at an angle where cosine is zero (it reads "undefined").
- Values shown are the true values: sin, cos and tan of the angle to 4 decimals, and at the special angles (multiples of 30 and of 45 degrees) their exact forms ("1/2", "√3/2", "√2/2", "√3/3", "√3"); radians are written as a fraction of π at multiples of 15 degrees. The values at 30, 45, 60, 150 and 225 degrees match the known values (NFR-6.2).
- The angle handle is bound to the angle parameter (clamped and snapped by it); the pointer sets the angle from the pointer's direction and snaps to `snap.values` within `snap.within` (in the parameter's unit); Left/Down and Right/Up move one parameter step, Shift ten, Home and End the ends, PageUp and PageDown the next special angle. It is a focusable `slider` whose value text is the angle with its sine and cosine.
- Wave: `wave.fn` over `wave.from` to `wave.to` (in the parameter's unit) in a second panel, with a dot at the current angle when it is in range; a tangent wave breaks at each pole and never draws a spike.
- Right triangle: `given` is `sides` (adjacent and opposite) or `angle` (1 to 89 degrees, and a hypotenuse); the missing parts come from the Pythagorean theorem and `atan2`; sides and angle must be positive and finite or nothing is drawn. The picture shows the triangle, the right-angle mark, the angle arc, the side labels (`labels`: `opp-adj-hyp` words in the visitor's language, or `abc`) and, for each ratio in `ratios`, its definition and value as text.
- Everything drawn is also text (a list of sentences and the live region), in the visitor's language.

**Never:**
- No drawing of angles beyond 0 to 360 degrees on the wave panel's axis; no free dragging of the triangle's corners (sides change by sliders); no new dependency; no change to `canvas2d`, `number-model`, `algebra-tool` behavior, the frame, colors or fonts; the checks of stage S2 (that the angle parameter exists and has a unit of deg or rad) are not part of this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Special angles | 30, 45, 60, 150, 225 degrees | sin, cos, tan equal the known values; exact forms shown | N/A |
| Quadrant | 150 degrees | "second quadrant"; sine positive, cosine negative | on an axis: "on the axis" |
| Tangent pole | 90 or 270 degrees | tangent reads "undefined", no tangent segment drawn | N/A |
| Drag | pointer at a direction | the angle follows; within `snap.within` of a special value it snaps | outside the parameter's range: clamped |
| Keyboard | arrows, PageUp | one step; next special angle | at the ends: stays |
| Radians | unit `rad`, value pi / 6 | the same picture as 30 degrees; text "π/6" | unit not deg or rad: degrees |
| Wave | sin from 0 to 360, angle 150 | a sine curve, a dot at (150, 0.5); guide line from the circle | angle outside range: no dot |
| Tangent wave | tan from 0 to 360 | branches broken at 90 and 270 | N/A |
| Right triangle by sides | adjacent 4, opposite 3 | hypotenuse 5, angle 36.87 degrees; sin 0.6, cos 0.8, tan 0.75 | a side <= 0 or NaN: nothing drawn |
| Right triangle by angle | angle 30, hypotenuse 10 | adjacent 8.66, opposite 5 | angle 0 or 90: clamped to 1 and 89 |
| Sides change | a slider moves a side | the ratios update | N/A |
| Hidden part | step hides `wave` or `ratios` | that part and its text are gone | unknown id ignored |
| SSR | first render | picture and sentences are in the HTML | N/A |
| Urdu | `/ur` | words in Urdu; picture and numbers left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/right-triangle.ts` (new), `meta.ts` (`RIGHT_TRIANGLE_META`), `index.ts` -- schema of topic-format 2.5; `unit-circle.ts` is unchanged.
- `src/lib/trig/` (new: `values.ts`, `unit-circle.ts`, `triangle.ts`, `index.ts`) -- pure: `trigValues`, `exactValue`, `radText`, `snapAngle`, `buildUnitCircle`, `buildTriangle`.
- `src/lib/numbermodel/build.ts` (`Prim` union) and `src/scenes/numbermodel/NumberModel.tsx` -- add a `path` prim (a polyline) for the wave; nothing else changes.
- `src/features/scene/AngleHandle.tsx`, `TrigViewers.tsx` (new), `viewers.tsx` -- viewers of both scene types on `useSceneState`; the handle reuses the pointer-to-picture matrix idea of `Handles.tsx`; register `unit-circle` and `right-triangle`.
- `src/i18n/messages/{en,ur}.json` -- `trig.*` (Urdu is an AI draft).
- `content/fixtures/trig-unit-circle.json` and `trig-right-triangle.json`, `src/app/[locale]/dev/topic/page.tsx` -- fixtures (harness keys `circle`, `triangle3`).
- `tests/unit/trig.test.ts`, `tests/e2e/trig.spec.ts`, the scene-listing tests, `tests/unit/scene-frame-harness.test.ts` allowlist, `docs/coding-standard.md` one line.
- Reuse: `useSceneState`, `ParameterControls`, `SceneFrame`, `lib/expr`, `NumberModel`. Not to change: `lib/expr`, the other viewers, the frame.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/trig/*` -- values, exact forms, snapping, circle and triangle layouts -- tested against the matrix and known values
- [x] `src/lib/topic-schema/scenes/right-triangle.ts`, `meta.ts`, `index.ts` -- the registry entry -- schema tests
- [x] `src/lib/numbermodel/build.ts`, `NumberModel.tsx` -- the `path` prim
- [x] `src/features/scene/AngleHandle.tsx`, `TrigViewers.tsx`, `viewers.tsx`, messages -- viewers, handle, text
- [x] fixtures, harness registration, unit and e2e tests, docs line

**Acceptance Criteria:**
- Given the unit circle, when the angle is dragged by pointer or keyboard, then sine, cosine, tangent and the wave follow, and it snaps to special angles (FR-3.21).
- Given the right triangle, when a side changes, then the ratios update.
- Given angles 30, 45, 60, 150 and 225 degrees, when shown, then the values match the known values (NFR-6.2).
- Given the earlier topics, when this lands, then their tests pass unchanged; `npm run check` and Playwright (Chrome, Edge) pass.

## Implementation Notes

- `lib/trig` holds the numbers (`values.ts`: ratios, exact forms, radians as a fraction of pi, snapping, `angleFromPointer`), the unit circle layout and the triangle layout, all as the prims of the shared renderer; `NumberModel` gained a `path` prim for the wave. `AngleHandle` is the handle; `TrigViewers.tsx` holds both viewers.
- The circle's fixture is the existing `content/fixtures/trig-unit-circle.json` (harness `circle`); the new one is `trig-right-triangle.json` (harness `triangle3`). `topic-page-render.test.ts` used `unit-circle` as "a scene with no viewer": it now uses an unregistered type.
- `eslint.config.mjs`: the word `triangle` is allowed after `right-` so the scene type name `right-triangle` is not read as a physical class (pinned in `lint-rules.test.ts`).
- Verified: `npm run check` green (1526 unit tests, 3D chunk 238 of 450 KB gzip; one earlier run had four PGlite migration test files time out in `beforeAll` under load and passed on the rerun); Playwright 514 tests on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

Three reviewers (blind hunter, edge-case hunter, verification-gap), then triage. Patched in this story:
- medium (patch): the pointer's snap to a special angle was re-rounded onto the parameter's step grid, so in radians (step 0.01) 30 degrees became about 29.8 (edge case). `angleFromPointer` returns `snapped` and the handle writes a special angle exactly.
- medium (patch): a drag assumed a 0 to 360 parameter: with -180 to 180 the lower half jumped to +180, with 0 to 90 the point flipped, and snapping did not wrap across 0 and 360 (edge case, blind hunter). `angleFromPointer` tries a turn more and less, snaps each, and keeps the in-range one nearest the current value; the centre (no direction) is ignored.
- medium (patch): the wave was drawn beyond 0 to 360 for a wider range (a `Never` of the spec); the dot jumped or vanished for an equivalent angle (360, -30, 200 on -180 to 180). The wave is clamped to 0 to 360 and the dot uses the angle, its 0 to 360 form or a turn less.
- low (patch): a negative angle's arc and its label disagreed (label now the 0 to 360 form); the tangent wave overshot the y-axis (axis longer) and the amplitude was unlabeled (ticks 1 and -1); a ratio listed twice (refused by the schema); the template-piece lint pattern lacked the `right-triangle` exemption (and no test pinned either).
- Verification gaps closed by tests: the Show tangent toggle and a `when` that cannot be computed (the viewer's gating), the handle in radians, the pointer-to-angle mapping in every range, a wide wave, a negative angle, the lint exemption.
Rejected:
- false: the unit-circle fixture is missing from the diff (it already exists in the tree and its twin `.md` is tested); `path` prim missing from other exhaustive switches (the typecheck would fail); "-0" for a tiny negative value (`format` gives no sign to a value that rounds to zero).
- false: touch drag falls to page scroll: the frame surface has `touch-none`.
- low: quadrant and pole use different tolerances (a window of about 1e-8 degrees); extreme triangle aspect ratios (the sliders limit the sides to 1 to 12); the guide line exists for sine only; the tangent is drawn clamped near a pole (the text says the true value).
- reject (edits the spec): the spec's "positive and finite" wording against the clamped angle; spec bookkeeping fields; the S2 checks (out of scope by the spec).
Deferred: see `deferred-work.md`.

## Design Notes

The circle is drawn in screen units with the origin at the left panel's centre and y downward, so a point at angle t is (cx + r cos t, cy - r sin t). The handle turns a pointer position back into an angle with `atan2` about the same centre, so dragging and drawing use one mapping. The exact forms are a table keyed by the angle in degrees, used only when the angle is within 1e-9 of a special value.

## Verification

**Commands:**
- `NEXT_DIST_DIR=.next-e2e npm run check` -- expected: all green
- `NEXT_DIST_DIR=.next-e2e npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
