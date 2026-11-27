---
title: 'Story 3.2: 2D geometry'
type: 'feature'
created: '2026-11-27'
status: 'review'
baseline_commit: '3256d004bfe58509a5002718b54b12f0661757a7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-1-2d-graphs-canvas2d.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `canvas2d` draws graphs but not geometry. Geometry topics need points, lines, circles and polygons that can be dragged with live lengths and angles (FR-3.18), and the transformations reflect, rotate, translate and scale.

**Approach:** Add to the `canvas2d@1` element union: `segment`, `line` (infinite, or `ray`), `circle`, `polygon`, `angle` (a mark with its measure) and `transform` (an image of a polygon). They refer to `point` elements by id, so dragging a point moves every shape built on it. A measure is a number computed in `lib/graph` and listed as text. Reuse the 3.1 renderer, handles and viewer.

## Boundaries & Constraints

**Always:**
- Shapes take their positions from `point` ids (`through: ["A","B"]`, `points: ["A","B","C"]`, `center: "O"`); a polygon may also list `[x, y]` expressions. A reference to a missing, hidden or non-computable point means the shape is not drawn, never a throw.
- Measures are pure functions in `lib/graph/geometry`: length, angle in degrees (0 to 180, at the middle point), perimeter, area (shoelace). Every number shown is computed there or by `lib/expr`; the viewer formats it.
- `transform` has `of` (a polygon id), `kind` (`reflect` over `x`, `y` or a line through two point ids, `rotate` about a point id by degrees, `translate` by dx, dy, `scale` about a point id by factor k); its amounts are expressions, so sliders drive them. The image is drawn dashed in another color token, with its own label, and is never draggable.
- Dragging and arrow keys reuse the 3.1 handles. Measures and what is drawn are also text (live length, angle, perimeter, area, image vertices) for assistive technology, and the picture stays a pure SVG function.
- Degenerate input is safe: coincident points (zero-length line, zero angle), collinear polygon, radius 0 or negative, scale 0 or NaN draw nothing or a point, and measures read "undefined" or 0 as stated below.

**Never:**
- No calculus or other scene elements, no implicit curves, no constructions with compass steps, no new dependency, no change to the frame, colors or fonts.
- No listeners in `src/scenes`; no hex colors; no physical CSS.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Segment | A(0,0), B(3,4) | drawn; length 5 listed and labelled | A = B: length 0 |
| Drag | A dragged | segment, angle, perimeter, area all follow live | binding not exact: not draggable |
| Angle | A(1,0), O(0,0), B(0,1) | arc mark at O, 90.0 degrees | O = A or O = B: "undefined" |
| Line, ray | through A, B | infinite line clipped to the window; ray starts at A | A = B: nothing drawn |
| Circle | center O, radius number or `through` P | circle; radius, circumference, area listed | radius <= 0 or NaN: nothing |
| Polygon | triangle A, B, C | closed, perimeter and area (shoelace) | fewer than 3 points: nothing; collinear: area 0 |
| Reflect | polygon over the y-axis | image vertices (-x, y), dashed | NaN: no image |
| Rotate | 90 degrees about origin | (x, y) becomes (-y, x) within 1e-9 | NaN: no image |
| Translate, scale | (dx, dy); k about O | image vertices follow the sliders | k = 0: the image collapses to O, no throw |
| Hidden step | `hide: ["A"]` | shapes that use A are not drawn or listed | unknown id ignored |
| SSR | first render | shapes and the text list are in the HTML | N/A |
| Urdu | `/ur` | words mirror; the picture and numbers stay left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/canvas2d.ts` -- add the six element schemas to the `type` union (strict, ids via `kit.eid`, refs via `kit.eid`, amounts via `kit.expr`/`kit.num`); the 60-element cap stays.
- `src/lib/graph/build.ts` -- `Element` union and `buildDrawables`: points are collected first (a map id to x, y), then shapes; new `Drawables` fields `shapes`, `measures`; hidden/visible/`when` rules as for points.
- `src/lib/graph/geometry.ts` (new) -- pure: `distance`, `angleAt`, `polygonArea`, `perimeter`, `clipLine`, `reflect`, `rotate`, `translate`, `scale`.
- `src/scenes/canvas2d/Canvas2D.tsx` -- draw shapes and the arc mark with existing token tables; no listeners.
- `src/features/scene/Canvas2DViewer.tsx` -- measure sentences in the text list and the live region; legend entries for shapes.
- `src/features/scene/Handles.tsx` -- reused unchanged.
- `src/i18n/messages/{en,ur}.json` -- `canvas.*` measure words (Urdu is an AI draft).
- `content/fixtures/geo-triangle-transform.json` -- fixture topic: triangle with draggable vertices, angle marks, reflect, rotate, scale sliders; `src/app/[locale]/dev/topic/page.tsx` -- register it.
- `tests/unit/graph-geometry.test.ts`, `tests/unit/graph-topic.test.ts` (schema), `tests/e2e/geometry.spec.ts`; `tests/unit/scene-frame-harness.test.ts` allowlist.
- Not to change: `src/scenes/frame`, `SolidViewer`, `lib/expr`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/graph/geometry.ts` -- pure measures and transforms -- tested against known values and degenerate input
- [ ] `src/lib/topic-schema/scenes/canvas2d.ts` -- the six elements -- schema tests for limits, unknown keys, bad `kind`
- [ ] `src/lib/graph/build.ts` -- resolve shapes and measures from points -- hidden, missing ref, NaN
- [ ] `src/scenes/canvas2d/Canvas2D.tsx`, `src/features/scene/Canvas2DViewer.tsx`, messages -- draw, list, announce
- [ ] fixture, harness registration, unit and e2e tests, docs line in `docs/coding-standard.md`

**Acceptance Criteria:**
- Given points, lines, circles and polygons, when a point is dragged by pointer or arrow keys, then every dependent length, angle and area updates live (FR-3.18).
- Given reflect, rotate, translate and scale, when their parameters change, then the transformed polygon follows, and rotating (1,0) by 90 degrees gives (0,1).
- Given a degenerate shape, when drawn, then nothing throws and measures follow the matrix.
- Given the solid and 3.1 graph topics, when this lands, then their tests pass unchanged; `npm run check` and Playwright (Chrome, Edge) pass.

## Implementation Notes

- `lib/graph/geometry.ts` holds the pure measures and transformations; `buildDrawables` collects the computable visible points first, then the polygons (a transform of a polygon works even while that polygon is hidden), then draws every element. New `Drawables` fields: `shapes`, `measures`.
- Elements added to `canvas2d@1`: `segment`, `line` (`ray`), `circle` (`radius` or `through`), `polygon` (point ids or `[x, y]`), `angle`, `transform` (`reflect`, `rotate`, `translate`, `scale`). An angle lists its measure by default; the others only with `measure: true`.
- The renderer draws them (image dashed in the accent token, angle as a pie slice); the viewer adds each measure and each image's corners to the text list. `Handles` is unchanged.
- Fixture `content/fixtures/geo-triangle-transform.json`; tests `graph-geometry.test.ts` (every matrix row), `geometry.spec.ts`; one 3.1 test now asserts that an unknown element (`riemann`) is refused.
- Verified: `npm run check` green (1401 unit tests, 3D chunk 238 of 450 KB gzip); Playwright 470 tests green on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

Inline review (owner chose no subagents), over the diff:
- Checked: acos of a rounded ratio just past 1 (clamped, tested); a zero-length arm gives `null`, not NaN; scale 0 collapses without a throw; a hidden point hides every shape that names it; a transform keeps working when only its source polygon is hidden.
- Deferred: the labels of polygons, circles and angles are in the text list but not drawn in the picture; measure texts can overlap when shapes share a spot; the arc of an angle has a fixed size and no right-angle square.

## Design Notes

A shape is data that names points, so the one drag mechanism of 3.1 moves everything. Angle is measured at the middle point with `acos` of the clamped dot product over the lengths, in degrees; area is the absolute shoelace sum; a reflect over a line through two points uses the standard projection formula.

## Verification

**Commands:**
- `NEXT_DIST_DIR=.next-e2e npm run check` -- expected: all green
- `NEXT_DIST_DIR=.next-e2e npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
