/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { Canvas2DViewer, type Canvas2DTopic } from '../../src/features/scene';
import { buildDrawables, type Canvas2DScene } from '../../src/lib/graph';
import { createProgram } from '../../src/lib/params';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';
import { Canvas2D } from '../../src/scenes/canvas2d';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// canvas2d@1 as a scene type: the schema, the fixture topic, and the drawables and picture it makes.

const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const load = () => JSON.parse(readFileSync('content/fixtures/alg-quadratic-graph.json', 'utf8')) as any;
const mutated = (edit: (d: any) => void) => {
  const d = load();
  edit(d);
  return d;
};
const ok = (doc: unknown) => validator.validate(doc).ok;

describe('the quadratic graph topic', () => {
  it('passes the topic schema', () => {
    const r = validator.validate(load());
    expect(r.ok, r.ok ? '' : JSON.stringify(r.problems)).toBe(true);
  });
  it('its formula checks come out as the topic says', () => {
    const topic = load();
    const program = createProgram(topic.parameters.map((p: any) => p.id), topic.derived);
    const defaults = Object.fromEntries(topic.parameters.map((p: any) => [p.id, p.default]));
    for (const f of topic.formulas) {
      for (const check of f.checks) {
        const scope = program.scope({ ...defaults, ...check.at });
        for (const [name, expected] of Object.entries(check.expect) as [string, number][]) {
          expect(Math.abs(program.evaluate(f.bind[name].expr, scope) - expected), `${f.id}.${name}`).toBeLessThanOrEqual(0.5 * 10 ** -f.bind[name].decimals);
        }
      }
    }
  });
  it('the worked example recomputes to what it says', () => {
    const ex = load().example;
    const program = createProgram(['r'], [{ id: 'v', expr: ex.lines[0].calc.expr }]);
    expect(Math.abs(program.scope({ r: 3 })['v']! - 0)).toBeLessThan(0.05);
  });
});

describe('canvas2d@1 in the topic schema', () => {
  it('refuses a missing viewport, no elements, too many elements, an unknown element, an unknown key', () => {
    expect(ok(mutated((d) => delete d.scene.viewport))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements = [])))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements = Array.from({ length: 61 }, (_, i) => ({ id: `e${i}`, type: 'function', expr: 'x' })))))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].type = 'polygon')))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].extra = 1)))).toBe(false);
    expect(ok(mutated((d) => (d.scene.surprise = true)))).toBe(false);
  });
  it('limits samples, marks and the shade values', () => {
    expect(ok(mutated((d) => (d.scene.elements[0].samples = 1001)))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].samples = 9)))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].samples = 1000)))).toBe(true);
    expect(ok(mutated((d) => (d.scene.elements[0].mark = ['roots'])))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].shade = 'left')))).toBe(false);
    expect(ok(mutated((d) => Object.assign(d.scene.elements[0], { shade: 'below', strict: true })))).toBe(true);
  });
  it('a style takes color tokens, never a hex color, and known dashes and markers', () => {
    expect(ok(mutated((d) => (d.scene.elements[0].style = { color: 'curve2', dash: 'dashed', marker: 'square', width: 3 })))).toBe(true);
    expect(ok(mutated((d) => (d.scene.elements[0].style = { color: '#ff0000' })))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].style = { dash: 'wavy' })))).toBe(false);
    expect(ok(mutated((d) => (d.scene.elements[0].style = { width: 4 })))).toBe(false);
  });
  it('a point needs two coordinates; the other element kinds validate', () => {
    expect(ok(mutated((d) => (d.scene.elements[2].at = ['px'])))).toBe(false);
    expect(
      ok(
        mutated((d) => {
          d.scene.elements.push({ id: 'circ', type: 'parametric', x: 'cos(t)', y: 'sin(t)', t: [0, 6.3], samples: 200 });
          d.scene.elements.push({ id: 'area', type: 'region', between: ['x', 'x^2'], from: 0, to: 1 });
          d.scene.elements.push({ id: 'note', type: 'text', at: [0, 1], label: { latex: 'x^2' } });
          d.scene.elements.push({ id: 'out', type: 'readout', at: [0, 1], label: { en: 'v', ur: 'و' }, expr: 'px', decimals: 2 });
        }),
      ),
    ).toBe(true);
  });
  it('an element the schema does not know yet (the calculus ones, Epic 4) is refused', () => {
    expect(ok(mutated((d) => d.scene.elements.push({ id: 'rs', type: 'riemann', expr: 'x', from: 0, to: 1, n: 4 })))).toBe(false);
  });
});

const scene = (extra: Partial<Canvas2DScene> & { elements: Canvas2DScene['elements'] }): Canvas2DScene => ({ viewport: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 }, ...extra });
const draw = (s: Canvas2DScene, params: Record<string, number> = {}, over: Partial<Parameters<typeof buildDrawables>[0]> = {}) => {
  const program = createProgram(Object.keys(params));
  return buildDrawables({ scene: s, program, scope: program.scope(params), view: { scale: 1, panX: 0, panY: 0 }, ...over });
};

describe('what a scene is made of (buildDrawables)', () => {
  it('two curves with no style get different dash and marker as well as color', () => {
    const d = draw(scene({ elements: [{ id: 'f', type: 'function', expr: 'x' }, { id: 'g', type: 'function', expr: '-x' }] }));
    const [a, b] = d.curves.map((c) => c.style);
    expect(a!.color).not.toBe(b!.color);
    expect(a!.dash).not.toBe(b!.dash);
    expect(a!.marker).not.toBe(b!.marker);
    const four = draw(scene({ elements: Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, type: 'function' as const, expr: `x + ${i}` })) }));
    expect(new Set(four.curves.map((c) => `${c.style.dash}/${c.style.marker}`)).size).toBe(4);
  });
  it('an author style wins; a strict inequality has a dashed boundary and a tinted side', () => {
    const d = draw(scene({ elements: [{ id: 'f', type: 'function', expr: 'x^2 - 4', shade: 'below', strict: true, style: { color: 'error' } }, { id: 'g', type: 'function', expr: 'x', shade: 'above' }] }));
    expect(d.curves[0]!.style).toMatchObject({ color: 'error', dash: 'dashed' });
    expect(d.curves[0]!.shade).toMatchObject({ side: 'below', strict: true });
    expect(d.curves[0]!.shade!.polygons.length).toBeGreaterThan(0);
    expect(d.curves[1]!.shade!.strict).toBe(false);
  });
  it('the tinted region of "below" reaches the bottom of the window, of "above" the top', () => {
    const d = draw(scene({ elements: [{ id: 'f', type: 'function', expr: '0', shade: 'below' }, { id: 'g', type: 'function', expr: '0', shade: 'above' }] }));
    expect(Math.min(...d.curves[0]!.shade!.polygons[0]!.map((p) => p[1]))).toBe(d.viewport.yMin);
    expect(Math.max(...d.curves[1]!.shade!.polygons[0]!.map((p) => p[1]))).toBe(d.viewport.yMax);
  });
  it('a point is draggable only when each coordinate is exactly the parameter it moves', () => {
    const p = { px: 1, py: 2 };
    const bound = draw(scene({ elements: [{ id: 'p', type: 'point', at: ['px', 'py'], drag: { x: 'px', y: 'py' } }] }), p).points[0]!;
    expect(bound.drag).toEqual({ x: 'px', y: 'py' });
    const xOnly = draw(scene({ elements: [{ id: 'p', type: 'point', at: ['px', 'py'], drag: { x: 'px' } }] }), p).points[0]!;
    expect(xOnly.drag).toEqual({ x: 'px', y: null });
    const notExact = draw(scene({ elements: [{ id: 'p', type: 'point', at: ['px + 1', 'py'], drag: { x: 'px' } }] }), p).points[0]!;
    expect(notExact.drag).toBeNull();
    expect(draw(scene({ elements: [{ id: 'p', type: 'point', at: ['px', 'py'] }] }), p).points[0]!.drag).toBeNull();
    expect(draw(scene({ elements: [{ id: 'p', type: 'point', at: [3, 4], drag: { x: 'px' } }] }), p).points[0]!.drag).toBeNull();
  });
  it('a point whose position cannot be computed is not drawn', () => {
    expect(draw(scene({ elements: [{ id: 'p', type: 'point', at: ['1/0', 2] }] })).points).toEqual([]);
  });
  it('hidden elements are not drawn; an invisible one appears when a step shows it; `when` switches an element', () => {
    const els: Canvas2DScene['elements'] = [{ id: 'a', type: 'function', expr: 'x' }, { id: 'b', type: 'function', expr: 'x', visible: false }, { id: 'c', type: 'function', expr: 'x', when: 'k' }];
    expect(draw(scene({ elements: els }), { k: 0 }).curves.map((c) => c.id)).toEqual(['a']);
    expect(draw(scene({ elements: els }), { k: 1 }).curves.map((c) => c.id)).toEqual(['a', 'c']);
    expect(draw(scene({ elements: els }), { k: 1 }, { shown: new Set(['b']) }).curves.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(draw(scene({ elements: els }), { k: 1 }, { hidden: new Set(['a', 'zzz']) }).curves.map((c) => c.id)).toEqual(['c']);
  });
  it('marks are found only on the curves that ask for them', () => {
    const d = draw(scene({ elements: [{ id: 'f', type: 'function', expr: 'x^2 - 1', mark: ['intercepts', 'turning'] }, { id: 'g', type: 'function', expr: 'x^2 - 1' }] }));
    expect(d.curves[0]!.features!.roots).toHaveLength(2);
    expect(d.curves[0]!.features!.turning).toHaveLength(1);
    expect(d.curves[1]!.features).toBeNull();
  });
  it('the trace reads each function at the cursor; an undefined value is NaN', () => {
    const d = draw(scene({ elements: [{ id: 'f', type: 'function', expr: 'x^2' }, { id: 'g', type: 'function', expr: 'sqrt(x)' }] }), {}, { traceX: -2 });
    expect(d.curves[0]!.traceY).toBe(4);
    expect(d.curves[1]!.traceY).toBeNaN();
    expect(draw(scene({ elements: [{ id: 'f', type: 'function', expr: 'x' }] })).curves[0]!.traceY).toBeNull();
  });
  it('a viewport that depends on a parameter follows it; a broken one becomes a safe window', () => {
    const s = scene({ viewport: { xMin: '-a', xMax: 'a', yMin: -1, yMax: 1 }, aspect: 'free', elements: [{ id: 'f', type: 'function', expr: 'x' }] });
    expect(draw(s, { a: 5 }).viewport.xMax).toBe(5);
    expect(draw({ ...s, viewport: { xMin: 'nope(', xMax: 1, yMin: 0, yMax: 1 } }, { a: 5 }).viewport).toEqual({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
  });
  it('a hostile expression is nothing drawn, not a throw', () => {
    const els: Canvas2DScene['elements'] = [
      { id: 'a', type: 'function', expr: 'constructor(1)' },
      { id: 'b', type: 'function', expr: '1 +' },
      { id: 'c', type: 'parametric', x: '__proto__', y: 'x(', t: [0, 1] },
      { id: 'd', type: 'region', between: ['nope', 'x'], from: 0, to: 1 },
    ];
    expect(() => draw(scene({ elements: els }))).not.toThrow();
    const d = draw(scene({ elements: els }));
    expect(d.curves.every((c) => c.segments.length === 0)).toBe(true);
    expect(d.regions[0]!.polygons).toEqual([]);
  });
  it('zoom and pan change the window the curve is drawn in; the declared window is the unzoomed one', () => {
    const els: Canvas2DScene['elements'] = [{ id: 'f', type: 'function', expr: 'x' }];
    expect(draw(scene({ elements: els }), {}, { view: { scale: 2, panX: 0, panY: 0 } }).viewport.xMax).toBe(4);
    expect(draw(scene({ elements: els }), {}, { view: { scale: 1, panX: 0.25, panY: 0 } }).viewport.xMin).toBe(-12);
  });
});

describe('the picture (static markup)', () => {
  const labelText = () => '';
  const readoutText = (_l: Record<string, string>, v: number) => String(v);
  const markup = (s: Canvas2DScene, params: Record<string, number> = {}) => renderToStaticMarkup(createElement(Canvas2D, { drawables: draw(s, params), axes: true, grid: true, labelText, readoutText }));
  it('renders without a browser: axes, a curve, markers, and nothing that listens', () => {
    const out = markup(scene({ elements: [{ id: 'f', type: 'function', expr: 'x^2 - 1', mark: ['intercepts', 'turning'] }] }));
    expect(out).toContain('data-canvas2d');
    expect(out).toContain('data-element="f"');
    expect(out).toContain('stroke-axis');
    expect(out).not.toMatch(/ on[A-Z]\w+=|onclick/i);
    expect(out).not.toMatch(/["' ]#[0-9a-fA-F]{3,8}["' ;]/); // an id reference like url(#clip) is fine; a color value is not
  });
  it('a vertical asymptote is a dashed line, and a broken function draws two paths', () => {
    const out = markup(scene({ elements: [{ id: 'f', type: 'function', expr: '1/x', mark: ['asymptotes'] }] }));
    expect(out).toContain('data-kind="asymptote"');
    expect(out).toContain('stroke-dasharray="5 3"');
    const paths = out.match(/<path d="M[^"]*"[^>]*stroke-width="1.8"/g) ?? [];
    expect(paths.length).toBe(2);
  });
  it('two curves differ in dasharray as well as in color class', () => {
    const out = markup(scene({ elements: [{ id: 'f', type: 'function', expr: 'x' }, { id: 'g', type: 'function', expr: '-x' }] }));
    expect(out).toContain('stroke-curve-1');
    expect(out).toContain('stroke-curve-2');
    expect(out).toContain('stroke-dasharray="6 4"');
  });
  it('a huge value is clamped to finite numbers: no NaN, Infinity or e+ in the markup', () => {
    const out = markup(scene({ elements: [{ id: 'f', type: 'function', expr: '1e300*x' }, { id: 'g', type: 'function', expr: 'x^100' }] }));
    expect(out).not.toMatch(/NaN|Infinity|e\+/);
  });
});

describe('the viewer in the server HTML', () => {
  const html = (topic: any, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
    renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(Canvas2DViewer, { topic: topic as Canvas2DTopic, ...props }) }));
  const out = html(load());
  it('has the picture, the sliders, the trace, the legend and the text list of what the graph shows', () => {
    expect(out).toContain('data-canvas2d');
    expect(out).toContain('id="param-a"');
    expect(out).toContain('data-testid="trace-slider"');
    expect(out).toContain('data-testid="legend"');
    expect(out).toContain('data-testid="features"');
    expect(out).toContain('crosses the x-axis at x = −1, 3');
    expect(out).toContain('crosses the y-axis at y = −3');
    expect(out).toContain('lowest point at (1, −4)');
  });
  it('lists the draggable point as a slider with a name and a value', () => {
    expect(out).toContain('role="slider"');
    expect(out).toContain('data-handle="p"');
    expect(out).toContain('x = 2.00, y = −3.00');
  });
  it('a curve that starts invisible is not in the legend until a step shows it', () => {
    expect(out).not.toContain('data-legend="line"');
    const shown = html(load(), 'en', { step: { index: 2, params: { a: 1, b: -2, c: -3, m: 1, k: 2, px: 2, py: -3 }, hidden: new Set(), shown: new Set(['line']) } });
    expect(shown).toContain('data-legend="line"');
  });
  it('is in Urdu on /ur, with the picture kept left to right', () => {
    const urdu = html(load(), 'ur');
    expect(urdu).toContain('منحنی');
    expect(urdu).toContain('dir="ltr"');
  });
  it('a topic whose curves cannot be drawn still renders', () => {
    const t = mutated((d) => {
      d.scene.elements[0].expr = 'constructor(1)';
      d.scene.viewport = { xMin: 'nope(', xMax: 1, yMin: 0, yMax: 1 };
    });
    expect(() => html(t)).not.toThrow();
  });
});
