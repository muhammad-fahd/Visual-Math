---
title: 'Story 3.6: Statistics and probability'
type: 'feature'
created: '2026-11-28'
status: 'review'
baseline_commit: '2e9f191ed3a243344044b6220bd5802899470ee3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-5-trigonometry-scenes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Statistics and probability topics need dot plots, histograms, box plots, scatter plots with a fitted line, bar charts, dice, coin and spinner simulations with many trials, and a normal distribution with adjustable mean and standard deviation and a shaded probability (FR-3.26). No scene type draws them, and the data and the fit must be correct against known data sets.

**Approach:** Register `stats@1` as topic-format 2.11 defines it (one `chart` per scene), with the kinds `dotPlot`, `histogram`, `boxplot`, `scatter`, `bar`, `distribution` and `simulation`. `lib/stats` computes the numbers (mean, median, quartiles, outliers, regression, bins, a seeded generator, density curves) and lays each chart out as the prims of the shared SVG renderer plus sentences; the two new prims draw a filled polygon (a shaded area). Every move is a parameter (bins, mean, sd, trials, a point's value), so the scene stays pure.

## Boundaries & Constraints

**Always:**
- Every number a visitor can change comes from `lib/expr`; distributions use its `normpdf`, `normcdf` and `binompmf`; the picture is a pure function of `(chart, params)`; no listener in `src/scenes`; colors are tokens, no hex, logical CSS; the picture stays left to right in Urdu.
- Randomness is deterministic: a seeded generator (mulberry32) gives the same numbers for the same seed in the browser, on the server and in tests; a simulation's first `trials` outcomes are a prefix of its longer run, so moving the trials slider extends the same experiment; generated histogram and box-plot data (`gen`: normal or uniform, `n` at most 500, an integer `seed`) are the same every time.
- Statistics follow fixed definitions, stated in the text: the mean; the median; quartiles are the medians of the lower and upper halves (the middle value left out when n is odd); the interquartile range; an outlier is beyond 1.5 times the range from a quartile, and the whiskers reach the furthest values that are not outliers; the fitted line is least squares with its slope, intercept and correlation r (a fit needs at least 2 points and a spread in x, else none).
- Fields are clamped to the table of topic-format 2.11: histogram `bins` an integer 2 to 40, data at most 500 values, dot plot at most 100, scatter at most 100 points, bar at most 12 categories, simulation `trials` an integer 1 to 1000, `sectors` 2 to 12, binomial `n` at most 100. A value that cannot be computed draws nothing, and a data value that is not a number is left out (the text says how many were used).
- A normal or binomial or uniform `distribution` draws its density, and with `shade` the area between `from` and `to` is filled and the probability is written (from `normcdf`, from the sum of `binompmf`, or the uniform fraction) to 4 decimals; known probabilities hold (normal within one standard deviation 0.6827, binomial n 10 p 0.5 at k 5 is 0.2461).
- Everything drawn is also text (sentences and the live region), in the visitor's language. `partIds` a step may hide or show: `mean`, `median`, `fit`, `residuals`, `shade`, `expected`, `labels`.

**Never:**
- No dragging of scatter points (a point's value is a `Num`, so a slider moves it) and no `probabilityTree` in this story (deferred); no new dependency; no change to the other scene types, the frame, colors or fonts; no use of `Math.random` anywhere.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Summary | data 1 to 10 | mean 5.5, median 5.5, Q1 3, Q3 8, IQR 5 | n = 0: nothing drawn |
| Box plot outlier | 1, 2, 3, 4, 5, 6, 7, 8, 9, 30 with `showOutliers` | 30 is an outlier dot; the whisker ends at 9 | no outliers: none drawn |
| Histogram | 20 values, 5 bins | counts add up to 20; the maximum falls in the last bin | all values equal: one bin of width 1 around it |
| Bins slider | bins 5 to 12 | the bars and the text follow | bins 1 or 90: clamped to 2 and 40 |
| Dot plot | 3, 3, 3, 5 | a stack of 3 at 3 and 1 at 5 | over 100 values: the first 100 |
| Scatter fit | Anscombe set I | slope 0.5, intercept 3, r 0.8164; line drawn | 1 point or all x equal: no line, text says so |
| Residuals | `showResiduals` | a vertical segment from each point to the line | no fit: none |
| Bar | 3 categories, 3 values | 3 bars with labels | fewer values than categories: the shorter list |
| Normal | mean 0, sd 1, shade -1 to 1 | curve, shaded area, probability 0.6827 | sd <= 0 or NaN: nothing |
| Binomial | n 10, p 0.5, shade 5 to 5 | bars; the bar at 5 shaded; 0.2461 | n over 100: clamped; p outside 0 to 1: nothing |
| Uniform | 2 to 6, shade 3 to 5 | a flat density; probability 0.5 | b <= a: nothing |
| Die, many trials | 600 trials, seed 7 | six relative-frequency bars, expected 1/6 line | trials 0 or 5000: clamped to 1 and 1000 |
| Same seed | same chart twice, or trials 10 then 20 | identical numbers; the first 10 outcomes are unchanged | N/A |
| Coin and spinner | coin; spinner with 5 sectors | 2 and 5 outcomes | sectors 1 or 20: clamped to 2 and 12 |
| Generated data | `gen` normal, n 200, seed 3 | the same 200 values every time; mean near the asked mean | n over 500: 500 |
| Hidden part | step hides `fit` or `shade` | that part and its sentence are gone | unknown id ignored |
| SSR | first render | picture and sentences are in the HTML | N/A |
| Urdu | `/ur` | words in Urdu; picture and numbers left to right | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/topic-schema/scenes/stats.ts` (new), `meta.ts` (`STATS_META`), `index.ts` -- schema of topic-format 2.11 without `drag` and `probabilityTree`, plus `dotPlot` and the simulation's `sectors`; the doc test gets a manual row.
- `src/lib/stats/` (new: `rng.ts`, `summary.ts`, `charts.ts`, `index.ts`) -- pure: `mulberry32`, `generate`, `summarize`, `quartiles`, `regress`, `bin`, `buildChart`.
- `src/lib/numbermodel/build.ts` (`Prim` union) and `src/scenes/numbermodel/NumberModel.tsx` -- add a `poly` prim (a closed filled polygon); nothing else changes.
- `src/features/scene/StatsViewer.tsx` (new), `viewers.tsx` -- viewer on `useSceneState`; register `stats`.
- `src/i18n/messages/{en,ur}.json` -- `stats.*` (Urdu is an AI draft).
- `content/fixtures/stats-normal-distribution.json` and `stats-dice.json`, `src/app/[locale]/dev/topic/page.tsx` -- fixtures (harness keys `normal`, `dice`).
- `tests/unit/stats.test.ts`, `tests/e2e/stats.spec.ts`, the scene-listing tests, `tests/unit/scene-frame-harness.test.ts` allowlist, `docs/coding-standard.md` one line.
- Reuse: `useSceneState`, `ParameterControls`, `SceneFrame`, `lib/expr` (`normpdf`, `normcdf`, `binompmf`), `lib/graph` `niceTicks`, `NumberModel`. Not to change: `lib/expr`, the other viewers, the frame.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/stats/*` -- generator, summaries, regression, bins, the seven layouts -- tested against known data sets and the matrix
- [x] `src/lib/topic-schema/scenes/stats.ts`, `meta.ts`, `index.ts` -- the registry entry -- schema tests
- [x] `src/lib/numbermodel/build.ts`, `NumberModel.tsx` -- the `poly` prim
- [x] `src/features/scene/StatsViewer.tsx`, `viewers.tsx`, messages -- viewer and text
- [x] fixtures, harness registration, unit and e2e tests, docs line

**Acceptance Criteria:**
- Given dot plots, histograms, box plots and scatter plots with a fitted line, when drawn, then the data and the fit are correct against known data sets (FR-3.26).
- Given dice, coin and spinner simulations with many trials, when drawn, then results use a deterministic generator, so the scene stays pure.
- Given the normal distribution, when the mean and standard deviation sliders move, then it reshapes and a shaded probability is shown.
- Given the earlier topics, when this lands, then their tests pass unchanged; `npm run check` and Playwright (Chrome, Edge) pass.

## Implementation Notes

- `lib/stats` holds the generator (`rng.ts`: mulberry32, `generate`, `outcomes`), the statistics (`summary.ts`: `summarize` with the quartiles inside it, `regress`, `bin`) and the seven layouts (`charts.ts`); `NumberModel` gained a `poly` prim for shaded areas. `StatsViewer` is the viewer; `features/scene/viewers.tsx` registers `stats`.
- Deviations from topic-format 2.11, all recorded for the document reconciliation: a simulation's experiment is `sim` (the chart's own `kind` is `simulation`), the simulation has `sectors` for a spinner, there is a `dotPlot` kind, `scatter.drag` and `probabilityTree` are not in this version, and `params` of a distribution must be exactly the names of its kind.
- Fixtures `stats-normal-distribution` (harness `normal`) and `stats-dice` (`dice`). The dice slider runs 6 to 996 in steps of 6 so that every step's value is on its grid. The first step of a topic applies on load, so the dice page starts at 6 rolls.
- `vitest.config.ts` has `hookTimeout: 60000`: the PGlite migration tests start a WebAssembly Postgres in `beforeAll` and timed out at the 10s default in two `npm run check` runs on a busy machine.
- Verified: `npm run check` green (1590 unit tests, 3D chunk 238 of 450 KB gzip); Playwright 528 tests on chrome-111 and edge-111.

## Spec Change Log

## Review Triage Log

Three reviewers (blind hunter, edge-case hunter, verification-gap), then triage. Patched in this story:
- medium (patch): a topic parameter named `x` shadowed the density's free variable, so a curve or pmf used the wrong value (edge case). The free variable is now a name longer than a parameter can be.
- medium (patch): the fitted line's y was clamped at the plot edge, which bent it away from the reported slope (edge case, verification gap). It is now cut where it leaves the box, solved for x.
- medium (patch): a coin or die with an irrelevant `sectors` that could not be computed drew nothing; the "values left out" sentence was lost when no data was left, and a scatter said nothing about points it dropped; the Urdu coin chart showed English H and T letters; a bar label was cut inside a character (a surrogate pair or a combining mark); a tiny but real probability read as 0.
- medium (patch): the schema accepted `params` that did not fit the distribution, bars and values of different lengths, and seeds that wrap at 2^32 (so two seeds could give one experiment). All three are refused now.
- low (patch): a standard deviation so small that the peak overflows made NaN coordinates; the shared empty result object could be mutated (every call returns its own); the dice topic's last step named 1000 on a slider whose grid ends at 996.
- Verification gaps closed by tests: the shaded area is a filled path in the markup, hidden `residuals` and `labels`, unknown part ids for every kind, a binomial driven by parameters, a parameter named `x`, the fit cut not bent, the coin letters in Urdu, the schema refusals.
Rejected:
- false: `lib/stats` importing other `lib` modules breaks the layer rule (lib may import lib); the scene is "missing" `quartiles` (they are inside `summarize` by design; spec bookkeeping fields are not edited).
- low: the dot plot crowds for about 100 distinct values (the radius floor keeps them visible); the binomial states rounded ends of a shade like 4.4 to 4.6 (the bars are whole numbers); the live region reads many sentences while a slider moves (the pattern of every viewer); with `fit` hidden the `noFit` sentence and residuals remain (separate parts); 1,000 trials on the dice slider.
- reject (edits the spec): the "two new prims" wording of the Intent.
Deferred: see `deferred-work.md`.

## Design Notes

Charts share one frame: a plot box from x 50 to 380 and y 30 to 250 in the 400 by 300 picture, axes with the `niceTicks` of `lib/graph`, and the value-to-picture maps in `charts.ts`. Probability uses the expression module through `program.fn` and `program.evaluate` on source text such as `normpdf(x, 0, 1)`, so the viewer and a later upload check compute the same number.

## Verification

**Commands:**
- `NEXT_DIST_DIR=.next-e2e npm run check` -- expected: all green
- `NEXT_DIST_DIR=.next-e2e npx playwright test --project=chrome-111 --project=edge-111` -- expected: all pass
