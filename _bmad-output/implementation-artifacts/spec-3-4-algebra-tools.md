---
title: 'Story 3.4: Algebra tools'
type: 'feature'
created: '2026-11-28'
status: 'review'
baseline_commit: 'ae32b29743632c6b4413e4de82b55f30fd91c860'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-3-number-and-fraction-models.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Foundation and Intermediate algebra needs balance scales for equations, algebra tiles for expanding and factoring, function machines and a step-by-step equation solver that shows each move (FR-3.20). No scene type draws them, and a solver whose lines are false would teach the wrong thing.

**Approach:** Register `algebra-tool@1` as topic-format 2.7 defines it, with one `tool` per scene (four kinds). All interaction is a parameter (a slider), so the scene stays pure. `lib/algebra` lays out the first three as the same prims the number models use, so one SVG renderer draws them; the step solver is a list of LaTeX lines revealed by a parameter, each with a note. A new per-scene `check` hook in the scene registry runs after the schema passes, and the step solver uses it to evaluate every line at the solution and fail a false one with E_SOLVER_LINE.

## Boundaries & Constraints

**Always:**
- Every number comes from `lib/expr`; the picture is a pure function of `(tool, params)`; no listener in `src/scenes`; colors are tokens, no hex, logical CSS; the picture stays left to right in Urdu.
- Counts are rounded and clamped: balance `xs` 0 to 10 and `ones` 0 to 20 per pan; tiles `x2` 0 to 6, `x` 0 to 20, `one` 0 to 30; the solver shows 1 to the number of lines. A value that cannot be computed draws nothing.
- Balance scale: each pan holds `xs` blocks of the hidden weight `x` and `ones` unit blocks; the beam tips by the sign of left minus right (heavier side down, level when equal within 1e-9). The text says both sides, the weight, and "tips left", "tips right" or "balanced".
- Algebra tiles: with `x2` at least 1, tiles are arranged into a rectangle when integers m, n, p, q exist with m*n = x2, p*q = one and m*q + n*p = x; the sides are (m x + p) and (n x + q). `mode` is `expand` (sides first, then the polynomial) or `factor` (polynomial first, then the sides); when no rectangle exists the tiles lie in a pile and the text says so.
- Function machine: the output is the rule at the input (`x` is the variable); a value that cannot be computed reads "undefined"; `showRule: false` keeps the rule out of the picture and the text.
- Step solver: lines are revealed by the parameter `reveal` (rounded, 1 to the number of lines); each line shows its LaTeX and its note, and the newest is marked. At upload (the registry `check` hook) every line's `lhs` and `rhs` are evaluated at `variable = solution`; a line whose two sides differ by more than 1e-9 of their size fails with E_SOLVER_LINE (`stepSolver line {i} is not true at {variable} = {solution}.`, i from 1, pointer to the line); an expression that does not parse fails with E_EXPR_SYNTAX. The viewer never evaluates a line for display other than through `lib/expr`.
- Everything drawn is also text (the sentences and the live region), in the visitor's language. `partIds` a step may hide or show: `labels`, `rule`, `notes`.

**Never:**
- No drag of loose pieces (every move is a slider); no new dependency; no change to `canvas2d`, `number-model` behavior, the frame, colors or fonts; no upload pipeline (Story 7.1) beyond the `check` hook; no equation solving by the program (the topic's `lines` are the author's).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Balance, tips | 2x + 3 against 11, x = 1 | beam tips right (11 > 5); text "tips right" | N/A |
| Balance, level | same, x = 4 | both sides 11; level; "balanced" | N/A |
| Balance, counts | xs 12, ones 30 | clamped to 10 and 20 | NaN: nothing drawn |
| Tiles, factor | x2 1, x 5, one 6 | rectangle (x + 2) by (x + 3); "x^2 + 5x + 6 = (x + 2)(x + 3)" | N/A |
| Tiles, expand | same, mode expand | "(x + 2)(x + 3) = x^2 + 5x + 6" | N/A |
| Tiles, no rectangle | x2 1, x 2, one 5 | tiles in a pile; text says no rectangle | N/A |
| Tiles, x2 0 | x2 0 | pile, no factoring | N/A |
| Machine | rule `2*x + 1`, input 3 | input 3, output 7, rule shown | rule with no value (`1/0`): "undefined" |
| Machine, rule hidden | `showRule: false` or step hides `rule` | no rule in picture or text | N/A |
| Solver | 4 lines, reveal 2 | first 2 lines with notes, line 2 marked | reveal 0 or 9: clamped to 1 and 4 |
| Solver, true lines | `2x + 3 = 11` to `x = 4` at x = 4 | topic is accepted | N/A |
| Solver, false line | one line is `2x = 9` at x = 4 | upload fails: E_SOLVER_LINE, line number, pointer | N/A |
| Solver, bad expression | `lhs` is `2*` | E_EXPR_SYNTAX | N/A |
| SSR | first render | picture or lines and the sentences are in the HTML | N/A |
| Urdu | `/ur` | words in Urdu; picture and math left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scene-registry.ts` -- `SceneDefinition.check?(scene) => Problem[]` (stage S5 hook); `validate.ts` -- run it after the schema passes, merge its errors (ok becomes false).
- `src/lib/topic-schema/scenes/algebra-tool.ts` (new), `meta.ts` (`ALGEBRA_TOOL_META`), `index.ts` -- schema with `tool: {kind, ...}` (nested like `number-model`'s `model`), the `check` for `stepSolver`.
- `src/lib/algebra/` (new: `build.ts`, `index.ts`) -- pure: `buildTool({tool, program, scope, params, hidden})` returns `{prims, sentences, solver}`; factorisation search; polynomial text.
- `src/scenes/numbermodel/NumberModel.tsx` -- reused as the renderer of the three picture tools (prims are shared with `lib/numbermodel`); no change expected.
- `src/features/scene/AlgebraToolViewer.tsx` (new), `viewers.tsx` -- viewer on `useSceneState`; the solver panel renders each line with `MathHtml`; register `algebra-tool`.
- `src/i18n/messages/{en,ur}.json` -- `algebra.*` (Urdu is an AI draft).
- `content/fixtures/alg-balance-scale.json` and `alg-solve-steps.json`, `src/app/[locale]/dev/topic/page.tsx` -- fixtures (harness keys `balance`, `solver`).
- `tests/unit/algebra-tool.test.ts`, `tests/e2e/algebra.spec.ts`, `tests/unit/scene-frame-harness.test.ts` allowlist, tests that list registered scenes, `docs/coding-standard.md` one line.
- Reuse: `useSceneState`, `ParameterControls`, `SceneFrame`, `MathHtml`, `lib/expr`. Not to change: `lib/expr`, `SolidViewer`, `canvas2d`, `NumberModelViewer`, the frame.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/topic-schema/scene-registry.ts`, `validate.ts` -- the `check` hook -- tested with a stub scene
- [x] `src/lib/topic-schema/scenes/algebra-tool.ts`, `meta.ts`, `index.ts` -- schema and the solver `check` -- E_SOLVER_LINE and E_EXPR_SYNTAX tests
- [x] `src/lib/algebra/build.ts` -- balance, tiles, machine, solver -- tested against the matrix
- [x] `src/features/scene/AlgebraToolViewer.tsx`, `viewers.tsx`, messages -- viewer and text
- [x] fixtures, harness registration, unit and e2e tests, docs line

**Acceptance Criteria:**
- Given balance scales, algebra tiles, function machines and the step solver, when a slider moves, then each move is shown in the picture and in the text (FR-3.20).
- Given the step solver, when the topic is checked, then every line is true at the solution; a topic with a false line fails with E_SOLVER_LINE.
- Given the graph, geometry, model and solid topics, when this lands, then their tests pass unchanged; `npm run check` and Playwright (Chrome, Edge) pass.

## Implementation Notes

- `SceneDefinition.check` is the first piece of stage S5: `createTopicValidator` runs it after the schema passes and any error makes the topic invalid (warnings are kept). The solver's `checkSolverLines` (in `scenes/algebra-tool.ts`) evaluates both sides of every line at the solution through `lib/expr`; a false line is E_SOLVER_LINE with pointer `/scene/tool/lines/{i}`, a line that does not parse is the parser's own code (E_EXPR_SYNTAX, E_EXPR_IDENT) at the side.
- The scene nests its tool as `tool: {kind, ...}`, like `number-model`'s `model` (topic-format 2.7 names the discriminator `tool`; the document needs the same reconciliation as 2.6).
- `lib/algebra/build.ts` returns the balance scale, tiles and machine as the prims of `lib/numbermodel` (drawn by `NumberModel`), and the solver as `{revealed, lines}` for an HTML list with `MathHtml`. Tiles are arranged by a small integer search (m n = x2, p q = one, m q + n p = x).
- Fixtures `alg-balance-scale` (harness `balance`) and `alg-solve-steps` (`solver`); `tests/unit/algebra-tool.test.ts` covers every matrix row, `tests/e2e/algebra.spec.ts` the two fixtures.
- Verified: `npm run check` green (1475 unit tests, 3D chunk 238 of 450 KB gzip); Playwright 498 tests on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

Inline review (owner chose no subagents), over the diff:
- Checked: the hook cannot throw (the check is called inside the validator's try, and `checkSolverLines` tolerates any shape; tested with odd input); a side that is NaN is never equal; rounding (0.1 + 0.2 = 0.3) is tolerated; `createSceneRegistry` keeps `check`; tile search is bounded (x2 at most 6, one at most 30); a hostile machine rule reads "undefined".
- Fixed during testing: the e2e selector `[data-line]` also matched the worked example's lines (scoped to the solver).
- Deferred: the `reveal` parameter id is not checked against the topic's parameters (stage S2, with the other id checks); a machine rule longer than 18 characters is cut in the picture (the sentence has all of it); the tiles and the machine have no browser test (unit-tested; they share the renderer with the balance scale); a very large machine output can overflow its box.

## Design Notes

Three of the tools are pictures of numbers, so they reuse the prim model of `lib/numbermodel` and its one renderer; the solver is prose and math, so it is HTML. The `check` hook is the first piece of stage S5: later checks (formula recompute, example lines) can use the same hook.

## Verification

**Commands:**
- `NEXT_DIST_DIR=.next-e2e npm run check` -- expected: all green
- `NEXT_DIST_DIR=.next-e2e npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
