---
title: 'Story 2.3: Scene frame and common controls'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '41cd54a7ca99e1266f7f89bc044451b729065033'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-2-topic-schema-md-parser-and-scene-registry.md'
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/docs/spikes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every scene needs the same way to turn, zoom, move, reset, enlarge and use from the keyboard, and the same accessible shell. Without one owner, each scene type would grow its own listeners and its own keyboard rules.

**Approach:** Build `src/scenes/frame/` (AD-15): a pure view model (rotate, zoom, pan, reset, presets, limits), pure keyboard and pointer-gesture interpreters, and one React component, `SceneFrame`, that wires them to a surface, a toolbar with visible words, Full screen with a fallback, the role switch, the first-time hint and the "More about this picture" disclosure. Renderers get the current view through a render prop and never touch input. Prove it in a real browser with a harness page that exists only when `VM_HARNESS=1`.

## Boundaries & Constraints

**Always:** The frame is the only code that listens to the pointer, wheel and keyboard for a scene; a lint rule keeps `OrbitControls` imports and `addEventListener` out of the rest of `src/scenes`. Every gesture has a button: Zoom in, Zoom out, Move picture (four direction buttons), Reset view, Full screen, each with an icon and a visible word. Tab always leaves the frame; Esc moves focus to the first toolbar button (or leaves Full screen first). Arrow-key rotation is never mirrored in Urdu. The frame's accessible name is the topic title plus "interactive picture"; it is `role="img"` until focused, then `role="application"` with the visible line "Arrow keys turn the picture. Esc leaves.". The caption is always visible; the long description is in a native disclosure. Targets are 44 px; all CSS is logical; no hex colors, tokens only. Camera moves are instant (no easing), so reduced motion needs no special case. All text is in the message files.

**Never:** No scene renderer, no 3D, no `three`, no WebGL, no tier switching or 8-second light-mode offer (Story 2.4). No sliders, topic page, live region fed by readouts, or steps (Stories 2.4 and 2.6). No drag handles for points inside scenes (the first 2D scene story). The harness page must not be reachable in production: no `VM_HARNESS`, no page.

**Decisions (mine, recorded):**
- The view is `{azimuth, elevation, scale, panX, panY}`: angles in degrees, `scale` 1 at the start (0.25 to 8), pan as a fraction of the frame size (-1 to 1, positive moves the picture down and to the right). `reset` returns to the topic's start view.
- Capabilities: `rotate` (3D), `zoom`, `pan`. In a scene that cannot rotate, a one-pointer drag and the arrow keys move the picture instead.
- Pointer: left drag or one finger rotates (drag right lowers the azimuth, drag down raises the elevation, as OrbitControls does); right drag pans; two fingers pinch and pan; wheel zooms. Steps are 5 degrees, 15 with Shift; zoom steps are x1.25.
- Keys: arrows turn, `+` or `=` zoom in, `-` or `_` zoom out, `0` resets; anything with Ctrl, Alt or Meta is left to the browser.
- The first-time hint is remembered under `localStorage` key `vm.sceneHint` only after "Got it"; it is shown after mount (never in the server HTML) so a returning visitor sees no flash.
- Full screen uses the Fullscreen API on the frame; when it is unavailable or refused, the frame maximizes itself (fixed, over the page) and Esc exits.
- Messages are `scene.*` in `en.json` and `ur.json`; the Urdu is an AI draft for the admin check.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rotate | drag 100 px right, 40 px down on a 3D frame | azimuth -50, elevation +20 from the start, clamped to -90..90 | N/A |
| Zoom | wheel up, pinch out, Zoom in, `+` | scale grows, never above 8; the opposite never below 0.25 | N/A |
| Pan | right drag, two-finger drag, Move picture buttons | pan changes, clamped to +-1; zoom-only frames ignore it | N/A |
| Reset | Reset view, `0` | the topic's start view exactly; the live region says the view was reset | N/A |
| Keyboard | arrows 5 degrees, Shift arrows 15, `+` `-` `0`, Tab, Esc | as stated; Tab not intercepted; Esc to the first toolbar button | Ctrl/Alt/Meta combos ignored |
| Urdu | `dir="rtl"` page | toolbar mirrors; ArrowRight still turns by +5 azimuth | N/A |
| Roles | focus and blur the frame | `img` becomes `application` and the hint line shows, then back | N/A |
| Hint | first visit; after "Got it"; storage blocked | shown once; gone for good; shown each time (no crash) | storage errors swallowed |
| Full screen | button, then Esc; API refused or missing | native, or the maximized fallback; the button label flips; Esc exits | refusal falls back |
| Description | scene with and without a description | disclosure present only when there is one; caption always | N/A |
| Gesture edge | 2 fingers then one lifts; pointer cancel; touch on a toolbar button | no jump in the view; state cleaned; toolbar still works | N/A |
| Limits | rotate past the pole, pan far, zoom with NaN or Infinity | clamped; non-finite input ignored | never throws |
| Lint | a file in `src/scenes` outside `frame` imports OrbitControls or calls `addEventListener` | lint error | N/A |
| Production | no `VM_HARNESS` | the harness route is a 404 | N/A |

</frozen-after-approval>

## Code Map

- `src/scenes/registry.ts`, `src/lib/topic-schema/scenes/meta.ts` -- scene types and the camera presets (`iso`, `front`, `top`, `side`) of topic-format 2.1 rule 5.
- `src/features/theme/ThemeToggle.tsx` -- client component pattern with next-intl and the 44 px token classes (`min-h-11`, `border-border-strong`).
- `src/i18n/messages/{en,ur}.json`, `tests/unit/i18n.test.ts` -- message files and the parity test; `eslint-rules/no-literal-text.mjs` applies to tsx.
- `eslint.config.mjs`, `tests/unit/lint-rules.test.ts` -- layer rules and the failing-code test pattern; `scenes` may import `lib` only.
- `playwright.config.ts`, `tests/e2e/*.spec.ts` -- e2e runs the production build; `webServer.env` can set `VM_HARNESS`.
- `src/app/[locale]/` -- static pages; the harness route is dynamic and guarded.
- `docs/spikes.md` section 1 -- device checks for 3D still pending the owner.

## Tasks & Acceptance

**Execution:**
- [x] `src/scenes/frame/camera.ts` -- view model, limits, reducer, presets, start views
- [x] `src/scenes/frame/keys.ts`, `gesture.ts`, `hint.ts`, `announce.ts` -- keyboard map, pointer and pinch interpreter, hint storage, debounced announcer
- [x] `src/scenes/frame/SceneFrame.tsx`, `index.ts` -- the component, toolbar, roles, hint, description, Full screen
- [x] `src/i18n/messages/{en,ur}.json` -- `scene.*` strings
- [x] `eslint.config.mjs` -- no OrbitControls import and no `addEventListener` in `src/scenes` outside `frame`
- [x] `src/features/dev/FrameHarness.tsx`, `src/app/[locale]/dev/frame/page.tsx`, `playwright.config.ts` -- the harness, guarded by `VM_HARNESS`
- [x] `tests/unit/scene-frame-*.test.ts`, `tests/e2e/scene-frame.spec.ts`, `tests/unit/lint-rules.test.ts` -- matrix rows
- [x] `docs/coding-standard.md`, `docs/environments.md`, `deferred-work.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given a 3D or 2D scene, one finger or mouse drag rotates, wheel or pinch zooms, two-finger drag or right-drag pans, and Reset view returns the camera to the topic's start (FR-3.1 to 3.4).
- Given the toolbar, Zoom in, Zoom out and Move picture work without any gesture, each with a visible word (UX-DR10).
- Given keyboard focus on the scene, arrows rotate by 5 degrees and Shift plus arrows by 15, + and - zoom, 0 resets, Tab leaves, Esc moves to the toolbar; arrow mapping is not flipped in Urdu (FR-3.29, NFR-3.1).
- Given the first topic opened on a device, a dismissible hint says drag to rotate and pinch to zoom, and is not shown again after "Got it" (FR-2.8).
- Given Full screen, the Fullscreen API is used with a maximized-frame fallback and Esc exits (FR-3.15).
- Given a text description in the topic, "More about this picture" shows it and the scene has an accessible name and caption (FR-3.29).


## Review Triage Log

Three reviewers (blind, edge-case, verification-gap). Claims checked against the code and, where cheap, in a real browser.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| The keyboard-hint line collapsed when the frame lost focus, shifting the toolbar between mouse-down and mouse-up, so a click on a toolbar button was lost | high | patch: the line keeps its space (`invisible`); e2e clicks a toolbar button while the frame has focus (found while chasing a failing announcer test) |
| `onViewChange` effect returned the callback's value, which React treats as cleanup | medium | patch: braces |
| The view persisted when a new topic's camera replaced the old one in a mounted frame | medium | patch: keyed by the camera's content; the view resets when it changes; an inline `camera` object does not reset every render |
| A pointer that never ends (window blur, release outside) left a stale entry, so the next touch pinched; a mouse with no button down turned the picture on hover; the middle button rotated | medium | patch: cleared on blur and visibility change, a released mouse is forgotten, only buttons 0 and 2 count |
| Esc from the Move picture buttons did nothing; Esc was handled twice while maximized | medium | patch: one wrapper owns toolbar and pad; one Esc path while maximized; e2e |
| `figcaption` was followed by the description and the live region inside `figure` (invalid HTML) | medium | patch: the figure holds the picture, controls and caption only; description and status follow it inside the frame root |
| `aria-pressed` on a button whose label also flips said it twice | low | patch: removed; e2e |
| A browser's own Esc out of native full screen was not announced | low | patch: said from `fullscreenchange` |
| `camera` null, an explicit `undefined` in `set`, and a no-op returning a new object | low | patch: tests in the model suite |
| Lint gaps: `PresentationControls`, `ScrollControls`, `KeyboardControls`, `three/addons/controls/*`, `@use-gesture/*`, `onDoubleClick`, `onAuxClick`, `onScroll`, `on...` property assignment | medium | patch: added with tests |
| `extraControls` had no sanctioned way to make a toggle work under the new lint | medium | patch: `FrameToggle` exported; e2e through the harness |
| Wheel test could not fail (scrollY could not change); right-drag test claimed the context menu but did not check it; "turning does not announce" never turned; hard-coded port 3100; `reuseExistingServer` could reuse a stale server | medium | patch: page made scrollable and wheel pushed down; `contextmenu` default-prevented asserted; arrows pressed; `baseURL`; never reuse |
| Urdu `movePad` equal to `movePicture` | low | patch: distinct wording |
| Keyboard and drag turn opposite ways (ArrowRight raises the azimuth, a drag right lowers it) | medium | defer to the owner: the frozen matrix says ArrowRight is +5; changing it means renegotiating the spec |
| The wheel and `touch-action: none` can trap page scrolling on a full-width picture | medium | defer: decided with the sticky layout of Story 2.6; the toolbar already covers every gesture |
| The hint always says "Drag to turn"; it should follow the scene's capabilities and mention wheel, right-drag, keys | low | defer: each scene type story (2.4 and Epic 3) sets its capabilities |
| Maximized fallback does not move focus in or make the page behind inert | low | defer: with the topic page (2.6), which owns the surrounding DOM |
| No announcements for Zoom in, Zoom out, Move picture | low | defer: the page-level live region of Story 2.6 |
| The harness and its page are compiled into the production build | low | accept: a 404 without `VM_HARNESS`, guarded by tests; documented |
| `ctrl`+wheel (trackpad pinch) zooms the picture instead of the page | low | accept: that is what a pinch on a picture should do |
| `topic-format.md` does not document `camera` | low | defer: reconciled with the doc fixes already recorded |

## Implementation Notes
- Files: `src/scenes/frame/` (camera, keys, gesture, hint, announce, SceneFrame, index), `src/features/dev/FrameHarness.tsx`, `src/app/[locale]/dev/frame/page.tsx`, `scene.*` messages, `eslint.config.mjs` (scene input rules), `playwright.config.ts` (port 3100, `VM_HARNESS`, never reuse a server).
- The e2e run found two defects no unit test could: `setTimeout` called as a method (browser "Illegal invocation") and the collapsing hint line swallowing clicks.
- 3D and real devices are not touched: spike 1 (phones) is still the owner's, and the frame has only been run on desktop Chromium (Chrome and Edge). Firefox, WebKit and phones run in CI.
- Tests: 1006 unit and 196 browser tests (Chrome and Edge) pass.
