import { z } from 'zod';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { SPACE3D_META } from './meta';

// `space3d@1` (topic-format 2.x, Story 4.1, FR-3.22): 3D axes holding points, vectors, derived vectors (sum, scaled,
// cross), a dot product, lines and planes. Every number is a number or an expression of the topic's parameters, so the
// visitor edits the scene with the sliders and typed boxes; the scene itself stays pure. Elements are listed in the
// order they are drawn, and a derived element names earlier ones by id.
export const space3d: SceneDefinition = {
  ...SPACE3D_META,
  schema: (kit: Kit) => {
    const vec3 = z.tuple([kit.num, kit.num, kit.num]);
    const label = kit.label.optional();
    const element = z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('point'), id: kit.eid, at: vec3, label }),
      z.strictObject({ type: z.literal('vector'), id: kit.eid, from: vec3.optional(), to: vec3, label }),
      z.strictObject({ type: z.literal('op'), id: kit.eid, op: z.enum(['add', 'scale', 'cross']), of: z.array(kit.eid).min(1).max(4), k: kit.num.optional(), label }),
      z.strictObject({ type: z.literal('dot'), id: kit.eid, a: kit.eid, b: kit.eid, label }),
      z.strictObject({ type: z.literal('line'), id: kit.eid, point: vec3, direction: vec3, label }),
      z.strictObject({ type: z.literal('plane'), id: kit.eid, normal: vec3, d: kit.num, label }),
    ]);
    return z
      .strictObject({
        type: z.literal('space3d'),
        v: z.literal(1),
        ...commonSceneShape(kit),
        // Half the side of the axes box (1 to 50; 6 if left out).
        range: kit.num.optional(),
        elements: z.array(element).min(1).max(24),
        camera: z
          .union([
            z.strictObject({ azimuth: z.number().finite(), elevation: z.number().finite(), distance: z.number().finite().positive() }),
            z.strictObject({ preset: z.enum(['iso', 'front', 'top', 'side']) }),
          ])
          .optional(),
      })
      .superRefine((scene, ctx) => {
        // Ids are unique, and a derived element names an earlier vector or derived vector (a cross of one vector, a
        // scale of two, an add of one are shape errors the schema can see; a missing id is checked at upload by S2).
        const seen = new Set<string>();
        scene.elements.forEach((el, i) => {
          if (seen.has(el.id)) ctx.addIssue({ code: 'custom', path: ['elements', i, 'id'], message: `the id '${el.id}' is used twice` });
          seen.add(el.id);
          if (el.type !== 'op') return;
          const need = el.op === 'scale' ? 1 : el.op === 'cross' ? 2 : null;
          if (need !== null && el.of.length !== need) ctx.addIssue({ code: 'custom', path: ['elements', i, 'of'], message: `${el.op} takes ${need} vector${need === 1 ? '' : 's'}` });
          if (el.op === 'add' && el.of.length < 2) ctx.addIssue({ code: 'custom', path: ['elements', i, 'of'], message: 'add takes two or more vectors' });
          if (el.op === 'scale' && el.k === undefined) ctx.addIssue({ code: 'custom', path: ['elements', i, 'k'], message: 'scale needs k, the number to scale by' });
        });
      });
  },
};
