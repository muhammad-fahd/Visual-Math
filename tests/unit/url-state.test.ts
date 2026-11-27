import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ParamSpec } from '../../src/lib/params';
import { URL_MAX, mergeUrlState, parseUrlState, serializeUrlState } from '../../src/lib/params/url';

const specs: ParamSpec[] = [
  { id: 'r', min: 1, max: 8, step: 0.5, default: 3 },
  { id: 'h', min: 1, max: 15, step: 0.5, default: 10 },
  { id: 'cut', min: -5, max: 5, step: 0.5, default: 0 },
];
const parse = (q: string, steps = 4) => parseUrlState(specs, steps, q);

describe('parseUrlState (AD-6)', () => {
  it('reads the step (1-based in the address) and the parameters', () => {
    const s = parse('?step=2&p.r=5&p.cut=-2');
    expect(s.step).toBe(1);
    expect({ ...s.params }).toEqual({ r: 5, cut: -2 });
  });
  it('no query, or a query it does not know, is no state', () => {
    for (const q of ['', '?', '?utm_source=x', '?foo=1&bar=2', '?r=5', '?p=5', '?p.=1']) {
      const s = parse(q);
      expect(s.step, q).toBeNull();
      expect(Object.keys(s.params), q).toEqual([]);
    }
  });
  it('clamps every value to its range and snaps it to its grid', () => {
    const s = parse('?p.r=9999&p.h=-4&p.cut=2.3&step=99');
    expect({ ...s.params }).toEqual({ r: 8, h: 1, cut: 2.5 });
    expect(s.step).toBe(3);
    expect(parse('?step=0').step).toBe(0);
    expect(parse('?step=-5').step).toBe(0);
  });
  it('drops unknown keys, inherited names and other prefixes', () => {
    const s = parse('?p.__proto__=1&p.constructor=1&p.toString=1&p.zzz=1&q.r=4&P.r=4&evil=1&p.r=4');
    expect({ ...s.params }).toEqual({ r: 4 });
    expect(Object.getPrototypeOf(s.params)).toBeNull();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
  it('the first of a repeated key wins', () => {
    expect({ ...parse('?p.r=2&p.r=7').params }).toEqual({ r: 2 });
    expect(parse('?step=2&step=4').step).toBe(1);
  });
  it('accepts either digit set, and refuses what is not one finite number', () => {
    expect({ ...parse('?p.r=٥').params }).toEqual({ r: 5 });
    expect({ ...parse('?p.r=۵&p.h=١٢٫٥').params }).toEqual({ r: 5, h: 12.5 });
    for (const bad of ['abc', '', '1e999', '3+4', '1,5', 'NaN', 'Infinity', '--1', '0x10', '1 2x', '%00']) {
      expect(Object.keys(parse(`?p.r=${encodeURIComponent(bad)}`).params), bad).toEqual([]);
    }
    expect(parse('?step=2.5').step).toBeNull();
    expect(parse('?step=abc').step).toBeNull();
  });
  it('percent-encoding is decoded; a broken one is just text and dropped', () => {
    expect({ ...parse('?p%2Er=5').params }).toEqual({ r: 5 });
    expect(Object.keys(parse('?p.r=%E0%A4%A').params)).toEqual([]);
  });
  it('a query over the limit is ignored whole; one at the limit is read', () => {
    expect(parse(`?p.r=5&x=${'a'.repeat(URL_MAX)}`).params).toEqual(Object.create(null));
    expect({ ...parse(`?p.r=5&x=${'a'.repeat(URL_MAX - 20)}`).params }).toEqual({ r: 5 });
  });
  it('a topic with no steps has no step; no parameters is fine', () => {
    expect(parseUrlState(specs, 0, '?step=2').step).toBeNull();
    expect({ ...parseUrlState([], 3, '?p.r=5&step=2').params }).toEqual({});
  });
  it('anything that is not a string is no state, not a crash', () => {
    for (const v of [undefined, null, 5, {}, []]) expect(() => parseUrlState(specs, 3, v as unknown as string)).not.toThrow();
  });
  it('property: whatever the query, the result is in range, on the grid, only known keys, and no prototype', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (q) => {
        const s = parse(q);
        expect(Object.getPrototypeOf(s.params)).toBeNull();
        for (const [id, v] of Object.entries(s.params)) {
          const spec = specs.find((x) => x.id === id)!;
          expect(spec).toBeDefined();
          expect(v).toBeGreaterThanOrEqual(spec.min);
          expect(v).toBeLessThanOrEqual(spec.max);
          expect(Math.abs((v - spec.min) / spec.step - Math.round((v - spec.min) / spec.step))).toBeLessThan(1e-9);
        }
        if (s.step !== null) {
          expect(s.step).toBeGreaterThanOrEqual(0);
          expect(s.step).toBeLessThan(4);
        }
      }),
      { numRuns: 400 },
    );
  });
  it('property: structured hostile queries never throw and never leave the known keys', () => {
    const key = fc.oneof(fc.constantFrom('step', 'p.r', 'p.h', 'p.cut', 'p.__proto__', 'p.constructor', 'evil', 'p.'), fc.string({ maxLength: 8 }));
    const value = fc.oneof(fc.double(), fc.string({ maxLength: 12 }), fc.constantFrom('1e999', '-0', '٣', 'NaN'));
    fc.assert(
      fc.property(fc.array(fc.tuple(key, value), { maxLength: 12 }), (pairs) => {
        const q = '?' + pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        const s = parse(q);
        for (const id of Object.keys(s.params)) expect(['r', 'h', 'cut']).toContain(id);
      }),
      { numRuns: 300 },
    );
  });
});

describe('serializeUrlState', () => {
  it('writes the step when it is not the first, and the changed parameters, sorted', () => {
    expect(serializeUrlState({ step: 1, params: { r: 5, cut: -2 } })).toBe('?step=2&p.cut=-2&p.r=5');
    expect(serializeUrlState({ step: 0, params: { r: 5 } })).toBe('?p.r=5');
    expect(serializeUrlState({ step: 0, params: {} })).toBe('');
    expect(serializeUrlState({ step: 3, params: {} })).toBe('?step=4');
  });
  it('leaves out anything that is not a finite number', () => {
    expect(serializeUrlState({ step: 0, params: { r: NaN, h: Infinity, cut: 1 } })).toBe('?p.cut=1');
    expect(serializeUrlState({ step: NaN, params: {} })).toBe('');
  });
  it('property: what is written is read back the same', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.record({ r: fc.integer({ min: 2, max: 16 }).map((n) => n / 2), cut: fc.integer({ min: -10, max: 10 }).map((n) => n / 2) }), (step, params) => {
        const back = parse(serializeUrlState({ step, params }));
        expect(back.step ?? 0).toBe(step);
        expect({ ...back.params }).toEqual(params);
      }),
    );
  });
});

describe('mergeUrlState', () => {
  it('replaces the own keys of this page and leaves every other key as it was', () => {
    expect(mergeUrlState('?topic=section&step=3&p.r=5&utm=x', { step: 1, params: { cut: 2 } })).toBe('?topic=section&utm=x&step=2&p.cut=2');
    expect(mergeUrlState('?topic=section&step=3&p.r=5', { step: 0, params: {} })).toBe('?topic=section');
    expect(mergeUrlState('', { step: 0, params: {} })).toBe('');
    expect(mergeUrlState('?p.r=1&p.r=2', { step: 0, params: { r: 4 } })).toBe('?p.r=4');
  });
  it('is stable: merging the same state twice changes nothing', () => {
    const once = mergeUrlState('?topic=x', { step: 2, params: { r: 5 } });
    expect(mergeUrlState(once, { step: 2, params: { r: 5 } })).toBe(once);
  });
  it('a query that is not text is a clean start', () => {
    expect(mergeUrlState(undefined as unknown as string, { step: 1, params: {} })).toBe('?step=2');
  });
});
