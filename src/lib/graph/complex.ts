// Complex numbers for the Argand diagram (FR-3.24, Story 4.2): pure arithmetic on pairs `[re, im]`, with the polar form
// in degrees. A result that cannot be computed is `null` or not finite, never a throw, so a renderer draws nothing.
// This is the one place complex numbers are computed; `lib/expr` stays real-valued.

import { format } from '../expr';

export type C = readonly [number, number];

/** A number past this size is left out of the picture and the text: it could not be seen and may overflow. */
export const REACH = 1e6;

export const isFiniteC = (z: C): boolean => Number.isFinite(z[0]) && Number.isFinite(z[1]);
export const inReach = (z: C): boolean => isFiniteC(z) && Math.abs(z[0]) <= REACH && Math.abs(z[1]) <= REACH;

export const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
export const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const conj = (a: C): C => [a[0], -a[1]];
export const modulus = (a: C): number => Math.hypot(a[0], a[1]);

const DEG = 180 / Math.PI;

/** The argument in degrees in (-180, 180]; null for zero, which has no direction. */
export function argument(a: C): number | null {
  if (!isFiniteC(a) || (a[0] === 0 && a[1] === 0)) return null;
  const d = Math.atan2(a[1], a[0]) * DEG;
  // atan2 gives -180 for a negative real with a negative zero imaginary part: that number is 180.
  return d <= -180 ? 180 : d;
}

/** The number with this modulus and argument (degrees). */
export const fromPolar = (r: number, degrees: number): C => [r * Math.cos((degrees * Math.PI) / 180), r * Math.sin((degrees * Math.PI) / 180)];

/** z to the n by De Moivre (exact on the axes for whole turns: the tiny parts that rounding leaves are cleaned). */
export function power(z: C, n: number): C {
  if (!isFiniteC(z) || !Number.isInteger(n) || n < 0) return [NaN, NaN];
  const r = modulus(z);
  const a = argument(z);
  if (a === null) return n === 0 ? [1, 0] : [0, 0];
  return clean(fromPolar(r ** n, a * n));
}

/** The n-th roots of z, counter-clockwise from the one with the smallest argument; empty for zero or a bad `n`. */
export function roots(z: C, n: number): C[] {
  if (!isFiniteC(z) || !Number.isInteger(n) || n < 1) return [];
  const a = argument(z);
  if (a === null) return [];
  const r = modulus(z) ** (1 / n);
  return Array.from({ length: n }, (_, k) => clean(fromPolar(r, (a + 360 * k) / n)));
}

/** Rounds away the 1e-16 dust a cosine or a sine leaves on an axis, so 1, i, -1 and -i come out exactly. */
export function clean(z: C): C {
  const scale = Math.max(1, Math.abs(z[0]), Math.abs(z[1]));
  const snap = (x: number) => (Math.abs(x) < 1e-12 * scale ? 0 : x);
  return [snap(z[0]), snap(z[1])];
}

const trimmed = (n: number, digits: number) => format(n, digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** A number as a person writes it: `3 + 4i`, `3 \u2212 4i`, `-1`, `2i`, `i`, `0`. At most `digits` decimals. */
export function formatComplex(z: C, digits = 2): string {
  const re = trimmed(z[0], digits);
  const imAbs = trimmed(Math.abs(z[1]), digits);
  const reZero = re === '0' || re === '\u22120' || re === '-0';
  const imZero = imAbs === '0';
  const coefficient = imAbs === '1' ? '' : imAbs;
  if (imZero) return reZero ? '0' : re;
  const imaginary = `${coefficient}i`;
  if (reZero) return z[1] < 0 ? `\u2212${imaginary}` : imaginary;
  return `${re} ${z[1] < 0 ? '\u2212' : '+'} ${imaginary}`;
}
