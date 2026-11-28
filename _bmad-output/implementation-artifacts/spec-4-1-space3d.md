---
title: 'Story 4.1: 3D axes, vectors, lines and planes (space3d)'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: '29108dabb850305b709db66d72368dc0b0c3b0c6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Advanced vector topics (3D vectors, dot product, lines and planes, systems as planes) have no scene: the only 3D scene draws a solid. A visitor cannot see vectors add, scale or cross in space, or turn a line or a plane.

**Approach:** A new registered scene type `space3d@1`: 3D axes holding points, vectors, derived vectors (sum, scaled, cross), a dot-product display (value, angle, projection), lines and planes, all drawn from the topic's parameters. One pure drawing model feeds both the three.js picture (Tier A) and the SVG picture (Tier B and C). Everything is edited with sliders and typed boxes.

## Boundaries & Constraints

**Always:** Declarative JSON validated by `space3d@1`; every number is a number or an expression of the topic's parameters and derived values (`lib/expr` only, never executed text). Elements, each with an id a step may show or hide: `point`, `vector` (from, to, optional label), `op` (`add` of two or more vectors drawn tip to tail with the sum from the origin, `scale` of one vector by an expression, `cross` of two), `dot` (of two vectors: the value, the angle between them in degrees, and the projection of the first on the second), `line` (a point and a direction, drawn across the axes box), `plane` (a normal and a distance, drawn as a see-through patch with its normal). Fixed parts `axes`, `grid` (the floor) and `box`. Axes range is a number (default 6) and the camera is a preset or angles, as on the solids. Zero vectors, parallel vectors (cross zero, angle undefined), a zero normal, a zero direction and values past the axes box never give NaN geometry: they are skipped or clamped and the text says so. A readout line shows the live numbers (components, length, dot, angle, cross, the sum) and the text description lists every element in words, updating as the sliders move. Tier A is three through one lazily loaded file, never in a barrel; Tier B (the visitor's "light" choice) and Tier C (no WebGL, with a message) draw the same geometry with the same `project()` as SVG. Demand rendering, no shadows, within the 450 KB gzip chunk budget. Axes, labels and numbers stay left to right in Urdu. A static 2D picture of the scene at its start values exists (`static2D`). Colors are tokens; a vector's look differs by dash and label, not by color alone; logical CSS; all text through the message files in both languages.

**Never:** No dragging in the picture (editing is sliders and typed boxes; the frame only rotates, zooms and pans the view). No surfaces (4.5), no matrices (4.4), no solids of revolution (4.3). No new input listener under `src/scenes` outside the frame. No second WebGL library, no drei. No physical CSS.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add | a = (1,2,0), b = (3,-1,2) | sum (4,1,2) drawn tip to tail and from the origin; readout lists it | N/A |
| Scale | v = (1,2,3), k = -2 | arrow (-2,-4,-6), length doubled and reversed | N/A |
| Cross | a = (1,0,0), b = (0,1,0) | (0,0,1) drawn from the origin; length equals area of the parallelogram | Parallel: zero vector, no arrow, text says "parallel, cross is zero" |
| Dot | a = (1,2,3), b = (4,-5,6) | 12, angle about 77.4 degrees, projection arrow | Either zero: angle "not defined", no projection |
| Line | point (0,0,0), direction (1,1,1) | segment across the axes box, clipped to the box | Zero direction: not drawn, text says so |
| Plane | normal (0,0,1), d = 2 | patch at z = 2 with its normal arrow | Zero normal: not drawn, text says so |
| Far value | component 1e9 | clamped inside the window, no NaN, no throw | N/A |
| No WebGL | context unavailable | Tier C: message and the SVG picture, sliders work | N/A |
| Light choice | visitor picks light | Tier B SVG, same geometry as Tier A | N/A |
| Steps | Step hides an element | Hidden element absent from picture, text and readout | Unknown id fails upload |
| Urdu | `/ur` | Words in Urdu, axes and numbers left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/{solid3d,meta,index,common}.ts` -- schema pattern, `SOLID3D_META`, `SCENE_DEFINITIONS`; add `space3d.ts` and `SPACE3D_META` (parts `axes`, `grid`, `box` plus the topic's element ids, as `canvas2d`)
- `src/lib/solid/{clip,project,layers,kinds,scene}.ts` -- reuse `dot`, `cross`, `length`, `planeFrom`, `basis`, `project`, `drawList`, `WINDOW`; `scene.ts` shows evaluating expressions through `program` and `scope`
- `src/lib/space/` (new) -- pure build of the drawing model: segments, arrowheads, patches, points, labels, the readout numbers; reuse the pattern of `lib/trig`, `lib/graph`
- `src/scenes/solid3d/{Solid3D.tsx,Solid2D.tsx,tier.ts,index.ts}` -- the only three import, lazy load, tiers, `Solid2D` axes layer; `src/scenes/frame/*` -- camera, views, keys
- `src/features/scene/{SolidViewer,viewers,static2d,SceneParts,useSceneState}.tsx` -- viewer pattern, the one-line registry, `STATIC2D_TYPES` and its switch, shared parameter state
- `src/features/scene/Handles.tsx` -- 2D handle pattern (not used here)
- Lists to update: `tests/unit/{scene-registry,topic-format-doc,static2d,topic-schema}.test.ts` (`topic-schema.test.ts` uses `space3d` as the example of an UNKNOWN type: change the example), the architecture `topic-format.md` (a `### 2.x space3d` section and its tables), `eslint.config.mjs` exemptions if any, `docs/coding-standard.md`
- `scripts/check-bundle.mjs` -- 3D chunk budget; `tests/e2e/solid.spec.ts` -- harness and `watchThree`; `src/app/[locale]/dev/solid/page.tsx` -- harness pattern; fixtures under `content/fixtures/`
- Never `src/features/scene/Handles.tsx` for 3D, never `OrbitControls` or any listener in `src/scenes`

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/topic-schema/scenes/space3d.ts`, `meta.ts`, `index.ts` -- the schema and registry entry
- [x] `src/lib/space/*` -- pure model: evaluate elements, derived vectors, dot, lines clipped to the box, plane patches, readout numbers and the text, finite and clamped
- [x] `src/scenes/space3d/{Space3D.tsx,Space2D.tsx,index.ts}` -- three renderer (lazy, not in the barrel) and the SVG renderer from the same model
- [x] `src/features/scene/SpaceViewer.tsx`, `viewers.tsx`, `static2d.tsx` -- viewer with tiers, parameters, readouts, description; one line in the map; `static2D` case
- [x] `src/i18n/messages/{en,ur}.json` -- space words
- [x] `content/fixtures/vec-3d-vectors.json`, `vec-3d-lines-planes.json` -- two fixture topics (add and scale with steps; dot and cross; a line and a plane)
- [x] `tests/unit/*`, `tests/e2e/space.spec.ts` -- known values for every operation, every matrix row, both languages and tiers; bundle and no-three-on-2D checks
- [ ] topic-format document, registry and format-doc test lists, `docs/coding-standard.md`, sprint status, deferred work

**Acceptance Criteria:**
- Given vectors, when a parameter changes, then the sum, scaled vector, dot product (value, angle, projection) and cross product update live in the picture, the readout and the text.
- Given a line or a plane, when its parameters change, then it turns and moves, and the text states what it is.
- Given a device without WebGL, when the topic opens, then a message and the same geometry appear as an SVG picture.

## Implementation Notes

- Built as specified, with these decisions: coordinates are math (z up) drawn at (y, z, x); an element's look comes from its order; a vector is a thin prism in Tier A (a WebGL line is one pixel); `useTier` and `TierNotices` were extracted from `SolidViewer` so both 3D viewers share one tier state machine.
- The two fixtures (`vec-3d-vectors`, `vec-3d-lines-planes`) are in the topic harness page only, not in the fixture tree of the library pages, so the Epic 5 counts do not change.
- The architecture's `topic-format.md` already had a planned `space3d` section (`point3`, `vector3`, `segment3`, `line3`, `plane3`, `polygon3`, `box3`, `text3`, `drag`). Section 2.9 now describes what was built; the unbuilt element types are noted there as additions that need no change to these.
- The unit tests of the field table, the registry lists and the static picture were updated; `topic-schema.test.ts` used `space3d` as its example of an unknown type, now `surface3d`.
- Checks: `npm run check` green (1,877 unit tests, the 3D chunk still 238 KB gzip of 450 KB); Playwright 712 on chrome-111 and edge-111, 38 of them for this scene. A screenshot check (Tier A, light, Urdu, phone) found the vectors too thin in Tier A and led to the prisms.
- No reviewer agents on this story: they run once at the end of Epic 4, as for Epic 5.

## Spec Change Log

- Frozen matrix, row "Dot": the example `a = (1,2,3)`, `b = (4,-5,6)` gives a dot product of 12 (correct) and an angle of about 68.6 degrees, not "about 77.4": the arithmetic in the matrix was wrong (acos(12 / sqrt(14 x 77)) = 68.56). The frozen block is not edited; the tests and the code use the correct value. Found while writing the known-value test.

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build, static-route and bundle checks pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
