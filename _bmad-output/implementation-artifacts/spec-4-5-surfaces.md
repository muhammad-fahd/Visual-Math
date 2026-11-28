---
title: 'Story 4.5: Surfaces z = f(x, y) (S)'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: 'b09e9edeb94f7dd4041ab8533bf1a147135074ca'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No scene draws a surface z = f(x, y). No wave 1 topic needs one (priority S, FR-3.23), but later Advanced topics (paraboloids, saddles, partial derivatives, level curves) will.

**Approach:** Add the scene type `surface3d@1`. Pure `lib/surface` samples the expression on an n by n grid and builds a `SpaceModel` (axes from `buildSpace`, the surface as quads, a wire grid on top), so the existing `Space3D` (lazy) and `Space2D` renderers draw it and no new three.js file is added. Rotation, zoom and the sliders come from the scene frame and the parameters. An optional `probe` point on the surface reads out z and the two slopes.

## Boundaries & Constraints

**Always:** Scene fields: `expr` (z as an expression of `x`, `y` and the topic's parameters), `x` and `y` windows `[from, to]` (Num, default -3 to 3), `grid?` (whole number 6 to 32, default 20), `range?` (half the side of the axes box, 1 to 50, default 6; z is clamped to the box and a count of clamped points is said in the text), `probe?: { x: Num, y: Num }` (a mark on the surface with z, ∂z/∂x and ∂z/∂y by central difference H=1e-5; no slopes where f is undefined or has a jump), `showWire?` (default true), `camera?` as in space3d. Parts for steps: `surface`, `wire`, `probe`, `axes`, `grid`, `box`. A point where f is not finite is a hole: its quads are left out and the count is named in the text. Facts: lowest and highest z, z at the probe, the slopes, holes, clamped points. The surface and the wire differ by fill and line, never by color alone; colors are tokens. Known values hold: z = x² + y² has z 8 at (2, 2) with slopes 4 and 4; z = x·y has slopes y and x; z = 5 is flat with slopes 0 and 0; sqrt(x) on a window from -1 has holes. Every number is in the text list too, English and Urdu, diagram left to right. Cost: at most 32 by 32 samples, 1024 quads; the expression is checked by `lib/expr` only. `static2D` draws it. No new third-party code.

**Never:** No contour or level-curve drawing, no implicit surfaces, no parametric surfaces (a separate story), no dragging the probe on the picture (sliders and typed boxes only). No new file importing three. A topic's expression is data and is never evaluated as code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Paraboloid | x^2+y^2, probe (2,2) | bowl, z 8, slopes 4 and 4 | N/A |
| Saddle | x*y | saddle, slopes y and x at the probe | N/A |
| Flat | 5 | a flat sheet, slopes 0 | N/A |
| Parameter | a*x^2+y^2, slider a | the surface follows the slider | N/A |
| Hole | sqrt(x), window -1 to 1 | left half missing, hole count in the text | undefined points left out |
| Tall | x^2+y^2 with range 2 | clamped at the box, clamped count in the text | no NaN reaches the renderer |
| Cusp | abs(x) at x = 0 | z 0, no slope for x said in words | slopes null at a corner or jump |
| Bad window | from >= to, or non-finite | default window, said in the text | refused at validation if numbers |
| Big grid | grid 500 | refused at validation (6 to 32) | clear error |

</frozen-after-approval>

## Code Map

- `src/lib/params/scope.ts` -- add `fn2(source, [a, b], scope)` to `Program` (two variables), with a cache like `fn`
- `src/lib/surface/{index,build}.ts` -- new pure module: sampling, holes, clamp, central-difference slopes, `buildSurface` -> `{ facts, space }` via `buildSpace` plus patches and segments (the pattern of `lib/matrix/build.ts` 3D part)
- `src/lib/topic-schema/scenes/{surface3d,meta,index}.ts` -- strict schema (kit), `SURFACE3D_META`, registered in `SCENE_DEFINITIONS` and `SCENE_META`
- `src/features/scene/{SurfaceViewer,viewers,static2d,index}.tsx` -- viewer on `useSceneState`, `useTier`, `Space3D` dynamic import, `Space2D`; copy `MatrixViewer`'s 3D branch; sentences from facts
- `src/i18n/messages/{en,ur}.json` -- `surface.*`; `content/fixtures/sf-*.json` (paraboloid with probe, saddle, a slider) and harness keys
- Tests and docs: `tests/unit/surface.test.ts`, `tests/e2e/surface.spec.ts`, `scene-registry`, `topic-schema`, `static2d`, `topic-format-doc` lists, scene-frame-harness allowlist, topic-format section, `docs/coding-standard.md`

## Tasks & Acceptance

**Execution:**
- [x] `lib/params` `fn2` and `lib/surface/*` -- numerics and model with the known values
- [x] schema, meta, registries -- the scene type validated, bad grid or window refused
- [x] `SurfaceViewer`, `static2d`, `viewers.tsx` -- drawing through `Space3D`/`Space2D`, readouts, words, steps, tiers
- [x] messages, three fixtures, harness page
- [x] unit tests (every matrix row), e2e (rotation exists, slider, steps, Urdu, phone, no chunk for 2D pages), docs, sprint status, deferred work

**Acceptance Criteria:**
- Given a surface, when shown, then it is drawn in 3D (Tier A) or flat (Tier B), with the same words either way, and the frame's rotation and zoom work (FR-3.23).
- Given a parameter in the expression, when its slider moves, then the surface, the probe and the words follow together.
- Given known functions, when shown, then z and the slopes match (8 at (2,2) with slopes 4 and 4; flat is 0).
- Given undefined points or a tall surface, when shown, then holes and clamped points are left out or clamped and named, with no NaN drawn.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build, static-route and bundle checks pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
