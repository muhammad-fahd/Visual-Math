import { format } from '../expr';

// The numbers of trigonometry (FR-3.21, NFR-6.2): the three ratios of an angle, their exact forms at the special
// angles, radians as a fraction of pi, snapping to special angles, and the quadrant. Pure.

const RAD = Math.PI / 180;
const MINUS = '−';
/** Below this a cosine is zero for our purposes: the tangent is undefined. */
export const POLE = 1e-9;

export type Unit = 'deg' | 'rad';
export const toDegrees = (value: number, unit: Unit): number => (unit === 'rad' ? value / RAD : value);
export const fromDegrees = (deg: number, unit: Unit): number => (unit === 'rad' ? deg * RAD : deg);

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

export interface Ratios {
  sin: number;
  cos: number;
  /** null where the cosine is zero (90 and 270 degrees). */
  tan: number | null;
}

export function trigValues(deg: number): Ratios {
  const sin = clean(Math.sin(deg * RAD));
  const cos = clean(Math.cos(deg * RAD));
  return { sin, cos, tan: Math.abs(cos) < POLE ? null : clean(sin / cos) };
}

/** 0 to 360 for any finite angle. */
export const normalize = (deg: number): number => ((deg % 360) + 360) % 360;

/** 1 to 4, or 'axis' exactly on an axis. */
export function quadrant(deg: number): 1 | 2 | 3 | 4 | 'axis' {
  const d = normalize(deg);
  const r = d % 90;
  if (r < 1e-9 || 90 - r < 1e-9) return 'axis';
  return (Math.floor(d / 90) + 1) as 1 | 2 | 3 | 4;
}

const SIN_REF: Record<number, string> = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' };
const TAN_REF: Record<number, string | null> = { 0: '0', 30: '√3/3', 45: '1', 60: '√3', 90: null };

/**
 * The exact form of sin, cos or tan at an angle that is a multiple of 30 or of 45 degrees ("1/2", "√3/2"), else null.
 * An undefined tangent is null too: the caller says "undefined" for it.
 */
export function exactValue(fn: 'sin' | 'cos' | 'tan', deg: number): string | null {
  if (!Number.isFinite(deg)) return null;
  const whole = Math.round(deg);
  if (Math.abs(deg - whole) > 1e-9) return null;
  const d = normalize(whole);
  if (d % 30 !== 0 && d % 45 !== 0) return null;
  const q = Math.floor(d / 90);
  const ref = q === 0 ? d : q === 1 ? 180 - d : q === 2 ? d - 180 : 360 - d;
  const sign = { sin: [1, 1, -1, -1], cos: [1, -1, -1, 1], tan: [1, -1, 1, -1] }[fn][q]!;
  const base = fn === 'sin' ? SIN_REF[ref] : fn === 'cos' ? SIN_REF[90 - ref] : TAN_REF[ref];
  if (base === undefined || base === null) return null;
  return base === '0' || sign > 0 ? base : `${MINUS}${base}`;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Radians as text: a fraction of π at multiples of 15 degrees ("π/6", "5π/6", "2π"), else a decimal. */
export function radText(deg: number): string {
  if (!Number.isFinite(deg)) return format(NaN);
  const k = deg / 15;
  if (Math.abs(k - Math.round(k)) < 1e-9) {
    const n0 = Math.round(k);
    if (n0 === 0) return '0';
    const g = gcd(Math.abs(n0), 12);
    const n = Math.abs(n0) / g;
    const d = 12 / g;
    const top = n === 1 ? 'π' : `${n}π`;
    const text = d === 1 ? top : `${top}/${d}`;
    return n0 < 0 ? `${MINUS}${text}` : text;
  }
  return trim(deg * RAD);
}

export const trim = (n: number, d = 4): string => format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** The special angles in degrees, 0 to 360: every multiple of 30 and of 45. */
export const SPECIAL_DEGREES: readonly number[] = [...new Set([...Array.from({ length: 13 }, (_, i) => i * 30), ...Array.from({ length: 9 }, (_, i) => i * 45)])].sort((a, b) => a - b);

/** `value` moved to the nearest of `values` when one is within `within`; otherwise unchanged. */
export function snapAngle(value: number, values: readonly number[], within: number): number {
  if (!Number.isFinite(value) || !(within > 0)) return value;
  let best: number | null = null;
  for (const s of values) {
    if (!Number.isFinite(s)) continue;
    if (Math.abs(value - s) <= within && (best === null || Math.abs(value - s) < Math.abs(value - best))) best = s;
  }
  return best ?? value;
}

export interface PointerAngle {
  /** The pointer relative to the circle's centre in picture units, x to the right and y UP. */
  dx: number;
  dy: number;
  unit: Unit;
  /** The parameter now, and its range, in its unit. */
  current: number;
  min: number;
  max: number;
  snapValues: readonly number[];
  within: number;
}

/**
 * The angle a pointer means, in the parameter's unit. A turn more or less is tried too (so a range of -180 to 180 or
 * 0 to 90 works), each candidate snaps to a special value near it (also across 0 and 360), and of those in range the one
 * nearest the current value wins. `snapped` says the value is an exact special angle: it must not be moved onto the
 * parameter's step grid. Null at the centre, where there is no direction.
 */
export function angleFromPointer(o: PointerAngle): { value: number; snapped: boolean } | null {
  if (!(Number.isFinite(o.dx) && Number.isFinite(o.dy)) || (o.dx === 0 && o.dy === 0)) return null;
  const v = fromDegrees(normalize((Math.atan2(o.dy, o.dx) * 180) / Math.PI), o.unit);
  const turn = fromDegrees(360, o.unit);
  let best: { value: number; snapped: boolean } | null = null;
  for (const c of [v - turn, v, v + turn]) {
    const s = snapAngle(c, o.snapValues, o.within);
    if (s < o.min - 1e-9 || s > o.max + 1e-9) continue;
    if (best === null || Math.abs(s - o.current) < Math.abs(best.value - o.current)) best = { value: s, snapped: s !== c };
  }
  return best ?? { value: Math.min(o.max, Math.max(o.min, v)), snapped: false };
}

/** The next value of `values` above (or below) `value`, or null at the end. */
export function nextSpecial(value: number, values: readonly number[], up: boolean): number | null {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  const eps = 1e-9;
  return (up ? sorted.find((s) => s > value + eps) : [...sorted].reverse().find((s) => s < value - eps)) ?? null;
}
