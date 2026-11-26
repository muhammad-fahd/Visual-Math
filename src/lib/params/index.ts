import { parseTyped } from '../expr';

// The rules for a parameter a visitor can change (FR-3.6, 3.7): the slider snaps to its step, a typed
// value is exact but must be one finite number inside the range. Pure.

export interface ParamSpec {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly kind?: 'number' | 'integer' | 'toggle' | 'choice';
}

/** A value kept inside the range and on the step grid that starts at `min`. */
export function snap(spec: ParamSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.default;
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  const steps = Math.round((clamped - spec.min) / spec.step);
  const onGrid = spec.min + steps * spec.step;
  // Floating point: 0.1 + 0.2 must not show as 0.30000000000000004.
  const decimals = Math.min(10, Math.max(decimalsOf(spec.step), decimalsOf(spec.min)));
  const out = Number(Math.min(spec.max, onGrid).toFixed(decimals));
  return spec.kind === 'integer' ? Math.round(out) : out;
}

function decimalsOf(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const text = String(n);
  if (text.includes('e-')) return Math.min(10, Number(text.split('e-')[1]));
  return text.split('.')[1]?.length ?? 0;
}

export type Typed = { ok: true; value: number } | { ok: false; reason: 'format' | 'range' };

/** What the box beside a slider does with what was typed; anything but `ok` leaves the old value in place. */
export function checkTyped(spec: ParamSpec, raw: unknown): Typed {
  const parsed = parseTyped(raw);
  if (!parsed.ok) return { ok: false, reason: 'format' };
  const v = parsed.value;
  if (v < spec.min || v > spec.max) return { ok: false, reason: 'range' };
  if (spec.kind === 'integer' && !Number.isInteger(v)) return { ok: false, reason: 'format' };
  return { ok: true, value: v };
}

/** The values of every parameter at its default, as a record with no prototype (topic-format 1). */
export function defaults(specs: readonly ParamSpec[]): Record<string, number> {
  const out: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const s of specs) out[s.id] = s.default;
  return out;
}
export { createProgram } from './scope';
export type { DerivedSpec, Program, Scope } from './scope';

/** What is written after a number for each unit of the topic format. */
export function unitSymbol(unit: string | undefined): string {
  switch (unit) {
    case 'deg':
      return '°';
    case 'percent':
      return '%';
    case 'rad':
    case 'cm':
    case 'm':
    case 'units':
      return ` ${unit}`;
    default:
      return '';
  }
}
