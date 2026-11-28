import { z } from 'zod';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { SURFACE3D_META } from './meta';

// `surface3d@1` (topic-format 2.14, Story 4.5, FR-3.23): the surface z = f(x, y) over a window, with an optional probe point
// that reads out z and the two slopes. The expression may use `x`, `y` and the topic's parameters, so the visitor changes the
// surface with the sliders and typed boxes; the scene itself stays pure.
export const surface3d: SceneDefinition = {
  ...SURFACE3D_META,
  schema: (kit: Kit) => {
    const window2 = z.tuple([kit.num, kit.num]);
    return z
      .strictObject({
        type: z.literal('surface3d'),
        v: z.literal(1),
        ...commonSceneShape(kit),
        expr: kit.expr,
        // The window of x and of y, from and to (-3 to 3 if left out).
        x: window2.optional(),
        y: window2.optional(),
        // Cells along each side (6 to 32; 20 if left out).
        grid: z.int().min(6).max(32).optional(),
        // Half the side of the axes box (1 to 50; 6 if left out); z outside it is clamped.
        range: kit.num.optional(),
        probe: z.strictObject({ x: kit.num, y: kit.num }).optional(),
        showWire: z.boolean().optional(),
        camera: z
          .union([
            z.strictObject({ azimuth: z.number().finite(), elevation: z.number().finite(), distance: z.number().finite().positive() }),
            z.strictObject({ preset: z.enum(['iso', 'front', 'top', 'side']) }),
          ])
          .optional(),
      })
      .superRefine((scene, ctx) => {
        for (const axis of ['x', 'y'] as const) {
          const w = scene[axis];
          if (w && typeof w[0] === 'number' && typeof w[1] === 'number' && w[0] >= w[1]) ctx.addIssue({ code: 'custom', path: [axis], message: `the window of ${axis} must go from a smaller number to a larger one` });
        }
      });
  },
};
