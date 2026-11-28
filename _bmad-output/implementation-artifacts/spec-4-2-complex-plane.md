---
title: 'Story 4.2: Complex plane'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'ff8d2789cc45f5a9ddd3dc5424809d443a49f4c4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Complex Numbers topics (plot and add, multiplication as rotation and scaling, roots of unity and De Moivre) have no scene. `canvas2d` can draw points and segments, but has no arrow, no modulus or argument, and an author would have to write every complex product, power and root by hand as real expressions.

**Approach:** As the architecture plans (topic-format 2.3 and the category cover table), the Argand diagram is two new element types of `canvas2d@1`, not a new scene type: `complex` (a number as an arrow and a draggable point, with its polar form) and `complexOp` (add, multiply, conjugate, power, roots). They reuse the viewport, axes, handles, steps, readouts, address and static picture of `canvas2d`. The numbers are computed by one pure module and read out in the text.

## Boundaries & Constraints

**Always:** `complex`: `re`, `im` (numbers or expressions), optional `drag: {x?, y?}` (the parameters its coordinates are, with the same rule and the same keyboard handle as a `point`), `snap`, `label`, `polar` (the modulus and the argument arc to the real axis). It draws an arrow from the origin and a marker at its tip. `complexOp` names earlier or later `complex` ids or other ops in `of`: `add` (two: the parallelogram with dashed copies and the sum from the origin), `mul` (two: the product from the origin, the argument of the first and the turn by the argument of the second as arcs, and the scale factor in the text), `conj` (one: the reflection in the real axis), `power` (one, `n` 2 to 12: z, z squared, up to z to the n as marks on the spiral they make), `roots` (one, `n` 2 to 16: the n-th roots as marks, the circle they lie on and the regular polygon they make; the roots of unity are the roots of a fixed number 1). Argument in degrees in (-180, 180]; undefined for 0 (no arc, the text says so). A hidden `complex` or op still feeds the ones built on it (a step may show only the product). Every number the figure shows is in the text list and the live announcement: the number as a + bi, its modulus and argument, and for each op the result and why (arguments add, moduli multiply, De Moivre). A value that is not finite, a missing id, or a result past 1e6 leaves that element out and the text says so. Arrows keep their head only when the tip is in the window. Both languages; tokens only; the diagram stays left to right. `static2D` draws the new elements through the same drawables. Existing `canvas2d` topics and fixtures are unchanged.

**Never:** No new scene type, no `complex` arithmetic in `lib/expr` (the module is `lib/graph/complex.ts`). No new input listener (the existing handles are reused). No complex-valued functions or domain colouring. No matrices (4.4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Polar form | z = 3 + 4i | modulus 5, argument 53.13 degrees, arrow and arc | N/A |
| Argument range | z = -1, z = -i, z = 1 - i | 180, -90, -45 degrees | N/A |
| Zero | z = 0 | modulus 0, argument not defined, no arc | N/A |
| Add | (1 + 2i) + (3 - i) | 4 + i; parallelogram; sum from the origin | N/A |
| Multiply | (1 + i)(1 - i), i times i | 2; -1; moduli multiply, arguments add | N/A |
| Conjugate | 3 + 4i | 3 - 4i, reflected in the real axis | N/A |
| Power | z = i, n = 4 | i, -1, -i, 1: four marks on the unit circle | z with modulus over 1 may leave far marks out |
| Roots of unity | z = 1, n = 6 | six marks 60 degrees apart on the unit circle, a regular hexagon | N/A |
| Roots of z | z = -8, n = 3 | modulus 2; 60, 180, -60 degrees | z = 0: all roots are 0, text says so |
| Drag | param bound to `re` | handle moves the number; keyboard arrows nudge | Not draggable unless `re` is exactly the parameter |
| Missing id | `of` names nothing | element left out, text names it | N/A |
| Huge | 1e300, power 12 | left out, text says so, nothing NaN | N/A |
| Hidden | step hides z | z not drawn, op built on it still draws | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/canvas2d.ts` -- the element union; add `complex` and `complexOp` (the schema file says calculus and other elements "arrive with Epic 4 as additions to the `type` union")
- `src/lib/graph/build.ts` -- `Element`, `Drawables`, `DrawShape`, the point and shape cases; add the two cases, an `arrow` flag on a `line` shape and a `complex` facts list
- `src/lib/graph/geometry.ts`, `index.ts` -- `angleAt`, `clipLine`, exports; new `src/lib/graph/complex.ts` (pure math: add, multiply, conjugate, polar, power, roots)
- `src/scenes/canvas2d/Canvas2D.tsx` -- `ShapeView` draws a `line` and an `angle`; add the arrowhead
- `src/features/scene/{Canvas2DViewer,Handles}.tsx` -- text list, points with `drag`, handles; add the complex sentences
- `src/features/scene/static2d.tsx` -- passes the drawables through, nothing new expected
- Lists and docs: `tests/unit/{graph-lib,graph-topic,topic-format-doc}.test.ts`, topic-format 2.3 (the `complex` row exists and differs; add `complexOp`), `docs/coding-standard.md`
- Fixtures: `content/fixtures/` (new Argand topics) and the topic harness page; `tests/e2e/graph.spec.ts` pattern

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/graph/complex.ts`, `build.ts`, `geometry.ts`, `index.ts` -- the numbers, the two cases, the arrow flag, the facts
- [x] `src/lib/topic-schema/scenes/canvas2d.ts` -- schema for `complex` and `complexOp`
- [x] `src/scenes/canvas2d/Canvas2D.tsx` -- arrowhead on a `line` shape
- [x] `src/features/scene/Canvas2DViewer.tsx` -- sentences for the facts, in both languages
- [x] `src/i18n/messages/{en,ur}.json` -- complex words
- [x] `content/fixtures/cx-argand-arithmetic.json`, `cx-roots-powers.json`, harness page -- two fixture topics
- [x] `tests/unit/*`, `tests/e2e/complex.spec.ts` -- known values for every row, drag and keyboard, both languages, phone
- [ ] topic-format 2.3, `docs/coding-standard.md`, sprint status, deferred work

**Acceptance Criteria:**
- Given an Argand diagram, when a number is dragged or its slider moves, then its arrow, polar form, and every sum, product, power and root built on it update live in the picture and in the text.
- Given roots of unity, when n changes, then the n marks, the circle and the polygon follow.
- Given a number of zero or a value that cannot be drawn, when shown, then nothing is NaN and the text says what is left out.

## Implementation Notes

- Built as specified: `complex` and `complexOp` are elements of `canvas2d@1`, with `lib/graph/complex.ts` for the arithmetic, an `arrow` flag on a `line` shape, `ComplexFact`s in the drawables and the sentences in `Canvas2DViewer`. `n` of an op is a number or an expression (a slider can set the number of roots), and must come out a whole number.
- Found by the screenshots: the repeated marks of a power or roots op shared one id, so React kept ghost marks from the previous render; marks are now `{id}-{k}` and the shape list is keyed by index. The label of the argument first showed `theta` and `circ` (the plain form of LaTeX has no theta or degree sign): it is now a text label, `θ = 26.57°`.
- The fixtures `cx-argand-arithmetic` and `cx-roots-powers` are in the topic harness page only. The architecture's `topic-format.md` 2.3 rows for `complex` (it had `showPolar`) and `complexOp` now describe what was built.
- No reviewer agents on this story: they run once at the end of Epic 4.
- Checks: `npm run check` green (1,938 unit tests, the 3D chunk unchanged at 238 KB gzip); the complex spec (14 tests) passes on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build, static-route and bundle checks pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
