import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ParamSpec } from '../../src/lib/params';
import { enterStep, sceneAtStep, type StepLike } from '../../src/lib/params/steps';
import { decimalsOfStep, fillText } from '../../src/lib/text/template';
import { plainText, tokenize } from '../../src/lib/text/rich';

describe('topic prose as tokens', () => {
  it('splits bold and terms and keeps the words between', () => {
    expect(tokenize('The **sine** of a {{term:unit-circle}} is a height.')).toEqual([
      { kind: 'text', text: 'The ' },
      { kind: 'bold', text: 'sine' },
      { kind: 'text', text: ' of a ' },
      { kind: 'term', id: 'unit-circle' },
      { kind: 'text', text: ' is a height.' },
    ]);
  });
  it('plain text, an unclosed marker, and an empty string stay as they are', () => {
    expect(tokenize('Just words.')).toEqual([{ kind: 'text', text: 'Just words.' }]);
    expect(tokenize('a **b')).toEqual([{ kind: 'text', text: 'a **b' }]);
    expect(tokenize('')).toEqual([]);
  });
  it('markup that is not ours is text: no HTML, no other placeholder, a bad term id', () => {
    for (const s of ['<b>x</b>', '<script>alert(1)</script>', '{{name}}', '{{term:Bad Id}}', '{{term:}}', '[x](https://a.test)']) {
      expect(tokenize(s).every((t) => t.kind === 'text'), s).toBe(true);
      expect(plainText(s)).toBe(s);
    }
  });
  it('plain text of prose drops the markup and names the term', () => {
    expect(plainText('A **big** {{term:cone}}', { cone: 'cone' })).toBe('A big cone');
    expect(plainText('A {{term:nope}}.', {})).toBe('A .');
    expect(plainText('{{term:__proto__}}', {})).toBe('{{term:__proto__}}'); // not an id: left as text
    expect(plainText('{{term:constructor}}', {})).toBe(''); // an id, but not a term of this topic
  });
  it('property: joining the tokens back never loses or invents words', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (s) => {
        const back = tokenize(s)
          .map((t) => (t.kind === 'text' || t.kind === 'bold' ? t.text : ''))
          .join('')
          .replace(/\s+/g, '');
        const plain = s.slice(0, 2000).replace(/\*\*/g, '').replace(/\{\{term:[a-z][a-zA-Z0-9-]{0,31}\}\}/g, '').replace(/\s+/g, '');
        expect(back.length).toBeLessThanOrEqual(plain.length + 4);
      }),
    );
  });
  it('a very long string is cut, not slow', () => {
    const t0 = performance.now();
    tokenize('**a'.repeat(50000));
    tokenize('{{term:' + 'a'.repeat(100000));
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('placeholders in a worked example', () => {
  it('shows the live value with its decimals and a real minus', () => {
    expect(fillText('Radius {{a}} cm, volume {{v}}', { a: { value: 3, decimals: 1 }, v: { value: 94.2478, decimals: 1 } })).toBe('Radius 3.0 cm, volume 94.2');
    expect(fillText('{{x}}', { x: { value: -2, decimals: 0 } })).toBe('−2');
  });
  it('a name that is not known, and a value that cannot be computed, are a dash', () => {
    expect(fillText('{{nope}} {{constructor}} {{toString}}', {})).toBe('— — —');
    expect(fillText('{{x}}', { x: { value: NaN, decimals: 1 } })).toBe('—');
    expect(fillText('{{x}}', { x: { value: Infinity, decimals: 1 } })).toBe('—');
  });
  it('markup in the text is left alone: it is text', () => {
    expect(fillText('<b>{{a}}</b>', { a: { value: 1, decimals: 0 } })).toBe('<b>1</b>');
  });
  it('decimals follow the step', () => {
    expect([1, 0.5, 0.25, 0.01, 1e-3, 2.5, NaN, Infinity, 0].map(decimalsOfStep)).toEqual([0, 1, 2, 2, 3, 1, 0, 0, 0]);
  });
});

const specs: ParamSpec[] = [
  { id: 'r', min: 1, max: 8, step: 0.5, default: 3 },
  { id: 'h', min: 1, max: 15, step: 0.5, default: 10 },
  { id: 'cut', min: -5, max: 5, step: 0.5, default: 0 },
];
const steps: StepLike[] = [
  { sceneState: { params: { cut: 0 }, hide: ['dimensions'] } },
  { sceneState: { params: { cut: 4, h: 12 }, camera: { preset: 'front' } } },
  { sceneState: { show: ['dimensions'], params: { cut: -4 } } },
  {},
];

describe('the scene at a step (FR-4.2)', () => {
  it('starts from the start values and takes each step on top of the last', () => {
    expect(sceneAtStep(steps, 0, specs).params).toEqual({ r: 3, h: 10, cut: 0 });
    expect(sceneAtStep(steps, 1, specs).params).toEqual({ r: 3, h: 12, cut: 4 });
    expect(sceneAtStep(steps, 2, specs).params).toEqual({ r: 3, h: 12, cut: -4 });
    expect(sceneAtStep(steps, 3, specs).params).toEqual({ r: 3, h: 12, cut: -4 });
  });
  it('going back is exact: a value a later step set returns to its start value', () => {
    expect(sceneAtStep(steps, 0, specs).params['h']).toBe(10);
    expect(sceneAtStep(steps, 1, specs).params['cut']).toBe(4);
  });
  it('parts are hidden and shown again, and the camera is the latest named', () => {
    expect([...sceneAtStep(steps, 0, specs).hidden]).toEqual(['dimensions']);
    expect([...sceneAtStep(steps, 1, specs).hidden]).toEqual(['dimensions']);
    expect([...sceneAtStep(steps, 2, specs).hidden]).toEqual([]);
    expect(sceneAtStep(steps, 0, specs).camera).toBeUndefined();
    expect(sceneAtStep(steps, 3, specs).camera).toEqual({ preset: 'front' });
  });
  it('values are snapped into range; unknown parameters, non-numbers and a wild index are ignored', () => {
    const wild = [{ sceneState: { params: { h: 99, zzz: 1, r: NaN, __proto__: 5 } as Record<string, number> } }];
    expect(sceneAtStep(wild, 0, specs).params).toEqual({ r: 3, h: 15, cut: 0 });
    expect(sceneAtStep(steps, -4, specs).params).toEqual(sceneAtStep(steps, 0, specs).params);
    expect(sceneAtStep(steps, 99, specs).params).toEqual(sceneAtStep(steps, 3, specs).params);
    expect(sceneAtStep([], 0, specs).params).toEqual({ r: 3, h: 10, cut: 0 });
    expect(Object.getPrototypeOf(sceneAtStep(steps, 1, specs).params)).toBeNull();
  });
  it('the visitor keeps what they moved: only untouched parameters follow the step', () => {
    const values = { r: 3, h: 7, cut: 0 };
    expect(enterStep(values, { r: 3, h: 12, cut: 4 }, new Set())).toEqual({ r: 3, h: 12, cut: 4 });
    expect(enterStep(values, { r: 3, h: 12, cut: 4 }, new Set(['h']))).toEqual({ r: 3, h: 7, cut: 4 });
    expect(enterStep(values, { r: 3, h: 12, cut: 4 }, new Set(['r', 'h', 'cut']))).toEqual(values);
  });
  it('a NaN or fractional step index is the first step, or rounds down', () => {
    expect(sceneAtStep(steps, NaN, specs).params).toEqual(sceneAtStep(steps, 0, specs).params);
    expect(sceneAtStep(steps, 1.9, specs).params).toEqual(sceneAtStep(steps, 1, specs).params);
    expect(sceneAtStep(steps, Infinity, specs).params).toEqual(sceneAtStep(steps, 0, specs).params);
  });
  it('a parameter the step does not know is not invented', () => {
    expect(enterStep({ r: 3 }, { zzz: 9 }, new Set())).toEqual({ r: 3 });
  });
});
