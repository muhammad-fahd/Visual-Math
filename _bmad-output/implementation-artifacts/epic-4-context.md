# Epic 4 Context: Scene types for Advanced topics

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Add the scene types the Advanced launch topics need: 3D axes with vectors, lines and planes; the complex plane; calculus scenes; matrix transformations (required for launch); and, only if time allows, 3D surfaces. Same story rules as Epic 3: each story is one registry entry with its schema, renderer, static 2D picture, text description and keyboard controls, formula tests against known values, and fixture topics. Epics 2 and 3 built the engine, the 3D frame and the 2D scene pattern; this epic proves the pattern again for the harder scenes.

## Stories

- Story 4.1: 3D axes, vectors, lines and planes (`space3d`)
- Story 4.2: Complex plane
- Story 4.3: Calculus scenes
- Story 4.4: Matrix transformations (required for launch)
- Story 4.5: Surfaces z = f(x, y) (S)

## Requirements & Constraints

- Every scene is declarative JSON validated by its registered schema; it is a pure function of the parameters and derived values. Visitor input can only write a parameter, the camera or a view toggle. Nothing in a topic is executed.
- Every scene has a visible caption, a text description and keyboard controls; whatever can be edited must work from the keyboard too (FR-3.29, NFR-3.2). Axes, numbers and formulas are never mirrored in Urdu.
- Formulas and numbers are tested against known values (NFR-6.2); a value that cannot be computed is NaN and is not drawn; every emitted coordinate is clamped to a finite window and counts are capped.
- 3D scenes keep 30 frames per second on a mid-range phone (demand rendering, no shadows), and a device without WebGL gets the same geometry as a plain 2D picture with a message (FR-3.14). 2D scenes never load the 3D chunk (NFR-1.3); the 3D chunk stays within 450 KB gzip. No third-party scripts.
- Typed values, sliders, steps, the address and Reset all behave as on the solid topics.

## Technical Decisions

- Expressions are evaluated only by `lib/expr` (closures, step budget, whitelist); a scene's cost is checked at upload.
- The scene registry maps `type@v` to schema and viewer; an unregistered pair fails upload. Parts a step may show or hide are listed per type (`partIds`).
- three and react-three-fiber are imported only by the one file of the 3D scene, loaded with a dynamic import; the barrel never exports it. Axes and labels are an SVG overlay drawn with the same `project()` as the camera, so the two cannot disagree; Tier A (three) and Tier B/C (SVG) read the same geometry.
- Input belongs to the scene frame and the feature layer: nothing under `src/scenes` outside the frame listens to the pointer or the keyboard; editing controls are parameters with sliders and typed boxes.
- A new scene type is: schema file and `meta.ts` entry, `SCENE_DEFINITIONS` entry, pure layout in `lib`, renderer in `src/scenes`, viewer in `src/features/scene` with one line in `viewers.tsx`, a `static2D` case, fixtures, unit and e2e tests, and the registry and format-document lists.

## Cross-Story Dependencies

- 4.2 to 4.4 reuse the 2D scene pattern of Epic 3 (shared flat-prim model, handles); 4.4 and 4.5 reuse the 3D machinery that 4.1 adds for non-solid scenes.
- 4.1 sets the shared 3D drawing model (lines, patches, points, labels) that 4.3 (solids of revolution), 4.4 (3D shape) and 4.5 (surfaces) can build on.
