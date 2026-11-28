---
title: 'Story 4.3: Calculus scenes (2D)'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'f2bdae328b25bc404e9aa3a4916b7157a5bc1742'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Calculus launch topics (rates of change as slope, limits by zooming in, the derivative as the slope of a tangent, Riemann sums and the integral) have no scene support. The graph scene draws curves, but has no tangent, no derivative graph, no secant, no limit probe, no Riemann rectangles and no value for the area under a curve.

**Approach:** Add the elements the architecture plans to `canvas2d@1` (topic-format 2.3): `tangent`, `derivative` (the derivative graph, linked to the tangent by a marker and a guide), `secant`, `limitProbe`, `riemann`, and a `measure` for `region` that gives the area. One pure module (`lib/graph/calculus.ts`) does the numerics. Every number is in the text list. Solids of revolution (`revolution3d`) are split off to their own story, by the owner's choice.

## Boundaries & Constraints

**Always:** `tangent`: `fn` (expression of `x`), `at`, optional `length`, `drag?: {x: id}` (the marker slides along the curve when `at` is exactly that parameter, with the same keyboard handle as a `point`), `label`; draws the line through (at, f(at)) with slope by central difference (h = 1e-5) and a marker on the curve. `derivative`: `fn`, optional `domain`, `samples`, `at`, `label`; draws the graph of f', and with `at` a marker at (at, f'(at)) joined by a dotted vertical guide to the point of f at the same x, so the slope of the tangent and the height of the derivative graph are seen to be the same number. `secant`: `fn`, `x1`, `x2`; the line through the two points on the curve and their slope (undefined when x1 equals x2). `limitProbe`: `fn`, `approach`, `h`; marks f at approach minus h and plus h, an open circle at the limit when both sides agree (also where f is not defined at the point); says "the two sides differ" when they do not. `riemann`: `fn`, `from`, `to`, `n` (a number or an expression, whole, 1 to 200), `method` left, right, mid or trapezoid; draws the rectangles (or trapezoids) and gives the sum. `region` gains `measure: true`: the area of the region (the integral of the top minus the bottom, by composite Simpson with 1000 intervals). Known values hold: the area under x^2 from 0 to 3 is 9; sin from 0 to pi is 2; 1/x from 1 to e is 1; the left, right, mid and trapezoid sums of x^2 on [0, 3] with 3 rectangles are 5, 14, 8.75 and 9.5; the derivative of x^2 at 3 is 6; the limit of sin(x)/x at 0 is 1. A riemann sentence also gives the exact area so the error is seen. A value that is not finite, a bad `n` or an undefined point leaves that element out and the text says so. Limit by zooming in is the frame's zoom and viewport expressions, as today. Both languages; tokens only; nothing new listens to input. `static2D` draws all of it through the same drawables.

**Never:** No `revolution3d` and no 3D here. No symbolic derivative or integral (numerics only, expressions stay `lib/expr`). No new input listener. Existing `canvas2d` topics and fixtures are unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tangent | x^2 at 3 | line of slope 6 through (3, 9), marker on the curve | N/A |
| Tangent at a corner | |x| at 0 | slope not defined, no line, text says so | N/A |
| Derivative graph | x^2, at 3 | curve of 2x; marker at (3, 6); guide up from (3, 9) | N/A |
| Secant | x^2 from 1 to 3 | line of slope 4; markers at both points | x1 = x2: slope not defined, no line |
| Limit, both sides agree | sin(x)/x, approach 0, h 0.1 | open circle at (0, 1); sides 0.998 and 0.998 | N/A |
| Limit, sides differ | abs(x)/x at 0 | no circle; text "the two sides differ" | N/A |
| Hole in the curve | (x^2 - 1)/(x - 1) at 1 | open circle at (1, 2) | N/A |
| Riemann | x^2 on [0, 3], n 3 | left 5, right 14, mid 8.75, trapezoid 9.5; exact 9 | n 0, 201, 2.5: left out, named |
| n from a slider | n expression | follows the slider | N/A |
| Area | region x^2 and 0, 0 to 3, measure | 9 | f not finite on the interval: area not defined |
| Huge or odd | 1/x across 0 | no NaN geometry; text says not defined | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/canvas2d.ts` -- element union; add the five elements and `region.measure`
- `src/lib/graph/build.ts` -- `Element`, `Drawables`, `ComplexFact` pattern, the `region`, `function` and `point` cases, `program.fn`; add the cases and a calculus fact list
- `src/lib/graph/{sample,geometry,index}.ts` -- `sampleFunction`, `clipLine`; new `src/lib/graph/calculus.ts` (central difference, Simpson, Riemann sums, limit)
- `src/scenes/canvas2d/Canvas2D.tsx` -- shapes and markers; add an open marker
- `src/features/scene/{Canvas2DViewer,Handles}.tsx` -- text list, drag handles (a marker bound to `x` only)
- `src/features/scene/static2d.tsx` -- passes the drawables through
- Lists and docs: `tests/unit/{graph-lib,graph-topic}.test.ts`, topic-format 2.3 (rows exist and differ), `docs/coding-standard.md`; fixtures and the topic harness page; `tests/e2e/graph.spec.ts` and `complex.spec.ts` patterns

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/graph/calculus.ts` -- derivative, Simpson integral, Riemann sums, limit estimate, pure
- [ ] `src/lib/graph/build.ts`, `index.ts`, `src/lib/topic-schema/scenes/canvas2d.ts` -- the elements, `region.measure`, the facts, the schema
- [ ] `src/scenes/canvas2d/Canvas2D.tsx` -- the open marker
- [ ] `src/features/scene/Canvas2DViewer.tsx`, messages -- the sentences in both languages
- [ ] `content/fixtures/calc-*.json` (tangent and derivative, limit, Riemann), harness page -- three fixture topics
- [ ] `tests/unit/*`, `tests/e2e/calculus.spec.ts` -- the known values and every matrix row, drag and keyboard, both languages, phone
- [ ] topic-format 2.3, `docs/coding-standard.md`, sprint status, deferred work

**Acceptance Criteria:**
- Given a tangent, when its point is moved by a parameter or by keyboard or pointer, then the tangent, its slope and the marker on the derivative graph move together.
- Given Riemann sums, when `n` changes, then the rectangles and the sum follow and the exact area is shown beside it.
- Given known integrals, when shown, then the values match (9 for x^2 from 0 to 3).

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build, static-route and bundle checks pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
