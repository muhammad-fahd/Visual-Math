import { z } from 'zod';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { RIGHT_TRIANGLE_META } from './meta';

// `right-triangle@1` (topic-format 2.5, Story 3.5): a right triangle given by two sides or by an angle and the
// hypotenuse, with the angle's ratios. The numbers are `Num`s, so sliders can change a side.
export const rightTriangle: SceneDefinition = {
  ...RIGHT_TRIANGLE_META,
  schema: (kit) =>
    z.strictObject({
      type: z.literal('right-triangle'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      given: z.discriminatedUnion('mode', [
        z.strictObject({ mode: z.literal('sides'), adjacent: kit.num, opposite: kit.num }),
        // The angle is in degrees, 1 to 89 (the viewer clamps it).
        z.strictObject({ mode: z.literal('angle'), angle: kit.num, hypotenuse: kit.num }),
      ]),
      labels: z.enum(['abc', 'opp-adj-hyp']).optional(),
      ratios: z
        .array(z.enum(['sin', 'cos', 'tan']))
        .max(3)
        .refine((a) => new Set(a).size === a.length, { message: 'lists a ratio twice' })
        .optional(),
    }),
};
