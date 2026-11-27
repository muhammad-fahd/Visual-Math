---
title: 'Story 2.8: Reset all, marked terms and language switch on a topic'
type: 'feature'
created: '2026-11-27'
status: 'done'
baseline_commit: '576c83eddf8833bd7752879319c1319d25c3aacb'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-6-topic-page-steps-formulas-and-worked-example.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A visitor who has changed sliders, the camera and the example cannot get back to the start in one move; a marked word in the text explains nothing; and switching language on a topic page throws away the step and the slider values.

**Approach:** Add a "Reset all" button that returns the sliders, the example inputs, the camera and the view toggles to their start values and the page to step 1; make each `{{term:id}}` a button that opens a short sheet with its definition in the current language; and keep the visitor's place across a language switch by writing the step and the sliders they changed into the address (`?step=2&p.r=5`), read back on the client by `parseUrlState`, which clamps every value and drops everything it does not know.

## Boundaries & Constraints

**Always:**
- `parseUrlState` is pure, in `lib/params`, and treats the address as hostile: only `step` and `p.<parameter id>` are read; the first of a repeated key wins; a value must be one finite number (typed rules, either digit set); it is clamped to range and snapped to the step grid; unknown keys, other keys, inherited names (`p.__proto__`, `p.constructor`) and anything over 2000 characters are dropped; the result has no prototype. It is fuzzed.
- The URL is read only on the client, after mount; the static page never reads `searchParams`, cookies or headers on the server (AD-6, AD-10). The server HTML is the start state; restoring is a client step.
- Only what the visitor changed is written: the step (when not the first) and the parameters they touched. Values restored from an address count as touched, so a step does not override them. The address is updated with `history.replaceState` (no new history entry, the hash is kept), so the existing language switcher, which appends the current query and hash, keeps the place. Reset all removes them.
- Reset all: parameters to the step 1 state, `touched` cleared, example inputs to their defaults, the camera to the topic's start view, the view toggles (solid, labels, axes) to their start, any animation stopped, the step to 1, errors cleared; the focus stays on the button and a polite message says it was done.
- A term sheet is a native modal `<dialog>` like the report sheet: the term as its heading, the definition (from the topic, current language, English if missing), a Close button of at least 44 px; Esc and the backdrop close it; focus returns to the word. A term id the topic does not define stays plain text (no button). Text is rendered as text only.
- Buttons at least 44 px, logical CSS, Urdu mirrors; strings in `topic.*` (Urdu are drafts).

**Never:**
- No cookie or storage for any of this; no new dependency; no change to the language switcher's rules or the `vm-locale` cookie.
- No example inputs in the address (only the step and the sliders); no glossary page (the definitions live in the topic).
- No history entry per slider move.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reset all | after a slider moved, the camera turned, the example changed, step 3 | everything at start, step 1, the address has no `step` or `p.` keys, "Everything is back to the start." said | N/A |
| Tap a term | "unit circle" in a step | a sheet with the term and its definition; Close or Esc returns focus to the word | no definition in this language: English |
| Unknown term id | `{{term:nope}}` | nothing shown, as in Story 2.6 | N/A |
| Switch language | step 2, `r` moved to 5 | the same page in the other language at step 2 with `r` 5 | N/A |
| Address with state | `?step=2&p.r=5` | after mount: step 2, `r` 5 (touched) | N/A |
| Hostile address | `?step=99&p.r=9999&p.h=abc&p.__proto__=1&evil=1&p.r=2` | step clamped to the last, `r` clamped to its max (first value), `h` ignored, the rest dropped, no error | page still opens |
| Digits | `p.r=٥` | 5 | N/A |
| No state | no query | start state; the address is left clean | N/A |
| Touched then step | `p.r=5` in the address, press Next | `r` stays 5 | N/A |
| Moving sliders | many moves | one replaced address, not many history entries | N/A |
| Urdu | `/ur` | button, sheet and messages in Urdu | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/params/url.ts` (new, pure) -- `parseUrlState(specs, stepCount, search)` and `serializeUrlState`; uses `snap`, `parseTyped`.
- `src/features/scene/SolidViewer.tsx`, `useNumberFields.ts` -- a `restore` input (values marked touched), a `resetSeq` input (start values, touched cleared, toggles back, animation stopped), and an `onState` output of what the visitor changed; `src/scenes/frame/SceneFrame.tsx` gets `resetSeq` (the camera back to its start view).
- `src/features/topic/TopicPage.tsx` -- the step, reading the address after mount, writing it (replaceState, debounced), the Reset all button, the term sheet; `WorkedExample.tsx` takes `resetSeq`; `RichText.tsx` makes a defined term a button.
- `src/features/topic/TermSheet.tsx` (new) -- the dialog; reuse the pattern of `ReportProblem.tsx`.
- `src/i18n/messages/{en,ur}.json` -- `topic.reset*`, `topic.term*`.
- `tests/unit/` for the parser (fuzz), `tests/e2e/topic.spec.ts` for the flows; `docs/coding-standard.md`.
- Do not change `LanguageSwitcher.tsx` or the proxy; they already carry the query and hash.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/params/url.ts` and tests -- the hostile-address parser and the serializer, fuzzed -- AD-6
- [x] viewer, hook, frame, example, page -- restore, write, reset -- FR-2.5, FR-2.7
- [x] `TermSheet.tsx`, `RichText.tsx`, messages -- the term button and sheet -- FR-2.6
- [x] `tests/e2e/topic.spec.ts`, docs -- reset, terms, language switch, hostile addresses, Urdu

**Acceptance Criteria:**
- Given Reset all, when pressed, then the sliders, the example inputs and the camera return to their start values (and the page to step 1).
- Given a marked term, when tapped, then a sheet shows its short explanation in the current language.
- Given the language switch on a topic page, when used, then the step and the slider values are kept and the layout mirrors for Urdu.
- Given a URL with parameters, when read, then `parseUrlState` clamps every value to range and drops unknown keys.
- Given `npm run check` and Playwright (Chrome and Edge), when run, then both pass.

## Implementation Notes

- Files: `src/lib/params/url.ts` (`parseUrlState`, `serializeUrlState`, `mergeUrlState`), `useNumberFields` (`restore`, `reset`), `SolidViewer` (`restore`, `resetSeq`, `onChanged`), `SceneFrame` (`resetSeq`), `WorkedExample` (`resetSeq`), `TopicPage` (address read and write, Reset all, language switcher, extras moved), `TermSheet`, `RichText`, `topic.*` messages, the section fixture gained two terms, docs.
- Decisions: Reset all also returns the page to step 1 and the view toggles to their start; only the step and the sliders the visitor changed are written to the address (example inputs are not); the address is replaced, never pushed; a defined term is an inline button.
- Surprises: a sticky element hides what follows it in the same column (found by a click that would not land); a rAF frame outlives its effect's cleanup for one tick; the check stops before the build when a unit test fails.
- Tests: 1314 unit and 440 browser tests (Chrome and Edge) pass. Not run: Firefox, WebKit, phones, the three reviewers.

## Spec Change Log

## Review Triage Log

The owner chose the three reviewers (blind, edge-case, verification-gap). All three stopped with an API usage-limit error before reporting anything (the account's 5-hour limit, resets 4:30am Asia/Karachi), so no reviewer finding exists for this story. This log is the author's inline review of the diff plus what the browser tests and the checks showed. **The three-reviewer pass has not been done and should be run when the limit resets** (it is listed in the deferred items).

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| The sticky picture on a laptop covered the Play buttons, the cut panel and the net parts, which sat below it in the same column, so they could not be pressed (Playwright's click was intercepted) | high | patch: those pieces moved into the right column with the sliders, which is also where SRS 7.2 puts controls; the left column holds only the picture; the sticky test now checks the CSS contract and that the picture is in view when the end of the right column is read |
| A queued animation frame ran after Reset all (or after the address restored values) and moved the slider to 0.14 | high | patch: each play has an id, a stopped one is ignored (`playId`); the e2e test that resets during Unfold failed before and passes |
| The unit render test failed once the language switcher joined the topic page (no router outside Next) | low | test fix: the router path is mocked |
| `npm run check` stopped at that failing test before its build step, so the browser tests ran against the previous build and repeated old failures | low | process, as noted in Story 2.5: always read the first failing line of the check before trusting a browser run |
| A defined term inside a sentence is 24 px high, under the 44 px target | low | accept: an inline target in running text (WCAG 2.5.8 inline exception); the 44 px test skips `data-term` buttons and says why |
| Restored values (the address) could be overwritten by a step in the same commit | medium | checked: the restore effect runs after the step effect and marks the values touched; e2e opens `?step=2&p.r=5` and presses Next |
| The address writer could erase the place before the viewer reports what changed | medium | checked: it waits 250 ms and nothing is written before the address has been read; e2e covers the hostile address, one replaced entry and no history growth |
| Unrelated keys in the address (the harness's `topic=`) were dropped by the first writer | medium | patch: `mergeUrlState` replaces only `step` and `p.*`; unit and e2e tests |
| Example inputs are not in the address | low | accept by the spec (only the step and the sliders); the language switch keeps them out by design |
| Everything in the address is applied after mount, so a static page flashes its start state first | low | accept: AD-6 and AD-10 forbid reading the address on the server |

## Design Notes

Why only touched parameters go into the address: a step's presets are already known from the step number, so writing only what the visitor changed keeps the address short, and reading it back as touched matches the rule that a step never overrides the visitor. Reset is a counter (`resetSeq`) that components react to, so the page does not need to reach into their state.
