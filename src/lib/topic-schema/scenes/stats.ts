import { z } from 'zod';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { STATS_META } from './meta';

// `stats@1` (topic-format 2.11, Story 3.6): one `chart` per scene. Chance is a seeded generator, so the scene stays
// pure. Not in this version: dragging scatter points (a point's value is a `Num`, so a slider moves it) and the
// probability tree. A simulation names its experiment `sim` (the chart's own `kind` is `simulation`).

const SEED = z.int().min(0).max(4294967295);
const DIST_PARAMS = { normal: 'mean,sd', binomial: 'n,p', uniform: 'a,b' } as const;

export const stats: SceneDefinition = {
  ...STATS_META,
  schema: (kit: Kit) => {
    const values = (max: number) => z.array(z.number().finite()).min(1).max(max);
    const gen = z.strictObject({
      gen: z.strictObject({ n: kit.num, dist: z.enum(['normal', 'uniform']), mean: kit.num.optional(), sd: kit.num.optional(), seed: SEED }),
    });
    const data = (max: number) => z.union([values(max), gen]);
    const chart = z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('dotPlot'), data: data(100) }),
      z.strictObject({ kind: z.literal('histogram'), data: data(500), bins: kit.num, showMean: z.boolean().optional(), showMedian: z.boolean().optional() }),
      z.strictObject({ kind: z.literal('boxplot'), data: data(500), showOutliers: z.boolean().optional() }),
      z.strictObject({ kind: z.literal('scatter'), points: z.array(z.tuple([kit.num, kit.num])).min(1).max(100), fit: z.literal('linear').optional(), showResiduals: z.boolean().optional() }),
      z
        .strictObject({ kind: z.literal('bar'), categories: z.array(kit.label).min(1).max(12), values: z.array(kit.num).min(1).max(12) })
        .refine((c) => c.categories.length === c.values.length, { message: 'needs one value for each category' }),
      z
        .strictObject({
          kind: z.literal('distribution'),
          dist: z.enum(['normal', 'binomial', 'uniform']),
          // normal: mean, sd; binomial: n, p; uniform: a, b.
          params: kit.record(kit.num),
          shade: z.strictObject({ from: kit.num, to: kit.num }).optional(),
        })
        .refine((c) => [...Object.keys(c.params)].sort().join() === DIST_PARAMS[c.dist], { message: 'params must be exactly mean and sd (normal), n and p (binomial), or a and b (uniform)' }),
      z.strictObject({ kind: z.literal('simulation'), sim: z.enum(['coin', 'die', 'spinner']), trials: kit.num, seed: SEED, sectors: kit.num.optional() }),
    ]);
    return z.strictObject({
      type: z.literal('stats'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      chart,
    });
  },
};
