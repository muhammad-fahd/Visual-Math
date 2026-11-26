---
title: 'Story 2.4: 3D solid scene, sliders, live formulas and tiers'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '4372d939d9ad6ba4f251182bb984aafa95929809'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-3-scene-frame-and-common-controls.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The scene frame turns a picture, but nothing yet draws a solid, lets a visitor change its measurements, shows the formula with the numbers in it, or copes with a device that has no WebGL.

**Approach:** Register `solid3d@1` (nine kinds, labelled dimensions, view toggles) and build its viewer: a lazy three.js renderer (Tier A), a pure SVG projection from the same data (Tier B light mode and Tier C static image), parameter sliders with typed values, and live KaTeX formulas. Shown through a harness page until the topic page (Story 2.6) hosts it. Cross-section, net and fill are Story 2.5.

## Boundaries & Constraints

**Always:**
- Every value comes from `lib/expr` (`compile`, `parseTyped`, `format`); a renderer is a pure function of `(scene, params)`. Camera and the view toggles live in the frame; a toggle never resets the camera (FR-3.9).
- three.js and r3f load only in a lazy client chunk (`ssr: false`), `frameloop="demand"` with `invalidate()` on change, `dpr` capped `[1, 1.5]`, geometry and material reused, disposed on unmount, no shadows, context loss handled (AD-13). A 2D-only topic and the first page never download it (NFR-1.3).
- Colors are tokens, never hex; layout uses logical properties; scenes, axes and numbers stay left-to-right in Urdu; the arrow-key mapping is never mirrored.
- Math goes through one `lib/text/renderMath` with one frozen KaTeX options object; `dangerouslySetInnerHTML` appears only in one `MathHtml` component. A placeholder takes only `^-?\d+(\.\d+)?$` (U+2212 shown for the minus) or the code-inserted `\text{undefined}`, else a dash.
- The two-dimension tiers are one data path: Tier B and Tier C read the same projection as `static2D`. Labels are DOM (drei `Html`), never a font fetched from a CDN.

**Never:**
- No cross-section, net, fill (Story 2.5), no topic page layout, steps, URL state or Reset all (2.6, 2.8). No LaTeX command allowlist or upload-stage checks (Story 7.1). No third-party request, no `eval`.
- Spike 1 (real phones) is not claimed: 30 fps is designed for, not measured.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Slider moves | `h` 4 to 6 on a cone | solid, labels, readouts and formula all update in one render; the redraw takes under 100 ms | N/A |
| Typed value | "٧.٥" or "7.5" in range | accepted (Urdu digits too), slider follows | N/A |
| Typed out of range | 99 with max 10 | short message naming the range; old value kept | "Enter a number from 1 to 10." |
| Typed junk | "abc", "1e999", "" | rejected as not one finite number; old value kept | same message |
| Formula undefined | derived value NaN | the value shows a dash; the formula still renders | no throw |
| No WebGL | `getContext` returns null | plain message plus the static 2D image; sliders, formulas and toggles still work | Tier C |
| WebGL context lost | event fires | falls back to Tier B with the message | no crash |
| Slow start | Tier A not interactive in 8 s | light 2D mode is offered; choice kept per device in `localStorage` | storage blocked: offer still works for the visit |
| Toggle while turned | wireframe on after a 40 degree turn | camera unchanged | N/A |
| 2D-only topic | any non-3D scene | the 3D chunk is never requested | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/{solid3d,meta,index,common}.ts` -- add the `solid3d@1` schema and its `SolidMeta` (partIds `solid`, `dimensions`, `axes`); `commonSceneShape` gives caption, description, readouts. `kit.num` is the Num type.
- `src/lib/topic-schema/schema.ts` -- the scene union is built from the registry; no change expected. Camera in scenes reuses its union shape (copy into the scene file).
- `src/lib/solid/` (new, pure) -- `kinds.ts` (nine kinds: vertices, edges, faces, dimension anchors, volume and area), `project.ts` (orthographic projection from `{azimuth, elevation, scale, panX, panY}` to clamped 2D points).
- `src/lib/params/` (new, pure) -- clamp and snap to `min/max/step`; typed value via `parseTyped`; message ids.
- `src/lib/text/` (new) -- `renderMath`, `fillFormula`; `katex` 0.19.1 is installed and unused.
- `src/scenes/solid3d/` (new) -- `Solid3D.tsx` (r3f), `Solid2D.tsx` (SVG, Tier B and C), `tier.ts` (WebGL probe, 8 s offer, stored choice). Reuses `src/scenes/frame` and its `FrameToggle`.
- `src/features/scene/` (new) -- `SolidViewer.tsx` (frame, sliders, typed inputs, formulas, readouts), `MathHtml.tsx`; `src/features/dev/` and `src/app/[locale]/dev/solid/page.tsx` for the `VM_HARNESS` page.
- `src/scenes/registry.ts` and `eslint.config.mjs` -- the viewer half and the scene-input lint already cover `src/scenes`; `@react-three/*` controls stay banned there.
- `scripts/check-bundle.mjs`, `next.config.ts` -- the bundle scan must still pass; CSP unchanged (r3f needs no eval).
- `content/fixtures/` -- a cone fixture with a live volume formula; `tests/unit/topic-format-doc.test.ts` keeps the field table in step.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/topic-schema/scenes/solid3d.ts` + meta + registry -- `solid3d@1` strict schema, tests for each kind -- one registry entry per type (AD-2)
- [x] `src/lib/solid/*` -- geometry, dimension anchors, projection; unit and property tests (finite and clamped output, known volumes: cone, sphere, frustum) -- NFR-6.2
- [x] `src/lib/params/*`, `src/lib/text/*` -- slider and typed-value rules, formula fill, one frozen KaTeX options object -- AD-14
- [x] `src/scenes/solid3d/*` -- Tier A lazy chunk, Tier B and C SVG, tier switching, 8 s offer, context-loss handling -- AD-13
- [x] `src/features/scene/*`, dev page, fixtures -- sliders, typed inputs, live formulas, readouts through the one live region, view toggles -- FR-3.5 to 3.9
- [x] `tests/e2e/solid.spec.ts`, `docs/coding-standard.md`, `docs/spikes.md` -- browser tests (including a no-WebGL page and a chunk-not-loaded check), standards, spike 1 note

**Acceptance Criteria:**
- Given a cone topic, when the visitor moves the height slider, then the cone, the h label, the readout and "V = (1/3) × π × r² × h = 94.2 cm³" change together and the camera does not move.
- Given a 2D-only page, when it loads, then no request is made for the 3D chunk.
- Given no WebGL, when the viewer starts, then the message and the static image show and sliders and formulas keep working.
- Given `npm run check` and Playwright (Chrome and Edge), when run, then both pass.

## Implementation Notes

- Files: `src/lib/solid/` (kinds, project), `src/lib/params/`, `src/lib/text/` (formula, math), `src/lib/topic-schema/scenes/solid3d.ts` and its meta entry, `src/scenes/solid3d/` (Solid3D lazy, Solid2D, tier), `src/features/scene/` (SolidViewer, MathHtml, Boundary), `src/app/[locale]/dev/solid/page.tsx`, `content/fixtures/geo-cone-volume.json`, `solid.*` messages, `scripts/check-bundle.mjs` (3D chunk budget), docs.
- Decisions: partIds are `solid` and `dimensions` (topic-format 2.8), not `axes`; `section`, `net`, `fill` are Story 2.5's additive optional fields (the doc diff test skips them until then). Labels are an SVG overlay shared by Tier A and B, so there is no `drei` and no font fetched from a CDN. The picture is fitted to the largest the solid can get, so a slider visibly changes size.
- Review found by looking, not by tests: the missing KaTeX CSS and the overlapping labels. Screenshots of both tiers are worth taking for every scene story.
- `npm run check` stops at the first failure and skips the build, so a Playwright run right after a failed check tests the previous build. Re-run the whole check before Playwright.
- The 3D chunk is 238 KB gzip (budget 450). Headless Chrome and Edge render WebGL 2 in software; real-phone speed (FR-3.13, NFR-1.2) is still spike 1, the owner's.
- Tests: 1120 unit and 252 browser tests (Chrome and Edge) pass. Firefox, WebKit and phones run in CI.

## Spec Change Log

## Review Triage Log

Inline review (no subagents, the owner's choice), plus two things only a real browser showed: screenshots of Tier A and Tier B, and a full Playwright run. Each claim checked against the code or reproduced.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| Typing "7." in the box beside a slider reset it to "7" (a valid value rewrote the draft), so a decimal could not be typed key by key | high | patch: the draft is left alone while typing and made plain on Enter or blur; e2e types key by key (it failed on the old build, shows "7") |
| A 3D chunk that fails to download, or a context that fails to start, would throw in render and take the page down | high | patch: `Boundary` catches it and drops to Tier C with the plain message; e2e aborts the chunk |
| The KaTeX stylesheet was not loaded, so every formula showed twice (MathML and HTML) | high | patch: `katex.min.css` imported by `MathHtml`; found in the Tier A screenshot, not by any test (tests read text, not pixels) |
| Dimension letters overlapped each other and the lines (h, l and r on the cone) | medium | patch: written beside the line away from the solid, radii moved onto the x axis so the front view shows them at full length; unit test on every kind at four views |
| A context lost right after the first frame could be missed (listener attached in an effect); the test was flaky in the full run | medium | patch: listener attached in `onReady`; `data-ready` exposed for tests |
| The 100 ms redraw test was flaky on Edge (shader warm-up in the first sample) | medium | patch: the first change is a warm-up, the median of seven is asserted |
| `webglAvailable()` ran twice per mount (a phone has few contexts); `fit` was rebuilt on every slider move | low | patch: probed once; fit base computed from the parameter ranges only |
| `npm run check` stops at a failing unit test before the build, so Playwright then ran an old build and reported failures that were already fixed | low | process: noted below, no code change |
| `PerformanceMonitor` (AD-13) is not used | low | defer: needs `drei`; adaptive quality is decided with the spike 1 device results |
| Labels coincide when the view looks straight along a radius (azimuth 90 for a cone) | low | accept: the line itself is a point there; Reset view and any turn fix it |
| `\def` and other KaTeX macros render (KaTeX allows them without trust) | medium | defer: the LaTeX command allowlist is the upload stage, Story 7.1 (AD-14); `renderMath` refuses what KaTeX refuses |
| The viewer registry (`src/scenes/registry.ts`) carries no `render3D` or `static2D` yet | medium | defer: Story 2.6 maps a scene type to its viewer; the thumbnail from `static2D` is Story 7.x |
| KaTeX JS now runs in the browser (live formulas must re-render) | low | defer: measured against the 200 KB initial budget in Story 9.1 |

## Design Notes

Projection is orthographic: rotate about the vertical axis by azimuth, then tilt by elevation, scale and pan in frame units. Tier B draws the faces back to front from that projection with token colors; Tier A uses the same vertices, so the two always agree. Dimension labels are anchored to the real edges (radius to the base edge midpoint, height beside the axis, slant along the side) by the kind's own anchor list.
