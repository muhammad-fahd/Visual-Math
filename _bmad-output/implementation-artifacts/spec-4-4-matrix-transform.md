---
title: 'Story 4.4: Matrix transformations (required for launch)'
type: 'feature'
created: '2026-11-28'
status: 'done'
baseline_commit: '5a377eac65bd122e22985c27df6a007655e7aa36'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three launch topics (Matrices as transformations of the plane, Determinant as area, Eigenvectors on a grid) have no scene. No scene type shows a matrix acting on a grid or a solid, or the determinant as an area or a volume (FR-3.27).

**Approach:** Add the scene type `matrix-transform@1` (topic-format 2.13). Pure `lib/matrix` does the arithmetic and builds one drawing model. `dim: 2` is drawn flat by a small SVG renderer. `dim: 3` builds a `SpaceModel` and reuses the `space3d` renderers (`Space3D` lazy, `Space2D` static), so no new three.js file is added. The original shape stays as a faint ghost beside the transformed one, and a `progress` number (0 is the identity, 1 is the matrix) lets a slider or a step morph one into the other.

## Boundaries & Constraints

**Always:** Scene fields: `dim` 2 or 3, `matrix` (2x2 or 3x3 of Num, each a number or an expression of the parameters, so the entries are sliders and typed boxes), `shape` `unitSquare`, `unitGrid`, `triangle`, `letterF` (2D) or `unitCube` (3D only, refused with `dim: 2`; the 2D shapes are refused with `dim: 3` except `unitGrid`, drawn as the cube's three coordinate planes), `showBasis?` (the images of e1, e2, e3 as arrows with labels), `showDeterminant?` (the area or volume readout), `progress?: Num` (0 to 1, default 1), `showEigen?: boolean` (2D only: the lines of the real eigenvectors with their eigenvalues; none, and a sentence saying so, when the eigenvalues are complex; every direction when the matrix is a multiple of the identity), `camera?` for 3D as in space3d, `range?`. Parts for steps: `shape`, `basis`, `determinant`, `eigen`, `grid`. The determinant is signed: its absolute value is the area (volume) scale and a negative sign says the shape is flipped. A determinant of 0 says the shape is flattened to a line (a plane in 3D) and the readout says "0". The transformed shape is the shape's points times M(progress) = I + progress (M - I), so the area at any progress is det M(progress) times the original area (checked in tests). Known values hold: [[2,0],[0,3]] on the unit square has area 6; [[1,1],[0,1]] has determinant 1 (area kept); [[0,1],[1,0]] has determinant -1 and flips; [[2,1],[1,2]] has eigenvalues 3 and 1 with eigenvectors (1,1) and (1,-1); the cube under diag(1,2,3) has volume 6. Every number is also in the text list (matrix, determinant, images of the basis vectors, eigenvalues), in English and Urdu, the diagram left to right. A value that is not finite is left out and named. Colors and lines are tokens; two things never differ by color alone (ghost dashed, result solid). Nothing new listens to input beyond the existing sliders. `static2D` draws it. No new third-party code.

**Never:** No matrix inverse or general eigen-decomposition in 3D (2D only, closed form). No dragging of the matrix entries on the picture (typed boxes and sliders only). No new three.js importing file: only `Space3D.tsx` imports three. A topic's matrix is data; it is never evaluated as code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stretch | [[2,0],[0,3]], unitSquare | rectangle 2 by 3, determinant 6 | N/A |
| Shear | [[1,1],[0,1]] | parallelogram, determinant 1, area unchanged | N/A |
| Reflection | [[0,1],[1,0]] | determinant -1, text says flipped | N/A |
| Rotation | [[cos a, -sin a],[sin a, cos a]] with a a slider | determinant 1, grid turns; no real eigenvectors | complex eigenvalues: sentence |
| Singular | [[1,2],[2,4]] | shape collapses to a line, determinant 0, text says so | N/A |
| Eigen | [[2,1],[1,2]], showEigen | lines along (1,1) and (1,-1), eigenvalues 3 and 1 | N/A |
| Repeated | 2I, showEigen | every direction is an eigenvector, said once | N/A |
| Morph | progress 0 then 1 | identity then the matrix; ghost always the original | progress outside 0..1 clamped |
| Cube | diag(1,2,3), unitCube | box 1 by 2 by 3, volume 6 | N/A |
| Mismatch | dim 2 with unitCube, or a 3x3 with dim 2 | refused at validation | clear error |
| Huge entry | 1e12 | drawn clamped, no NaN, text gives the number | non-finite entry left out and named |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/{matrix-transform,meta,index}.ts` -- new scene schema (strict, kit), `MATRIX_TRANSFORM_META` (partIds above), registered in `SCENE_DEFINITIONS` and `SCENE_META`
- `src/lib/matrix/{index,build}.ts` -- new pure module: det, apply, eigen2, shape points, `buildMatrix` -> `{ dim, ghost, result, basis, eigen, facts }`; for 3D a `SpaceModel` through `lib/space` types
- `src/scenes/matrix/{Matrix2D,index}.tsx` -- flat SVG renderer (grid lines, polygons, arrows, tokens only, logical CSS); `src/scenes/registry.ts`, `src/scenes/index.ts`
- `src/features/scene/{MatrixViewer,viewers,static2d}.tsx` -- viewer (readouts, text list, steps), 3D through the existing `Space3D` dynamic import and `useTier`
- `src/i18n/messages/{en,ur}.json` -- `matrix.*`; `content/fixtures/mx-*.json` and the topic harness page (`plane`, `det`, `eigen`, `cube`)
- Tests and docs: `tests/unit/matrix.test.ts`, `tests/e2e/matrix.spec.ts`, `scene-frame-harness` allowlist, topic-format 2.13, `docs/coding-standard.md`

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/matrix/*` -- the numerics and the model, pure, with the known values
- [ ] schema, meta, registries -- the scene type, validated; mismatches refused
- [ ] `Matrix2D.tsx`, `MatrixViewer.tsx`, `static2d.tsx`, 3D through `Space3D`/`Space2D` -- drawing, readouts, words, steps, tiers
- [ ] messages, three fixture topics (plane and shear, determinant as area, eigenvectors) and one 3D cube fixture, harness page
- [ ] unit tests (every matrix row), e2e (sliders, morph, steps, Urdu, phone), docs, sprint status, deferred work

**Acceptance Criteria:**
- Given a 2x2 or 3x3 matrix applied to a grid or a 3D shape, when shown, then the transformation and the determinant as area or volume are shown, in the picture and in words (FR-3.27).
- Given a matrix entry that is a slider, when it moves, then the shape, the determinant, the basis arrows and the words follow together.
- Given progress from 0 to 1, when it moves, then the shape morphs from the original to the transformed one and the area follows det M(progress).
- Given known matrices, when shown, then the values match (area 6, determinant 1, -1, eigenvalues 3 and 1, volume 6).

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run check` -- expected: typecheck, lint, unit tests, build, static-route and bundle checks pass
- `npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
