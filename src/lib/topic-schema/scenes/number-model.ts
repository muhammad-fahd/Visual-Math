import { z } from 'zod';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { NUMBER_MODEL_META } from './meta';

// `number-model@1` (topic-format 2.6, Story 3.3): one `model` per scene. A field that is exactly a parameter id
// is the one the visitor drags; the viewer clamps and rounds counts, so the limits below only keep a topic sane.

export const number_model: SceneDefinition = {
  ...NUMBER_MODEL_META,
  schema: (kit: Kit) => {
    const model = z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('numberLine'),
        min: kit.num,
        max: kit.num,
        step: kit.num,
        // The draggable point (a parameter id), and the fixed marks and jumps.
        marker: kit.num.optional(),
        marks: z.array(z.strictObject({ at: kit.num, label: kit.label.optional() })).max(12).optional(),
        jumps: z.array(z.strictObject({ from: kit.num, to: kit.num })).max(6).optional(),
      }),
      z.strictObject({
        kind: z.literal('fractionBars'),
        rows: z.array(z.strictObject({ num: kit.num, den: kit.num })).min(1).max(4),
        alignLine: z.boolean().optional(),
      }),
      z.strictObject({ kind: z.literal('fractionCircle'), num: kit.num, den: kit.num }),
      z.strictObject({ kind: z.literal('areaModel'), rows: kit.num, cols: kit.num, splitRows: kit.num.optional(), splitCols: kit.num.optional() }),
      z.strictObject({ kind: z.literal('tenFrame'), count: kit.num }),
      z.strictObject({ kind: z.literal('placeValue'), value: kit.num }),
      z.strictObject({ kind: z.literal('percentGrid'), percent: kit.num }),
    ]);
    return z.strictObject({
      type: z.literal('number-model'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      model,
    });
  },
};
