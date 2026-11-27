# Epic 3 Context: Scene types for Foundation and Intermediate topics

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Add the scene types the Foundation and Intermediate launch topics need: 2D graphs and geometry, number and fraction models, algebra tools, trigonometry scenes, and statistics and probability. Each story adds one registry entry with its schema, renderer, static 2D picture, text description and keyboard controls, formula tests against known values, and one fixture topic. Epic 2 built the engine, frame and topic page for `solid3d`; this epic proves that a new scene type is one registry entry and a viewer, not a change to the page.

## Stories

- Story 3.1: 2D graphs (`canvas2d`)
- Story 3.2: 2D geometry
- Story 3.3: Number and fraction models
- Story 3.4: Algebra tools
- Story 3.5: Trigonometry scenes
- Story 3.6: Statistics and probability

## Requirements & Constraints

- Every scene is declarative JSON validated by its registered schema; it is a pure function of the parameters and derived values. Visitor input can only write a parameter, the camera or a view toggle.
- Every scene has a visible caption, a text description, and keyboard controls; draggable things must also work from the keyboard (FR-3.29, NFR-3.2).
- Two curves or shapes that carry meaning differ by dash pattern and marker, not only color (DESIGN.md). Colors are tokens only.
- Formulas and numbers are tested against known values (NFR-6.2); a value that cannot be computed is NaN and breaks a line instead of drawing a spike; every emitted coordinate is clamped to a finite window and point counts are capped.
- 2D scenes never load the 3D chunk (NFR-1.3). No third-party scripts.
- Typed values, sliders, steps, the address and Reset all behave as on the solid topics.

## Technical Decisions

- Expressions are only evaluated by `lib/expr` (closures, 20000-step budget, whitelist); a scene's total cost is checked at upload.
- The scene registry maps `type@v` to schema and viewer; an unregistered pair fails upload. Parts a step may show or hide are listed per type (for `canvas2d` the element ids).
- The scene frame owns turning, zoom, pan, Reset view, Full screen and the keyboard; renderers never attach listeners. A draggable handle is a feature-layer control bound to a parameter (it clamps and snaps to the parameter's range and step), never a renderer listener.
- 2D scenes use one custom SVG renderer calling `lib/expr` closures; it is a pure component, so a thumbnail can be made by rendering it to static markup.
- Layers: `lib` pure, `scenes` imports lib, `features` imports scenes and lib, `app` composes.

## UX & Interaction Patterns

- The topic page, steps, formulas, worked example, Reset all, terms and the address are generic; a new viewer plugs into them through the shared viewer state and parts (controls, results, formulas, live region).
- Zoom is limited to 0.25x to 8x of the declared viewport; the first-time hint and description disclosure come from the frame.

## Cross-Story Dependencies

- 3.1 first: it extracts the viewer state shared with `SolidViewer` (parameters, steps, restore, reset, readouts, formulas) that 3.2 to 3.6 reuse, and it builds the 2D renderer pieces (viewport mapping, ticks, sampling) that 3.2 and 3.5 extend.
- 3.5 uses the `unit-circle` schema and fixture already registered in Epic 2.
