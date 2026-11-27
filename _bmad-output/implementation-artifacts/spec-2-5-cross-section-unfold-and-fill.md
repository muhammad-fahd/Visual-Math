---
title: 'Story 2.5: Cross-section, unfold and fill'
type: 'feature'
created: '2026-11-27'
status: 'done'
baseline_commit: '0965879e09351a02c1a9ac3f23a5776eb7e6caa1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A visitor can change a solid's measurements but cannot cut it, unfold it to see its surface, or pour into it, which is how area and volume start to make sense.

**Approach:** Add the optional `section`, `net` and `fill` fields to `solid3d@1` and draw them in the existing viewer, in all three tiers from one data path: a movable cutting plane with a side panel showing the flat shape and its measurements, an unfold that plays forward and backward with the surface-area parts beside it, and a liquid level inside the solid. Play buttons animate the parameter the scene field names; reduced motion shows the finished state and jumps instead of animating.

## Boundaries & Constraints

**Always:**
- A scene is still a pure function of `(scene, params)`. `enabled`, `offset`, `normal`, `d`, `progress` and `level` are Num (a number or an expression of parameters, via `lib/expr`); nothing new is stored outside parameters, the camera and the view toggles.
- One data path: `lib/solid` composes layers (solid, cut plane, cut face, liquid, net panels) as plain geometry; Tier A (three.js) and Tier B and C (SVG) both draw them, so the tiers cannot disagree. No new dependency, no `drei`.
- The net is a hinge tree over the real solid's faces, and the fold angles are measured from the solid, never typed: progress 0 is exactly the solid, progress 1 lies flat. The parts' areas shown beside it add up to the surface area (exact formulas, tested against `build().surface`).
- Cut face, plane and liquid use scene tokens (`section`, `curve-1`), never hex; the cut shape is named in words and measured in numbers, not by color alone.
- Animation is `requestAnimationFrame` in `features`, never in `src/scenes`; `prefers-reduced-motion` is read when Play is pressed and at start, never ignored (NFR-3.3).
- Every value stays finite and inside the picture window; a plane that misses the solid shows no cut face, not an error.

**Never:**
- No topic page layout, steps, URL state or Reset all (2.6, 2.8); no upload-stage checks of the new fields (Story 7.1); no new scene types.
- Nets for sphere, hemisphere and frustum are not offered (topic-format 2.8 lists six kinds); the schema accepts `net` only for them and a viewer shows nothing for others.
- 30 fps on a phone and touch behavior on real devices are not claimed (spike 1).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Horizontal cut of a cone | plane y = 0, r 3, h 10 | cut face is a circle of radius 1.5; side panel says "Circle", radius 1.5, area 7.1 | N/A |
| Vertical cut through the axis | plane x = 0 on a cone | triangle (base 6, height 10) | N/A |
| Cut of a cylinder | y-plane circle; x-plane rectangle | circle r; rectangle chord by height | N/A |
| Plane misses the solid | offset beyond the top | no cut face and no panel shape; the panel says the plane does not touch the solid | no throw |
| Section disabled | `enabled` 0 | no plane, no panel | N/A |
| Tilted plane | `normal` [1,1,0], `d` 0 | a polygon or ellipse, named and measured | zero normal: no cut |
| Unfold at 0, 0.5, 1 | cylinder or cone, cube | 0 is the solid, 1 is the flat net with every panel in one plane, in between is a fold | progress clamped to 0..1, NaN is 0 |
| Net parts | any supported kind | parts' areas add up to the surface area | N/A |
| Net on an unsupported kind | sphere with `net` | no net, no Play for it, no error | no throw |
| Fill | level 1/3 of a cylinder | liquid up to a third of the height; text says 33% of the volume | level clamped 0..1 |
| Play, normal motion | Play forward then backward | the named parameter runs min to max and back in about 2.5 s; Pause stops it | N/A |
| Play, reduced motion | `prefers-reduced-motion: reduce` | starts at the finished state; Play jumps between the two ends with no frames | N/A |
| Play on an expression | `progress` is `u * 2` not a bare parameter | slider works, no Play button | N/A |
| Tiers | no WebGL, light picture, lost context | section, net and fill all still draw (flat) | Tier C message as before |

</frozen-after-approval>

## Code Map

- `src/lib/solid/kinds.ts` -- `revolve` and `box` build the solids; return their rows and add `panels` (net hinge tree) for the six kinds; `Geometry` gains `panels`.
- `src/lib/solid/` (new files) -- `clip.ts` (plane clipping of polygons, cut polygon, enclosed volume), `section.ts` (plane from `section`, cut polygon in 2D, shape name and measures), `net.ts` (pose at progress, exact part areas), `layers.ts` (`composeLayers`), `project.ts` (`drawList` takes layers, keeps its old geometry form for the existing tests).
- `src/lib/topic-schema/scenes/solid3d.ts` -- add optional `section` (two forms), `net`, `fill`; `meta.ts` partIds gain `section`, `net`, `fill`; `tests/unit/topic-format-doc.test.ts` stops skipping them.
- `src/scenes/solid3d/Solid2D.tsx`, `Solid3D.tsx` -- draw layers (token color, opacity, double sided); `SectionPanel.tsx` (new, SVG flat shape).
- `src/features/scene/SolidViewer.tsx` -- evaluate the new fields, side panel, net parts list, fill text, Play and Pause, reduced motion; harness page chooses a fixture by `?topic=`.
- `content/fixtures/` -- `geo-cone-section`, `geo-cylinder-net`, `geo-cylinder-fill` topics (checked by the schema and by recompute tests like the cone).
- `src/i18n/messages/{en,ur}.json` -- `solid.section.*`, `solid.net.*`, `solid.fill.*` (Urdu are drafts).
- Reuse: `lib/params` (`createProgram`), `lib/expr`, the frame's `FrameToggle`, the 8-second tier logic. Do not change the frame or the tier rules.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/solid/{clip,section,net,layers}.ts`, `kinds.ts`, `project.ts` -- geometry for cut, liquid and net, known-value and property tests -- NFR-6.2
- [x] `src/lib/topic-schema/scenes/solid3d.ts`, meta, doc test -- the three optional fields -- AD-2
- [x] `src/scenes/solid3d/*` -- layers in both tiers, `SectionPanel` -- AD-13
- [x] `src/features/scene/SolidViewer.tsx`, harness page, fixtures, messages -- controls, panel, parts list, Play, reduced motion -- FR-3.10 to 3.12, NFR-3.3
- [x] `tests/e2e/solid.spec.ts` (and a unit file per library), docs -- browser tests including reduced motion and no WebGL

**Acceptance Criteria:**
- Given a cone with a cutting plane parameter, when the visitor moves the plane, then the cut face, the named flat shape and its measurements in the side panel change together.
- Given a cylinder with a net, when Unfold plays forward and backward, then every panel moves about its hinge, the flat state has all panels in one plane, and the parts listed add up to the surface-area formula's value.
- Given a fill level of one third on a cylinder, when it is shown, then the liquid reaches a third of the height and the text states the share of the volume.
- Given `npm run check` and Playwright (Chrome and Edge), when run, then both pass.

## Implementation Notes

- Files: `src/lib/solid/{clip,section,net,layers}.ts` and `kinds.ts` (`panels`, `netParts`), `project.ts` (`drawLayers`), `src/scenes/solid3d/{Solid3D,Solid2D,SectionPanel}.tsx`, `src/features/scene/SolidViewer.tsx`, the schema fields, three fixtures (`geo-cone-section`, `geo-cylinder-net`, `geo-cylinder-fill`), messages, harness `?topic=`.
- Decisions: Play animates the parameter a field names (bare id only); reduced motion starts at the finished state and Play jumps; offsets are from the solid's centre; a section or fill draws the solid see-through; fill level is a fraction of the height and the share of the volume is computed from the mesh.
- Surprises: Playwright and `next dev` cannot share `.next`; added `NEXT_DIST_DIR` for an isolated build. The net root matters visually (cylinder).
- Not done on purpose: no `PerformanceMonitor` (spike 1), no nets for frustum, sphere, hemisphere, no real-device run.
- Tests: 1190 unit and 298 browser tests (Chrome and Edge) pass.

## Spec Change Log

## Review Triage Log

Inline review (no subagents, the owner's choice), plus what only a real browser showed: screenshots of all three scenes in both tiers and a full Playwright run on Chrome and Edge. Each claim checked against the code or reproduced.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| The cylinder net rooted on a side quad lay in a near-vertical plane, so its discs looked squashed edge-on | medium | patch: rooted on the bottom disc, the net lies on the ground plane like a textbook net; tests unchanged (they check flatness, joins and overlap, not the root); found in the screenshot |
| A net the solid cannot have (a sphere with `net`) still showed Unfold and Fold | medium | patch: Play for the net needs `panels`; render test |
| Animated values were not on the parameter's step grid, so the typed box read 0.41999 | low | patch: each frame is `snap`ped |
| The Play row appeared only through e2e counting polygons and lines together (226 not 34); `Fold` also matched `Unfold` | low | test fix: count polygons, exact button names |
| `next build` into `.next` while `next dev` runs corrupts the dev cache (the owner hit "unexpected Turbopack error") | medium | patch: `distDir` from `NEXT_DIST_DIR`, the check scripts and tests honour it, `.next-*` ignored by git, eslint and the harness scan; documented |
| The side panel names a cut "Radius 1.5, Area 7.1, Distance round 9.4": the area and distance of a 32-gon cut come from the exact circle, not the mesh | low | accept: a circle is measured as a circle; rectangles and triangles use the mesh and are within 0.5% on a cylinder |
| Cone cut off its axis is named "Curved shape" (it is a hyperbola arc and a chord) | low | accept: no conic names beyond circle and ellipse in version 1 |
| `section.plane.offset` is from the centre of the solid, which is not how an author thinks of "height from the base" | medium | defer: documented in `topic-format.md` when it is reconciled; authors use `offset = height - h/2` meanwhile |
| Dimension lines are hidden while a net is open | low | accept: they belong to the folded solid |
| The picture is fitted to the whole flat net, so the folded solid looks small | low | accept: keeps the scale steady while it plays; a topic may zoom with `camera` |
| Painter's sort with two-sided panels can mis-order two panels in the middle of a fold | low | accept: only mid-animation, only in the flat tier; Tier A depth-tests |
| Nets for `frustum`, `sphere`, `hemisphere` | low | out of scope by the spec (topic-format lists six kinds) |
| Real-phone speed of the net animation (34 panels rebuilt per frame) | medium | defer: spike 1 |

## Design Notes

Net: every panel keeps its folded position at progress 0. A child rotates about its hinge (the edge it shares with its parent, in the parent's current frame) by `progress` times the angle that makes it coplanar with the parent, the sign found by testing both. So the pose is a chain of rotations; nothing is stored. Cylinder: the strip of 32 quads is a chain, the two discs hang from the first quad; cone: the 32 side triangles are a chain from the base. Part areas are exact formulas, not the mesh's.

Section: the solid is a convex mesh, so the cut polygon is the plane's intersection with each face, ordered around its centroid in the plane. The shape is named from the polygon (circle when all points sit at one distance from the centre, rectangle or square at four right angles, triangle at three, ellipse for a smooth cut that is not a circle, else a polygon of n sides). Offsets are measured from the centre of the solid.

Play: animates the parameter when the scene field is a bare parameter id, forward to its max and back to its min.
