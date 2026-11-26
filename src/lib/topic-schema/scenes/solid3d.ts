import { z } from 'zod';
import { DIMS, KINDS, type Kind } from '../../solid';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { SOLID3D_META } from './meta';

// `solid3d@1` (topic-format 2.8): one of nine solids whose measurements are numbers or expressions of
// the topic's parameters. Cross-section, net and fill are added by Story 2.5 as optional fields.
export const solid3d: SceneDefinition = {
  ...SOLID3D_META,
  schema: (kit: Kit) => {
    const dimsOf = (kind: Kind) =>
      z.strictObject(Object.fromEntries(DIMS[kind].map((name) => [name, name === 'sides' ? z.union([z.int().min(3).max(12), kit.expr]) : kit.num])));
    const solids = KINDS.map((kind) => z.strictObject({ kind: z.literal(kind), dims: dimsOf(kind) }));
    return z.strictObject({
      type: z.literal('solid3d'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      solid: z.union(solids as unknown as [(typeof solids)[number], (typeof solids)[number], ...(typeof solids)[number][]]),
      labels: z.strictObject({ dimensions: z.boolean() }).optional(),
      camera: z
        .union([
          z.strictObject({ azimuth: z.number().finite(), elevation: z.number().finite(), distance: z.number().finite().positive() }),
          z.strictObject({ preset: z.enum(['iso', 'front', 'top', 'side']) }),
        ])
        .optional(),
    });
  },
};
