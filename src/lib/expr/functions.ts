// The complete function whitelist (topic-format section 3). Pure functions of numbers. A domain
// error returns NaN, never throws. Builtins that loop report how many steps they use, and their
// input caps keep that bounded.

export interface Builtin {
  readonly min: number;
  readonly max: number;
  readonly run: (a: readonly number[]) => number;
  /** Extra steps this call costs beyond its own node, from its actual arguments. */
  readonly steps?: (a: readonly number[]) => number;
  /** The most `steps` can ever return (for the static cost). */
  readonly maxSteps: number;
}

const isInt = (x: number) => Number.isInteger(x);
/** n and k within the caps of nCr, nPr and binompmf. */
const validNk = (n: number, k: number) => isInt(n) && isInt(k) && n >= 0 && n <= 1000 && k >= 0 && k <= n;
const SAFE = Number.MAX_SAFE_INTEGER;
const EPS = 1e-12;

function fact(n: number): number {
  if (!isInt(n) || n < 0 || n > 170) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function nCr(n: number, k: number): number {
  if (!isInt(n) || !isInt(k) || n < 0 || n > 1000 || k < 0 || k > n) return NaN;
  const m = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= m; i++) r = (r * (n - m + i)) / i;
  return Math.round(r) === r || r > SAFE ? r : Math.round(r);
}

function nPr(n: number, k: number): number {
  if (!isInt(n) || !isInt(k) || n < 0 || n > 1000 || k < 0 || k > n) return NaN;
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

function gcd(a: number, b: number): number {
  if (!isInt(a) || !isInt(b) || Math.abs(a) > SAFE || Math.abs(b) > SAFE) return NaN;
  let x = Math.abs(a);
  let y = Math.abs(b);
  for (let i = 0; i < 100 && y !== 0; i++) [x, y] = [y, x % y]; // Euclid on 53 bits ends within about 80 rounds
  return y === 0 ? x : NaN;
}

function lcm(a: number, b: number): number {
  if (!isInt(a) || !isInt(b) || Math.abs(a) > SAFE || Math.abs(b) > SAFE) return NaN;
  if (a === 0 || b === 0) return 0;
  const g = gcd(a, b);
  if (Number.isNaN(g)) return NaN;
  const r = (Math.abs(a) / g) * Math.abs(b);
  return r > SAFE ? NaN : r;
}

/** Abramowitz and Stegun 7.1.26: error below 1.5e-7, a handful of operations. */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return s * (1 - poly * Math.exp(-z * z));
}

function normpdf(x: number, mean: number, sd: number): number {
  if (!(sd > 0)) return NaN;
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

function normcdf(x: number, mean: number, sd: number): number {
  if (!(sd > 0)) return NaN;
  const z = (x - mean) / sd;
  return z === 0 ? 0.5 : 0.5 * (1 + erf(z / Math.SQRT2));
}

function binompmf(n: number, k: number, p: number): number {
  if (!isInt(n) || !isInt(k) || n < 0 || n > 1000 || k < 0 || k > n || !(p >= 0 && p <= 1)) return NaN;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  let lnC = 0;
  for (let i = 1; i <= k; i++) lnC += Math.log((n - k + i) / i);
  return Math.exp(lnC + k * Math.log(p) + (n - k) * Math.log1p(-p));
}

const roundHalfAway = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

function mod(a: number, b: number): number {
  if (b === 0) return NaN;
  const r = a % b;
  return r !== 0 && r < 0 !== b < 0 ? r + b : r;
}

const unary = (f: (x: number) => number): Pick<Builtin, 'min' | 'max' | 'maxSteps'> & { run: (a: readonly number[]) => number } => ({
  min: 1,
  max: 1,
  maxSteps: 0,
  run: (a) => f(a[0]!),
});
const binary = (f: (x: number, y: number) => number): Builtin => ({ min: 2, max: 2, maxSteps: 0, run: (a) => f(a[0]!, a[1]!) });
const ternary = (f: (x: number, y: number, z: number) => number): Builtin => ({ min: 3, max: 3, maxSteps: 0, run: (a) => f(a[0]!, a[1]!, a[2]!) });

export const BUILTINS: ReadonlyMap<string, Builtin> = new Map<string, Builtin>([
  // Trigonometry (radians)
  ['sin', unary(Math.sin)],
  ['cos', unary(Math.cos)],
  ['tan', unary((x) => (Math.abs(Math.cos(x)) < EPS ? NaN : Math.tan(x)))],
  ['sec', unary((x) => (Math.abs(Math.cos(x)) < EPS ? NaN : 1 / Math.cos(x)))],
  ['csc', unary((x) => (Math.abs(Math.sin(x)) < EPS ? NaN : 1 / Math.sin(x)))],
  ['cot', unary((x) => (Math.abs(Math.sin(x)) < EPS ? NaN : Math.cos(x) / Math.sin(x)))],
  ['asin', unary((x) => (x < -1 || x > 1 ? NaN : Math.asin(x)))],
  ['acos', unary((x) => (x < -1 || x > 1 ? NaN : Math.acos(x)))],
  ['atan', unary(Math.atan)],
  ['atan2', binary(Math.atan2)],
  // Hyperbolic
  ['sinh', unary(Math.sinh)],
  ['cosh', unary(Math.cosh)],
  ['tanh', unary(Math.tanh)],
  // Angle
  ['rad', unary((x) => (x * Math.PI) / 180)],
  ['deg', unary((x) => (x * 180) / Math.PI)],
  // Powers and logarithms
  ['sqrt', unary((x) => (x < 0 ? NaN : Math.sqrt(x)))],
  ['cbrt', unary(Math.cbrt)],
  ['pow', binary(Math.pow)],
  ['exp', unary(Math.exp)],
  ['ln', unary((x) => (x > 0 ? Math.log(x) : NaN))],
  ['log10', unary((x) => (x > 0 ? Math.log10(x) : NaN))],
  ['log2', unary((x) => (x > 0 ? Math.log2(x) : NaN))],
  ['log', binary((v, b) => (v > 0 && b > 0 && b !== 1 ? Math.log(v) / Math.log(b) : NaN))],
  ['hypot', binary(Math.hypot)],
  // Rounding and sign
  ['abs', unary(Math.abs)],
  ['sign', unary(Math.sign)],
  ['floor', unary(Math.floor)],
  ['ceil', unary(Math.ceil)],
  ['round', unary(roundHalfAway)],
  ['trunc', unary(Math.trunc)],
  // Comparison
  ['min', { min: 2, max: 8, maxSteps: 0, run: (a) => Math.min(...a) }],
  ['max', { min: 2, max: 8, maxSteps: 0, run: (a) => Math.max(...a) }],
  ['clamp', ternary((v, lo, hi) => (lo > hi ? NaN : Math.min(Math.max(v, lo), hi)))],
  ['mod', binary(mod)],
  // Logic: every argument is evaluated, so the cost is the same whatever the condition
  ['if', ternary((c, a, b) => (Number.isNaN(c) ? NaN : c !== 0 ? a : b))],
  // Discrete: input caps keep the work bounded
  ['fact', { min: 1, max: 1, run: (a) => fact(a[0]!), steps: (a) => (isInt(a[0]!) && a[0]! > 1 && a[0]! <= 170 ? a[0]! : 0), maxSteps: 170 }],
  ['nCr', { min: 2, max: 2, run: (a) => nCr(a[0]!, a[1]!), steps: (a) => (validNk(a[0]!, a[1]!) ? Math.min(a[1]!, a[0]! - a[1]!) : 0), maxSteps: 500 }],
  ['nPr', { min: 2, max: 2, run: (a) => nPr(a[0]!, a[1]!), steps: (a) => (validNk(a[0]!, a[1]!) ? a[1]! : 0), maxSteps: 1000 }],
  ['gcd', { min: 2, max: 2, run: (a) => gcd(a[0]!, a[1]!), steps: () => 100, maxSteps: 100 }],
  ['lcm', { min: 2, max: 2, run: (a) => lcm(a[0]!, a[1]!), steps: () => 100, maxSteps: 100 }],
  // Statistics
  ['normpdf', ternary(normpdf)],
  ['normcdf', ternary(normcdf)],
  ['binompmf', { min: 3, max: 3, run: (a) => binompmf(a[0]!, a[1]!, a[2]!), steps: (a) => (validNk(a[0]!, a[1]!) ? a[1]! : 0), maxSteps: 1000 }],
]);

/** `sum` and `prod` are special forms handled by the parser; they are listed so error messages name them. */
export const SPECIAL_FORMS = ['sum', 'prod'] as const;

export const FUNCTION_NAMES: readonly string[] = [...BUILTINS.keys(), ...SPECIAL_FORMS].sort();
