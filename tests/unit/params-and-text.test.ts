import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkTyped, createProgram, defaults, snap, type ParamSpec } from '../../src/lib/params';
import { fillFormula, MATH_OPTIONS, plainMath, renderMath } from '../../src/lib/text';

const H: ParamSpec = { id: 'h', min: 1, max: 10, step: 0.5, default: 4 };

describe('slider snapping', () => {
  it('stays in range and on the step grid', () => {
    expect(snap(H, 4.3)).toBe(4.5);
    expect(snap(H, 99)).toBe(10);
    expect(snap(H, -3)).toBe(1);
    expect(snap({ ...H, step: 0.1, min: 0, max: 1 }, 0.30000000000000004)).toBe(0.3);
  });
  it('a value that is not a number falls back to the default', () => {
    expect(snap(H, NaN)).toBe(4);
    expect(snap(H, Infinity)).toBe(4);
  });
  it('property: the result is always in range and a whole number of steps from the minimum', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6 }), (v) => {
        const out = snap(H, v);
        expect(out).toBeGreaterThanOrEqual(H.min);
        expect(out).toBeLessThanOrEqual(H.max);
        expect(Math.abs((out - H.min) / H.step - Math.round((out - H.min) / H.step))).toBeLessThan(1e-9);
      }),
    );
  });
});

describe('typed values (FR-3.7)', () => {
  it('accepts a number in range, in Western or Urdu digits, and keeps it exact', () => {
    expect(checkTyped(H, '7.25')).toEqual({ ok: true, value: 7.25 });
    expect(checkTyped(H, '٧٫٥')).toEqual({ ok: true, value: 7.5 });
    expect(checkTyped(H, '۷')).toEqual({ ok: true, value: 7 });
  });
  it('the ends of the range are in range', () => {
    expect(checkTyped(H, '1').ok).toBe(true);
    expect(checkTyped(H, '10').ok).toBe(true);
  });
  it('out of range is "range", anything but one finite number is "format"', () => {
    expect(checkTyped(H, '99')).toEqual({ ok: false, reason: 'range' });
    expect(checkTyped(H, '0.99')).toEqual({ ok: false, reason: 'range' });
    for (const bad of ['abc', '', '1e999', '3+4', '1,5', 'NaN', 'Infinity', '--1', '0x10']) expect(checkTyped(H, bad), bad).toEqual({ ok: false, reason: 'format' });
    for (const odd of [null, undefined, 5, {}, []]) expect(checkTyped(H, odd).ok).toBe(false);
  });
  it('an integer parameter refuses a fraction', () => {
    expect(checkTyped({ ...H, kind: 'integer' }, '4.5')).toEqual({ ok: false, reason: 'format' });
    expect(checkTyped({ ...H, kind: 'integer' }, '4')).toEqual({ ok: true, value: 4 });
  });
});

describe('the scope a scene is drawn from', () => {
  it('parameters, then derived values in order; a bad expression is NaN, never a throw', () => {
    const program = createProgram(['r', 'h'], [
      { id: 'area', expr: 'pi * r^2' },
      { id: 'vol', expr: 'area * h / 3' },
      { id: 'broken', expr: '1 +' },
    ]);
    const scope = program.scope({ r: 3, h: 10 });
    expect(scope['vol']).toBeCloseTo(94.2478, 3);
    expect(scope['broken']).toBeNaN();
    expect(program.evaluate('h / 0', scope)).toBeNaN();
    expect(program.evaluate(7, scope)).toBe(7);
    expect(program.evaluate(NaN, scope)).toBeNaN();
  });
  it('the scope has no prototype, so an inherited name is not a value', () => {
    const program = createProgram(['h']);
    const scope = program.scope(defaults([H]));
    expect(Object.getPrototypeOf(scope)).toBeNull();
    expect(program.evaluate('constructor', scope)).toBeNaN();
  });
});

describe('live formulas (FR-3.8, AD-14)', () => {
  const latex = String.raw`V = \tfrac{1}{3} \times \pi \times {{r}}^2 \times {{h}} = {{v}}`;
  it('fills each placeholder with its formatted value', () => {
    expect(fillFormula(latex, { r: { value: 3, decimals: 1 }, h: { value: 10, decimals: 0 }, v: { value: 94.2478, decimals: 1 } })).toBe(
      String.raw`V = \tfrac{1}{3} \times \pi \times 3.0^2 \times 10 = 94.2`,
    );
  });
  it('a negative value shows a real minus sign', () => {
    expect(fillFormula('{{x}}', { x: { value: -2.5, decimals: 1 } })).toBe('−2.5');
    expect(fillFormula('{{x}}', { x: { value: -0.001, decimals: 1 } })).toBe('0.0');
  });
  it('an undefined value is the code-inserted text; an unbound name is a dash', () => {
    expect(fillFormula('{{x}}', { x: { value: NaN, decimals: 1 } })).toBe(String.raw`\text{undefined}`);
    expect(fillFormula('{{x}}', { x: { value: Infinity, decimals: 1 } })).toBe(String.raw`\text{undefined}`);
    expect(fillFormula('{{y}}', {})).toBe(String.raw`\text{--}`);
    expect(fillFormula('{{constructor}}', {})).toBe(String.raw`\text{--}`);
  });
  it('property: whatever the value, only a plain number, a minus, or the fixed texts can come out', () => {
    fc.assert(
      fc.property(fc.double(), fc.integer({ min: -3, max: 9 }), (value, decimals) => {
        const out = fillFormula('{{x}}', { x: { value, decimals } });
        expect(out).toMatch(/^(−?\d+(\.\d+)?|\\text\{undefined\}|\\text\{--\})$/);
      }),
    );
  });
  it('the values are never read as LaTeX: a name that looks like a command stays a dash', () => {
    expect(fillFormula(String.raw`{{x}}`, { x: { value: 1, decimals: 0 }, '\\href': { value: 1, decimals: 0 } })).toBe('1');
  });
});

describe('math rendering', () => {
  it('there is one frozen options object with the policy of AD-14', () => {
    expect(Object.isFrozen(MATH_OPTIONS)).toBe(true);
    expect(MATH_OPTIONS).toMatchObject({ trust: false, strict: 'error', throwOnError: true, maxSize: 20, maxExpand: 200, output: 'htmlAndMathml' });
  });
  it('renders HTML with MathML, and a real minus sign', () => {
    const html = renderMath(String.raw`V = \tfrac{1}{3} \times \pi \times 3^2 \times 10 = −94.2\ \text{cm}^3`, { inline: true })!;
    expect(html).toContain('katex-html');
    expect(html).toContain('<math');
    expect(html).toContain('cm');
  });
  // The command allowlist (\def and the rest) is the upload stage's job, Story 7.1; here KaTeX's own refusals are seen.
  // The command allowlist (\def and the rest) is the upload stage's job, Story 7.1; here KaTeX's own refusals are seen.
  it.each([String.raw`\href{https://x.test}{a}`, String.raw`\unknowncommand`, '{',String.raw`\includegraphics{x}`])('refuses %s without throwing', (bad) => {
    expect(renderMath(bad, { inline: true })).toBeNull();
  });
  it('plain text of a formula for a label', () => {
    expect(plainMath(String.raw`V = \tfrac{1}{3} \times \pi \times 3^2`)).toBe('V = (1)/(3) × π × 3^2');
  });
});
