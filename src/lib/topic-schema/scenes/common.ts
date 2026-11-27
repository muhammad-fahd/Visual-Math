import { z } from 'zod';
import type { Kit } from '../kit';

/** Fields every scene has (topic-format 2.1), as a shape to spread into a scene type's strict object. */
export function commonSceneShape(kit: Kit) {
  return {
    caption: kit.locText(120),
    description: kit.locText(600, false).optional(),
    readouts: z
      .array(
        z.strictObject({
          id: kit.eid,
          label: kit.locText(30),
          expr: kit.expr,
          decimals: z.int().min(0).max(6),
          unit: kit.unit.optional(),
        }),
      )
      .max(4)
      .optional(),
  };
}
