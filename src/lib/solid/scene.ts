import type { Program, Scope } from '../params';
import { build, type Dims, type Kind, type Vec3 } from './kinds';
import type { SceneState } from './layers';
import { netRadius } from './net';

// What a `solid3d` scene says at one set of parameter values, in numbers (all through `lib/expr`): the dimensions,
// the section, the net and the liquid, and how large the picture is fitted. The viewer and the static picture
// (`static2D`) both read this, so a thumbnail is the picture the visitor starts with. Pure.

type Num = number | string;

export interface SolidSceneLike {
  solid: { kind: Kind; dims: Record<string, Num> };
  section?: { enabled: Num; plane?: { axis: 'x' | 'y' | 'z'; offset: Num }; normal?: [Num, Num, Num]; d?: Num };
  net?: { progress: Num };
  fill?: { level: Num };
}

/** The numbers of the scene's optional fields at these parameter values. */
export function stateOf(scene: SolidSceneLike, program: Program, scope: Scope): SceneState {
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const section = scene.section;
  return {
    section: section
      ? {
          enabled: num(section.enabled),
          plane: section.plane ? { axis: section.plane.axis, offset: num(section.plane.offset) } : undefined,
          normal: section.normal ? ([num(section.normal[0]), num(section.normal[1]), num(section.normal[2])] as Vec3) : undefined,
          d: section.d !== undefined ? num(section.d) : undefined,
        }
      : undefined,
    net: scene.net ? { progress: num(scene.net.progress) } : undefined,
    fill: scene.fill ? { level: num(scene.fill.level) } : undefined,
  };
}

/** The dimensions of the solid at these parameter values. */
export function dimsOf(dims: Record<string, Num>, program: Program, at: Record<string, number>): Dims {
  const scope = program.scope(at);
  return Object.fromEntries(Object.entries(dims).map(([name, source]) => [name, program.evaluate(source, scope)]));
}

/**
 * The picture is fitted to the largest the solid can get over the parameters' ranges, so a slider that grows it visibly
 * grows it (and a net that unfolds still fits).
 */
export function fitBase(kind: Kind, dimsAt: (at: Record<string, number>) => Dims, parameters: readonly { id: string; min: number; max: number; default: number }[], hasNet: boolean): number {
  const at = (pick: (p: { min: number; max: number; default: number }) => number) => Object.fromEntries(parameters.map((p) => [p.id, pick(p)]));
  const radii = [at((p) => p.min), at((p) => p.max), at((p) => p.default)].map((v) => {
    const g = build(kind, dimsAt(v));
    return hasNet ? Math.max(g.radius, netRadius(g)) : g.radius;
  });
  return Math.max(...radii.filter(Number.isFinite), 1e-6);
}
