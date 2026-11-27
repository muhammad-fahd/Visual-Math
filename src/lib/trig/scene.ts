import type { Program, Scope } from '../params';
import { buildUnitCircle, type Built } from './unit-circle';
import { toDegrees, type Unit } from './values';

// A `unit-circle` scene at one set of parameter values: the angle (read in the angle parameter's unit), the tangent
// switched by its `when`, and the wave's range in that unit. The viewer and the static picture both read this. Pure.

type Num = number | string;

export interface UnitCircleSceneLike {
  /** The id of the angle parameter. */
  angle: string;
  tangent?: { when?: string };
  wave?: { fn: 'sin' | 'cos' | 'tan'; from: Num; to: Num };
  quadrants?: boolean;
}

export function unitCircleAt(o: { scene: UnitCircleSceneLike; program: Program; scope: Scope; unit: Unit; hidden?: ReadonlySet<string> }): Built {
  const { scene, program, scope, unit } = o;
  const when = scene.tangent?.when;
  const w = when === undefined ? 1 : program.evaluate(when, scope);
  const wave = scene.wave ? { fn: scene.wave.fn, fromDeg: toDegrees(program.evaluate(scene.wave.from, scope), unit), toDeg: toDegrees(program.evaluate(scene.wave.to, scope), unit) } : null;
  return buildUnitCircle({
    angleDeg: toDegrees(scope[scene.angle] ?? NaN, unit),
    tangent: scene.tangent !== undefined && Number.isFinite(w) && w !== 0,
    wave,
    quadrants: scene.quadrants === true,
    hidden: o.hidden,
  });
}
