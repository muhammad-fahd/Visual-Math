import { z } from 'zod';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { UNIT_CIRCLE_META } from './meta';

// `unit-circle@1` (topic-format 2.4). The first registered scene: the one the worked example uses.
export const unitCircle: SceneDefinition = {
  ...UNIT_CIRCLE_META,
  schema: (kit) =>
    z.strictObject({
      type: z.literal('unit-circle'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      // The draggable angle parameter; its unit must be deg or rad (checked against the parameters in S2).
      angle: kit.ident,
      snap: z.strictObject({ values: z.array(z.number().finite()).max(24), within: z.number().positive().finite() }).optional(),
      tangent: z.strictObject({ when: kit.expr.optional() }).optional(),
      wave: z.strictObject({ fn: z.enum(['sin', 'cos', 'tan']), from: kit.num, to: kit.num }).optional(),
      quadrants: z.boolean().optional(),
    }),
};
