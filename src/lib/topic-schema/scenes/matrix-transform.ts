import { z } from 'zod';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { MATRIX_TRANSFORM_META } from './meta';

// `matrix-transform@1` (topic-format 2.13, Story 4.4, FR-3.27): a 2 by 2 or 3 by 3 matrix applied to a grid, a flat shape or a
// cube, with the determinant as area or volume. Every entry is a number or an expression of the topic's parameters, so the
// entries are sliders and typed boxes; the scene itself stays pure.
const SHAPES_2D = ['unitSquare', 'unitGrid', 'triangle', 'letterF'] as const;

export const matrixTransform: SceneDefinition = {
  ...MATRIX_TRANSFORM_META,
  schema: (kit: Kit) =>
    z
      .strictObject({
        type: z.literal('matrix-transform'),
        v: z.literal(1),
        ...commonSceneShape(kit),
        dim: z.union([z.literal(2), z.literal(3)]),
        matrix: z.array(z.array(kit.num).min(2).max(3)).min(2).max(3),
        shape: z.enum(['unitSquare', 'unitGrid', 'triangle', 'letterF', 'unitCube']),
        showBasis: z.boolean().optional(),
        showDeterminant: z.boolean().optional(),
        // 0 is the identity, 1 the matrix; a number or an expression, clamped to 0..1 when drawn.
        progress: kit.num.optional(),
        // 2D only: the lines of the real eigenvectors, with their eigenvalues in the text.
        showEigen: z.boolean().optional(),
        // Half the side of the window (1 to 50; 4 if left out).
        range: kit.num.optional(),
        camera: z
          .union([
            z.strictObject({ azimuth: z.number().finite(), elevation: z.number().finite(), distance: z.number().finite().positive() }),
            z.strictObject({ preset: z.enum(['iso', 'front', 'top', 'side']) }),
          ])
          .optional(),
      })
      .superRefine((scene, ctx) => {
        const rows = scene.matrix;
        if (rows.length !== scene.dim || rows.some((r) => r.length !== scene.dim))
          ctx.addIssue({ code: 'custom', path: ['matrix'], message: `a ${scene.dim} by ${scene.dim} matrix has ${scene.dim} rows of ${scene.dim} numbers` });
        if (scene.dim === 2 && scene.shape === 'unitCube') ctx.addIssue({ code: 'custom', path: ['shape'], message: 'unitCube needs dim 3' });
        if (scene.dim === 3 && (SHAPES_2D as readonly string[]).includes(scene.shape) && scene.shape !== 'unitGrid')
          ctx.addIssue({ code: 'custom', path: ['shape'], message: `${scene.shape} needs dim 2 (in 3D use unitCube or unitGrid)` });
        if (scene.dim === 3 && scene.showEigen) ctx.addIssue({ code: 'custom', path: ['showEigen'], message: 'eigenvectors are shown in 2D only' });
        if (scene.dim === 2 && scene.camera) ctx.addIssue({ code: 'custom', path: ['camera'], message: 'a 2D scene has no camera' });
      }),
};
