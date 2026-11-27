// Statistics and probability as pure data (Story 3.6): a seeded generator, descriptive statistics, regression, and the
// seven charts of the `stats` scene as the prims of the shared SVG renderer.
export { MAX_GENERATED, generate, mulberry32, outcomes } from './rng';
export type { Gen } from './rng';
export { bin, mean, median, regress, summarize } from './summary';
export type { Fit, Summary } from './summary';
export { LIMITS, buildChart } from './charts';
export type { BuildOptions, Built, Chart, Data } from './charts';
