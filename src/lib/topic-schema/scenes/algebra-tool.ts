import { z } from 'zod';
import { compile, parse } from '../../expr';
import type { Kit } from '../kit';
import type { SceneDefinition } from '../scene-registry';
import { err, type Problem } from '../types';
import { commonSceneShape } from './common';
import { ALGEBRA_TOOL_META } from './meta';

// `algebra-tool@1` (topic-format 2.7, Story 3.4): one `tool` per scene. All interaction goes through parameters
// (sliders), so the scene stays pure. A step solver is self-checking: stage S5 evaluates both sides of every
// line at `variable = solution` and a false line is E_SOLVER_LINE.

export const SOLVER_TOLERANCE = 1e-9;

interface SolverScene {
  tool?: { kind?: unknown; variable?: unknown; solution?: unknown; lines?: unknown };
}

/** The problems of a step solver's lines (the registry `check` of this scene type). Never throws. */
export function checkSolverLines(scene: unknown): Problem[] {
  const tool = (scene as SolverScene | null)?.tool;
  if (!tool || tool.kind !== 'stepSolver' || !Array.isArray(tool.lines) || typeof tool.variable !== 'string' || typeof tool.solution !== 'number') return [];
  const variable = tool.variable;
  const solution = tool.solution;
  const scope = Object.assign(Object.create(null) as Record<string, number>, { [variable]: solution });
  const problems: Problem[] = [];
  (tool.lines as { lhs?: unknown; rhs?: unknown }[]).forEach((line, i) => {
    const sides: number[] = [];
    for (const side of ['lhs', 'rhs'] as const) {
      const src = line?.[side];
      const pointer = `/scene/tool/lines/${i}/${side}`;
      if (typeof src !== 'string') return;
      const parsed = parse(src, { scope: [variable] });
      if (!parsed.ok) {
        problems.push(err(parsed.error.code, pointer, `Expression '${src}': ${parsed.error.message} at position ${parsed.error.pos}.`));
        return;
      }
      sides.push(compile(parsed.value)(scope));
    }
    if (sides.length !== 2) return;
    const [l, r] = sides as [number, number];
    // A value that cannot be computed is not "equal" to anything, itself included.
    const equal = Number.isFinite(l) && Number.isFinite(r) && Math.abs(l - r) <= SOLVER_TOLERANCE * Math.max(1, Math.abs(l), Math.abs(r));
    if (!equal) problems.push(err('E_SOLVER_LINE', `/scene/tool/lines/${i}`, `stepSolver line ${i + 1} is not true at ${variable} = ${solution}.`));
  });
  return problems;
}

export const algebra_tool: SceneDefinition = {
  ...ALGEBRA_TOOL_META,
  check: checkSolverLines,
  schema: (kit: Kit) => {
    const pan = z.strictObject({ xs: kit.num, ones: kit.num });
    const tool = z.discriminatedUnion('kind', [
      // `x` is the hidden weight of one x-block; the beam tips by the sign of left minus right.
      z.strictObject({ kind: z.literal('balanceScale'), left: pan, right: pan, x: kit.num }),
      z.strictObject({ kind: z.literal('algebraTiles'), terms: z.strictObject({ x2: kit.num, x: kit.num, one: kit.num }), mode: z.enum(['expand', 'factor']) }),
      z.strictObject({ kind: z.literal('functionMachine'), input: kit.num, rule: kit.expr, showRule: z.boolean() }),
      z.strictObject({
        kind: z.literal('stepSolver'),
        variable: kit.ident,
        solution: z.number().finite(),
        lines: z.array(z.strictObject({ latex: z.string().min(1).max(200), lhs: kit.expr, rhs: kit.expr, note: kit.locText(120) })).min(2).max(8),
        // The parameter that says how many lines are shown.
        reveal: kit.ident,
      }),
    ]);
    return z.strictObject({
      type: z.literal('algebra-tool'),
      v: z.literal(1),
      ...commonSceneShape(kit),
      tool,
    });
  },
};
