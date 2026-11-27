---
title: 'Story 2.6: Topic page, steps, formulas and worked example'
type: 'feature'
created: '2026-11-27'
status: 'done'
baseline_commit: '5bfd2eeebe5e93fa130dfc4927b57f21fe096214'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-5-cross-section-unfold-and-fill.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The viewer exists but no page uses it: nothing explains the idea step by step beside the picture, shows the formulas with the steps, lets the visitor change a worked example, or moves between topics.

**Approach:** Build the topic page as one component (`TopicPage`) that takes a validated topic and lays it out as SRS 7.2: path links, the scene, its sliders, a step bar (Back, Next, free exploring), live formulas, the worked example with changeable inputs, Try this, Watch out, and Previous and Next. A harness page shows the fixtures until Epic 5 and 7 supply real routes and data. The scroll-trapping question left by Story 2.3 is settled here.

## Boundaries & Constraints

**Always:**
- Laptop: the scene fills the left two thirds, the right third holds the step text, sliders and formulas. Phone, portrait: the scene sticks to the top while the page scrolls, sliders directly under it. The whole layout mirrors in Urdu; the scene, formulas and numbers keep left to right. Buttons are at least 44 px.
- A step changes parameters, the camera and the shown parts; the visitor can always explore freely. A parameter the visitor has changed by hand keeps its value across steps; a step sets only the ones they have not touched. Next and Back keep focus on the button pressed and the new step title is announced politely.
- Every number comes from `lib/expr` through `createProgram`; every formula is `fillFormula` then `renderMath` through `MathHtml`; the worked example's inputs use the same typed-value rules as sliders; its lines recompute live.
- Topic text is rendered as text: `**bold**` and `{{term:id}}` become elements, never HTML; `{{name}}` placeholders take only formatted numbers. No hex, no physical CSS, no new dependency, no third-party request.
- Wheel zoom of the picture works with focus or Ctrl; without them the wheel scrolls the page. Touch: the picture still turns by one finger; the sticky layout leaves the rest of the page to scroll.
- At 320 px wide and at 200% text size nothing is clipped, and the scene un-sticks with a "Back to picture" link.

**Never:**
- No real routes, catalog, database reads, tree pages (Epics 5 and 7), no Report a problem (2.7), no Reset all, term sheets, URL state or language-switch state keeping (2.8): `{{term:id}}` shows the term's words only.
- No second scene type; the unit circle (Epic 3) is not drawn here.
- No change to the colors, tokens or fonts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open a topic | cone fixture | path links, scene, sliders, step 1 of N, formulas, example, Try this, Watch out | missing optional parts are left out |
| Next | step 2 names `cut` 4 | the parameter, camera and parts change; focus stays on Next; "Step 2 of 4: title" is announced | last step: Next is disabled with its reason |
| Back | from step 2 | step 1's state; values the visitor touched are kept | first step: Back is disabled |
| Visitor moved a slider, then Next | `h` touched, step names `h` | `h` keeps the visitor's value, the other named parameters change | N/A |
| Free exploring | any slider or the camera at any step | works; the step does not fight it | N/A |
| Step names `show`/`hide` | `hide: ["dimensions"]` | labels go; `show` brings them back | unknown part id: ignored |
| Formulas of a step | `formulaRefs: ["f1"]` | that formula is marked "used in this step" | unknown ref: ignored |
| Example input | typed 7.5 or Urdu digits | accepted; lines and answer recompute | out of range: message, old value kept |
| Example calc undefined | input makes a calc NaN | the line shows a dash and "undefined", the page stays up | no throw |
| Placeholders | `{{a}}` in text and math | the live value, formatted | unknown name: a dash |
| Previous and Next topic | `prev` and `next` given | links with the neighbour's title; none given: the button is absent | N/A |
| Path | category, subcategory, chapter | three links then the topic as plain text | names missing: the slug is shown readable |
| Wheel over the picture | not focused; Ctrl; focused | page scrolls; zooms; zooms | N/A |
| Narrow and large text | 320 px; text at 200% | no clipping; the scene is not sticky; "Back to picture" works | N/A |
| Urdu | `/ur` | layout mirrored, scene and formulas left to right, Urdu text | missing Urdu text falls back to English |

</frozen-after-approval>

## Code Map

- `src/features/scene/SolidViewer.tsx` -- today one block (frame, sliders, results, formulas, Play). Split into parts the page can place; the typed-value fields move to a shared component and hook; it accepts a step to apply (params, show, hide, camera) and formulas to highlight. Existing behavior and tests stay.
- `src/features/scene/{NumberFields.tsx,useNumberFields.ts}` (new) -- the slider and typed box, shared by the viewer and the worked example.
- `src/features/topic/` (new) -- `TopicPage.tsx`, `StepBar.tsx`, `WorkedExample.tsx`, `PathLinks.tsx`, `RichText.tsx`.
- `src/lib/text/` -- `rich.ts` (split `**bold**` and `{{term:id}}` into tokens), `template.ts` (`{{name}}` to formatted numbers).
- `src/lib/params/steps.ts` (new) -- what a step does to the values given what the visitor touched; the example's program.
- `src/scenes/frame/SceneFrame.tsx` -- the wheel rule; `tests/e2e/scene-frame.spec.ts` follows.
- `src/app/[locale]/dev/topic/page.tsx` (new, `VM_HARNESS`) -- fixtures in the page with stub neighbours.
- `src/i18n/messages/{en,ur}.json` -- `topic.*` (Urdu are drafts). `tests/unit/scene-frame-harness.test.ts` lists the new harness mention.
- Reuse: `createProgram`, `checkTyped`, `snap`, `fillFormula`, `MathHtml`, `format`; the frame and tier logic are not changed otherwise.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/text/{rich,template}.ts`, `src/lib/params/steps.ts` -- pure rules with tests -- NFR-6.2
- [x] `src/features/scene/*` -- split the viewer, share the fields, apply steps -- FR-4.2, 4.3
- [x] `src/features/topic/*`, harness page, messages -- the page, steps, example, Try this, Watch out, path, neighbours -- FR-2.1 to 2.3, 4.2 to 4.7
- [x] `src/scenes/frame/SceneFrame.tsx` and its tests -- wheel needs focus or Ctrl -- deferred item of Story 2.3
- [x] `tests/e2e/topic.spec.ts`, unit tests, docs -- phone, laptop, Urdu, narrow, large text, keyboard

**Acceptance Criteria:**
- Given a topic, when the page opens, then the path, scene, sliders, steps, formulas, worked example, Try this and Watch out all show, in the layout of SRS 7.2.
- Given Next and Back, when the visitor presses them, then parameters, camera and parts change, values the visitor changed are kept, and focus stays on the button.
- Given the worked example, when an input changes, then every line and the answer recompute.
- Given Urdu, 320 px and 200% text, when the page is used, then nothing is clipped and the layout is correct.
- Given `npm run check` and Playwright (Chrome and Edge), when run, then both pass.

## Implementation Notes

- Files: `src/features/topic/` (TopicPage, StepBar, WorkedExample, PathLinks, RichText), `src/features/scene/` (the viewer split into parts; `NumberFields`, `useNumberFields`), `src/lib/text/{rich,template}.ts`, `src/lib/params/steps.ts`, `src/scenes/frame/SceneFrame.tsx` (wheel rule), `/[locale]/dev/topic` harness, `topic.*` messages, docs.
- Decisions: a step is advice, not a gate; values the visitor changed are kept, the rest follow the step, and Back rebuilds the state from step 1 so it is exact. Sticky is CSS only, un-stuck by `rem` media queries (larger text) and below 22.5rem. The wheel zooms a picture only with focus, Ctrl or full screen (the scroll-trap item deferred from Story 2.3). The topic page is a component plus a harness until real routes exist (Epics 5 and 7).
- The reviewers found the touched-value rule too eager and the gate untested; both patched. The screenshots showed nothing wrong on a laptop, phone or Urdu.
- Tests: 1231 unit and 354 browser tests (Chrome and Edge) pass. Not run: Firefox, WebKit, real phones, a real browser text-size setting of 200% (a 640 by 400 viewport stands in for it).

## Spec Change Log

## Review Triage Log

Three reviewers (blind, edge-case, verification-gap), then each claim checked against the code. Two things only a real browser showed: screenshots of the page on a laptop, a phone and in Urdu, and the full Playwright run.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| A bare blur on a typed box, or a refused value, marked the parameter touched, so a later step would not move it | medium | patch: touched only when a value that differs from the current one is applied (slider, typed, choice); e2e tabs through a box and presses Enter on junk, then Next |
| The step index was never clamped, did not reset when the topic changed, and a topic with no steps would throw | medium | patch: the position is keyed by topic id and clamped; no step bar when there are no steps; `highlight` tolerates no current step |
| `sceneAtStep` with a NaN index dropped step 1's parameters | low | patch: NaN is the first step; unit test |
| The `/dev/topic` 404 gate had no test (the other harnesses do), so it could ship open | medium | patch: `tests/unit/topic-harness.test.ts` (unset, `''`, `true`, `0`, spaces, `on` all 404; fixture choice; odd `?topic=` falls back) |
| "A line that cannot be computed shows a dash" asserted only the word `undefined`; an e2e test named for the no-scene path never exercised it | low | patch: the unit test asserts the dash in the words and no `NaN` or `Infinity`; the e2e test is renamed for what it checks; the no-scene path is in the unit tests |
| The path separator did not mirror in Urdu | low | patch: rotated in `rtl` |
| The step announcement effect had `[index]` only (stale text after a language switch) and relied on a first-run flag | low | patch: remembers the index it last announced; deps complete |
| The worked example's range input could get `undefined` if its inputs changed without a remount | low | patch: falls back to the default |
| Path and neighbour links are plain anchors (a full page load), not a locale-aware link | low | defer: the tree and topic routes (Epics 5 and 7) decide the link component and addresses |
| `{{term:id}}` with no such term, or an empty word in a language, renders nothing; text over 2000 characters is cut | low | accept: the schema caps every text far below 2000 and the unknown id is ignored by design; upload-stage checks of term ids belong to Story 7.1 |
| A calculated line named like an input, or with no decimals | low | defer: Story 7.1 checks names and `decimals` at upload |
| No-scene fallback shows the steps but not the sliders or formulas | low | defer: a scene type with no viewer is the unit circle (Epic 3), which brings its own viewer |
| No `aria-valuetext`, a typed box labelled apart from its slider | low | defer: the slider and its typed box date from Story 2.4; one accessibility pass for the whole viewer |
| `enterStep` "has no caller in the diff", the spec's Code Map puts the example's program in `steps.ts` | false | the caller is in `SolidViewer` (the diff list omitted that file's hunks); proved by the e2e that moves a slider, presses Next and sees the value kept; the Code Map line is a spec note, not code |
| `loc` is copied into three files; `FieldSpec` and `ParamSpec` overlap | low | accept: three one-line copies; a shared helper arrives with the first server component that needs it |
| `backToPicture` and the step bar both use `order-4` | low | accept: equal order falls back to DOM order, which is the one wanted (checked by the phone order test) |

## Design Notes

Steps keep the visitor's values by tracking which parameters were touched by hand (slider, typed box); a step applies its `params` only to the untouched ones. The step number and the touched set are page state; the values stay in the viewer. Sticky is pure CSS: sticky on narrow screens, un-stuck by media queries in `rem` (so larger text un-sticks it) and below 22.5 rem wide.
