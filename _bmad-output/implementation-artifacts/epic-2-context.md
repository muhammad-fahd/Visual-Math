# Epic 2 Context: Scene engine core and topic page

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

One engine and one topic page that can show any topic defined by a package, starting with 3D solids and the common controls. A topic is data (JSON or MD); scene types are registered code; nothing in a topic is ever executed.

## Stories

- Story 2.1: Expression module (`src/lib/expr/`, the only evaluator)
- Story 2.2: Topic schema, MD parser and scene registry
- Story 2.3: Scene frame and common controls
- Story 2.4: 3D solid scene, sliders, live formulas and tiers
- Story 2.5: Cross-section, unfold and fill
- Story 2.6: Topic page, steps, formulas and worked example
- Story 2.7: Report a problem
- Story 2.8: Reset all, marked terms and language switch on a topic

## Requirements & Constraints

- Sliders redraw in under 100 ms; scenes run at 30 fps or better on a mid-range phone; a 2D-only topic never downloads the 3D chunk (NFR-1.2, 1.3).
- Every scene type implements `static2D`, a text description and keyboard controls; no WebGL shows a plain message and a static image (FR-3.14, 3.29).
- Typed values beside sliders accept Eastern Arabic-Indic digits and reject anything but one finite number (FR-3.7).
- Formulas and calculations are tested against known values by automated tests (NFR-6.2). Property-based and fuzz tests are required for expression changes (AD-27).
- Math renders through KaTeX only, left-to-right inside right-to-left text, real minus sign (FR-3.28, AD-14).
- Visitors are never identified; Report a problem stores a topic id and a note, rate limited (FR-2.4, AD-26).

## Technical Decisions

- AD-3: `src/lib/expr/` is the only code that parses or evaluates an expression string (upload and runtime, including typed values). Whitelist grammar and functions, compiled to a closure over a frozen AST; no `eval`, no `new Function`; `mathjs` and `expr-eval` never touch topic input. Domain errors return NaN. Budget: 20000 steps per evaluation call; aggregate scene cost at most 3,000,000 steps (E_SCENE_COST) computed at upload.
- AD-2 (registry): a scene is declarative JSON `{type, v, ...}`; `src/scenes/registry.ts` maps `type@v` to `{schema, render2D, render3D?, static2D, partIds, describe}`; an unregistered pair fails upload (E_UNKNOWN_SCENE_TYPE). Renderers are pure functions of `(scene, params)`; no hex, tokens only.
- AD-19: `content_hash` is `sha256:` of canonical JSON (strings NFC, keys sorted), with golden vectors.
- AD-6: viewer state in the URL, client only; `parseUrlState` clamps and drops unknown keys. Static pages never read cookies, headers or `searchParams` on the server.
- Layers unchanged: `lib` pure and imports nothing from the repo; `scenes` imports `lib`; `features` imports `scenes` and `lib`; `app` composes.
- Spike 1 (3D and KaTeX on real phones) is still pending the owner and gates Stories 2.3 and 2.4.

## Cross-Story Dependencies

- 2.1 first: 2.2 (schema and upload checks) and 2.4 (sliders, live formulas) call it; 2.2 uses its `staticCost` for the scene cost.
- 2.2 before 2.3 to 2.6: the registry and schema define what a scene is.
- 2.3 and 2.4 need spike 1 results on devices before they are called done; 2.5 builds on 2.4; 2.6 needs 2.2 to 2.4; 2.7 and 2.8 need 2.6.
