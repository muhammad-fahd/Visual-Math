---
title: 'Story 3.1: 2D graphs (canvas2d)'
type: 'feature'
created: '2026-11-27'
status: 'review'
baseline_commit: '7d2bbaa877af199d8c620f01146785c64347c65e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-retro-2026-11-27.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The platform draws solids only. Foundation and Intermediate topics need graphs of functions, equations and inequalities with points to drag, sliders, a trace and zoom, with the features of a graph marked. And adding a second viewer today would copy half of `SolidViewer`.

**Approach:** Register `canvas2d@1` with the elements this story needs (`function`, `parametric`, `point`, `region`, `text`, `readout`; geometry elements are Story 3.2) and draw it with one pure SVG renderer. Mark intercepts, turning points and asymptotes found numerically. Draggable points and a trace are keyboard-operable feature-layer controls bound to parameters. First extract the viewer state that `SolidViewer` and the new `Canvas2DViewer` share, and let the topic page choose the viewer by scene type.

## Boundaries & Constraints

**Always:**
- Every number comes from `lib/expr`; the renderer is a pure function of `(scene, params)`; no listener in `src/scenes` (the frame owns zoom and pan; handles and the trace slider live in `features`). Colors are tokens, no hex, logical CSS.
- A value that cannot be computed is NaN and breaks the line (never a spike); a jump across an asymptote is a break; every emitted coordinate is clamped to a finite window; samples at most 1000 per element and 60 elements per scene.
- Two curves are told apart by dash and marker as well as color: a curve without a `style` gets the next of a fixed sequence (solid circle markers off, dashed with squares, dotted with diamonds, ...); a legend or a label names each.
- A draggable point's position components are exactly parameter ids (`at: ["px","py"]`, `drag: {x:"px", y:"py"}`); dragging and the arrow keys change those parameters, clamped and snapped to their range and step. A violation is E_DRAG_BINDING at upload (the check itself is Story 7.1; the viewer ignores the binding if it does not hold).
- Zoom is 0.25x to 8x of the declared `viewport`, pan only when the scene says so; `aspect: 'equal'` keeps one unit the same length on both axes. Reset view returns to the declared viewport.
- The scene has a caption, a description and a text list of what is drawn (curves, marked features, the trace value) for assistive technology; the picture is a pure component, so a thumbnail can be made by rendering it to static markup.
- Extracting the shared viewer state changes no behavior of the solid topics: every existing test still passes unchanged.

**Never:**
- No geometry elements (`segment`, `ray`, `line`, `vector`, `polygon`, `circle`, `arc`, `angleMark`: Story 3.2), no calculus elements (`riemann`, `tangent`, `secant`, `limitProbe`: Epic 4), no `complex`, `sequence`, `bars`, `table` yet; no implicit equations (an equation is drawn as `y = f(x)`); no new dependency.
- No change to the frame's input rules, the colors or the fonts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Quadratic | `a*x^2 + b*x + c`, a=1, b=-2, c=-3 | curve; x-intercepts at -1 and 3, y-intercept at -3, turning point at (1, -4), each marked and listed | N/A |
| Slider | `a` moved | curve, marks and the list update together, under 100 ms | N/A |
| Rational | `1/x` | two branches; a vertical asymptote at x=0 drawn dashed; no line across the gap | NaN and huge values break the line |
| Tangent-like | `tan(x)` | breaks at each pole; no spikes | same |
| Domain | `sqrt(x)`, `ln(x)` | line starts where defined; nothing for NaN | N/A |
| Inequality | `shade: 'below'` on `x^2 - 4`, boundary strict | region under the curve tinted, boundary dashed; non-strict is solid | N/A |
| Region | between `x` and `x^2` from 0 to 1 | the area tinted | NaN edge: no region |
| Parametric | circle `cos(t), sin(t)`, t 0 to 2*pi; sine trace `t, sin(t)` | drawn as one path; a NaN splits it | N/A |
| Two curves | two functions, no style | different dash and marker, plus a legend | N/A |
| Draggable point | `px`, `py` bound; drag or arrows | the parameters follow, snapped and clamped; live coordinates read | binding not exact: not draggable |
| Trace | trace slider or arrow keys on it | a cursor, the point on each curve and its value, in the list | NaN: "undefined" |
| Zoom and pan | frame zoom in, out, Reset view | the viewport scales about its centre (0.25x to 8x), pan only if allowed, ticks stay readable | N/A |
| Equal aspect | non-square frame | the unit lengths on the axes are equal | N/A |
| Huge values | `1e300 * x`, `x^100` | clamped, no overflow, no crash | N/A |
| Step hides an element | `hide: ["curve2"]` | that element is not drawn or listed | unknown id: ignored |
| No JS or SSR | first server render | the picture and the list are in the HTML | N/A |
| Urdu | `/ur` | frame and controls mirror; the picture, axes and numbers stay left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/features/scene/SolidViewer.tsx` (663 lines) -- extract what is not about solids into `useSceneState.ts` (parameters through `useNumberFields`, the program and scope, the step, restore, reset and changed effects in their current order, readouts and their announcements, formulas) and `SceneParts` builders (controls, results, formulas, live region); the solid file keeps tiers, Play and the picture. The effect order (step, then restore, then reset) is a contract (see `docs/coding-standard.md`).
- `src/features/scene/Canvas2DViewer.tsx` (new), `Handles.tsx` (new, draggable point handles and the trace), `viewers.tsx` (new, scene type to viewer), `src/features/topic/TopicPage.tsx` (choose the viewer; `hasPicture` becomes "a viewer exists for this type").
- `src/lib/graph/` (new, pure) -- `sample.ts` (polyline with breaks, clamp, cap), `analyze.ts` (intercepts, turning points, asymptotes), `viewport.ts` (view to viewport, data to picture, nice ticks, equal aspect), `elements.ts` (style sequence, which elements are drawn).
- `src/scenes/canvas2d/Canvas2D.tsx` (new, pure SVG), `src/lib/topic-schema/scenes/canvas2d.ts` (+ `meta.ts`, `index.ts`), `src/scenes/registry.ts` entry; `tests/unit/topic-format-doc.test.ts` gains the `canvas2d` table.
- `content/fixtures/alg-quadratic-graph.json` (new topic), messages `canvas.*`, `tests/e2e/graph.spec.ts`, docs.
- Reuse: `lib/expr`, `lib/params`, `SceneFrame` (`capabilities`, `camera`, `resetSeq`), `NumberControl`, `MathHtml`, the address and Reset all of Story 2.8.

## Tasks & Acceptance

**Execution:**
- [ ] `useSceneState.ts`, `SceneParts`, `SolidViewer.tsx` -- extract and keep behavior -- the full existing suite green
- [ ] `src/lib/graph/*` and tests -- sampling with breaks, analysis against known values, property and fuzz tests -- NFR-6.2
- [ ] schema, registry, `Canvas2D.tsx`, `Canvas2DViewer.tsx`, `Handles.tsx`, `viewers.tsx`, `TopicPage.tsx` -- the scene and its controls -- FR-3.17, FR-3.29
- [ ] fixture topic, messages, `tests/e2e/graph.spec.ts`, docs -- keyboard, drag, trace, zoom, Urdu, no-JS render

**Acceptance Criteria:**
- Given a function, equation or inequality, when drawn, then it shows with draggable points, parameter sliders, a trace and zoom, with intercepts, turning points and asymptotes marked.
- Given a parametric element, when drawn, then the sine trace and circles draw and NaN breaks the line instead of drawing a spike.
- Given two meaningful curves, when drawn, then they differ by dash and marker, not only color.
- Given the solid topics, when the viewer state is shared, then every existing test passes unchanged.
- Given `npm run check` and Playwright (Chrome and Edge), when run, then both pass.

## Implementation Notes

- Shared viewer state moved out of `SolidViewer` into `useSceneState` and `SceneParts`; the solid suite (unit and Playwright on Chrome and Edge) passes unchanged.
- `lib/graph` (viewport, sample, analyze, build) is pure; `scenes/canvas2d/Canvas2D` is a pure SVG renderer (renders to static markup, no listeners); `features/scene/{Canvas2DViewer,Handles}` hold the viewer, the trace and the draggable points. `features/scene/viewers.tsx` maps scene type to viewer, so `TopicPage` no longer names `solid3d`.
- Added `Program.fn` (expression to a plain number function) and `sceneAtStep.shown` (a step can reveal an element that starts invisible).
- Fixture `content/fixtures/alg-quadratic-graph.json`, messages `canvas.*` (en, ur; Urdu is an AI draft), `tests/unit/graph-topic.test.ts`, `tests/unit/graph-lib.test.ts`, `tests/e2e/graph.spec.ts`.
- Verified: `npm run check` green (1370 unit tests, bundle: 3D chunk 238 of 450 KB gzip); Playwright 458 tests green on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

Inline review (owner chose no subagents), over the diff:
- Fixed: turning point missed when two samples sat at the same height either side of the peak (`x^2 - 2x - 3` on -8..8); `analyze` now skips zero steps. Test added.
- Fixed: `tan` poles read as NaN because `lib/expr` returns NaN above its magnitude limit; bisection returns the bracket end.
- Deferred: the clip-path id of `Canvas2D` is a fixed prefix, so two pictures on one page would share it (one per page today); the legend swatches repeat the stroke tables of `Canvas2D`; the trace slider has 200 steps whatever the window.

## Design Notes

Equations are functions: `y = 2x + 1` and `y = a x^2 + b x + c` are `function` elements; an inequality is a `function` with `shade: 'above' | 'below'` and `strict`, or a `region`. Marked features are found numerically on the visible domain: roots by sign change refined by bisection, turning points by sign change of the central-difference slope refined by golden section, vertical asymptotes where the value blows up on both sides of a gap, horizontal asymptotes from the value at the ends of a wide range. Handles are the only pointer code of this story and live in `features`: they stop the event so the frame does not pan, and each is a focusable slider with the arrow keys.
