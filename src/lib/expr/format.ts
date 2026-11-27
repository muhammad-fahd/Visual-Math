// How a computed value is shown: fixed decimals, Western digits, a real minus sign (U+2212), and an
// em dash for "undefined" (NaN and infinities). Math in Urdu pages stays left-to-right (FR-3.28).

const MINUS = '−';
const UNDEFINED = '—';

export function format(value: number, decimals = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return UNDEFINED;
  const places = Number.isInteger(decimals) ? Math.min(20, Math.max(0, decimals)) : 2;
  const text = Math.abs(value) >= 1e21 ? Math.abs(value).toExponential(Math.min(places, 20)) : Math.abs(value).toFixed(places);
  // A value that rounds to zero has no sign: "-0.0" would read as a result of its own.
  const isZero = /^0(?:\.0*)?$/.test(text);
  return value < 0 && !isZero ? MINUS + text : text;
}
