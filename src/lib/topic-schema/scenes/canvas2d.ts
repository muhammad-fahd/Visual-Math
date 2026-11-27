import { z } from 'zod';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { commonSceneShape } from './common';
import { CANVAS2D_META } from './meta';

// `canvas2d@1` (topic-format 2.3): the window, the axes and the elements graphs need (Story 3.1), and the
// geometry elements (Story 3.2) that name `point` elements by id so one drag moves every shape built on them.
// The calculus elements arrive with Epic 4, each as an addition to the `type` union; a scene never lists an element its schema does not know (E_UNKNOWN_KEY).

export const COLOR_TOKENS = ['axis', 'grid', 'curve1', 'curve2', 'fill', 'accent', 'muted', 'success', 'error', 'hint', 'selected', 'edge', 'section'] as const;

export const canvas2d: SceneDefinition = {
  ...CANVAS2D_META,
  schema: (kit: Kit) => {
    const pt = z.tuple([kit.num, kit.num]);
    const style = z.strictObject({
      color: z.enum(COLOR_TOKENS).optional(),
      width: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      dash: z.enum(['solid', 'dashed', 'dotted']).optional(),
      marker: z.enum(['circle', 'square', 'diamond', 'triangle']).optional(),
      fill: z.enum(['none', 'light', 'medium']).optional(),
    });
    // Fields every element has (topic-format 2.1 rule 4).
    const common = { id: kit.eid, when: kit.expr.optional(), visible: z.boolean().optional(), style: style.optional() };
    const samples = z.int().min(10).max(1000).optional();

    const element = z.discriminatedUnion('type', [
      z.strictObject({
        ...common,
        type: z.literal('function'),
        expr: kit.expr,
        domain: z.tuple([kit.num, kit.num]).optional(),
        samples,
        label: kit.label.optional(),
        // Features to mark on the curve (FR-3.17).
        mark: z.array(z.enum(['intercepts', 'turning', 'asymptotes'])).max(3).optional(),
        // An inequality: the side of the curve that is tinted; a strict one has a dashed boundary.
        shade: z.enum(['above', 'below']).optional(),
        strict: z.boolean().optional(),
      }),
      z.strictObject({ ...common, type: z.literal('parametric'), x: kit.expr, y: kit.expr, t: z.tuple([kit.num, kit.num]), samples, label: kit.label.optional() }),
      z.strictObject({
        ...common,
        type: z.literal('point'),
        at: pt,
        drag: z.strictObject({ x: kit.ident.optional(), y: kit.ident.optional() }).optional(),
        label: kit.label.optional(),
        snap: z.strictObject({ step: z.number().positive().finite() }).optional(),
      }),
      z.strictObject({ ...common, type: z.literal('region'), between: z.tuple([kit.expr, kit.expr]), from: kit.num, to: kit.num }),
      // Geometry (FR-3.18): shapes name points by id; `measure` lists a length, angle, perimeter or area.
      z.strictObject({ ...common, type: z.literal('segment'), a: kit.eid, b: kit.eid, label: kit.label.optional(), measure: z.boolean().optional() }),
      z.strictObject({ ...common, type: z.literal('line'), through: z.tuple([kit.eid, kit.eid]), ray: z.boolean().optional(), label: kit.label.optional() }),
      z.strictObject({ ...common, type: z.literal('circle'), center: kit.eid, radius: kit.num.optional(), through: kit.eid.optional(), label: kit.label.optional(), measure: z.boolean().optional() }),
      z.strictObject({ ...common, type: z.literal('polygon'), points: z.array(z.union([kit.eid, pt])).min(3).max(12), label: kit.label.optional(), measure: z.boolean().optional() }),
      z.strictObject({ ...common, type: z.literal('angle'), points: z.tuple([kit.eid, kit.eid, kit.eid]), label: kit.label.optional(), measure: z.boolean().optional() }),
      z.strictObject({
        ...common,
        type: z.literal('transform'),
        of: kit.eid,
        how: z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('reflect'), over: z.union([z.literal('x'), z.literal('y'), z.tuple([kit.eid, kit.eid])]) }),
          z.strictObject({ kind: z.literal('rotate'), about: kit.eid.optional(), degrees: kit.num }),
          z.strictObject({ kind: z.literal('translate'), dx: kit.num, dy: kit.num }),
          z.strictObject({ kind: z.literal('scale'), about: kit.eid.optional(), k: kit.num }),
        ]),
        label: kit.label.optional(),
      }),
      z.strictObject({ ...common, type: z.literal('text'), at: pt, label: kit.label }),
      z.strictObject({ ...common, type: z.literal('readout'), at: pt, label: kit.locText(30), expr: kit.expr, decimals: z.int().min(0).max(6) }),
    ]);

    return z.strictObject({
      type: z.literal('canvas2d'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      viewport: z.strictObject({ xMin: kit.num, xMax: kit.num, yMin: kit.num, yMax: kit.num }),
      aspect: z.enum(['equal', 'free']).optional(),
      axes: z.strictObject({ show: z.boolean(), xLabel: kit.label.optional(), yLabel: kit.label.optional(), ticks: z.union([z.literal('auto'), z.int().min(2).max(20)]).optional() }).optional(),
      grid: z.boolean().optional(),
      pan: z.boolean().optional(),
      zoom: z.boolean().optional(),
      // A trace: a slider moves a cursor along the graph and the value of each curve is read out.
      trace: z.boolean().optional(),
      elements: z.array(element).min(1).max(60),
    });
  },
};
