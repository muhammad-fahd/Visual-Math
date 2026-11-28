/* eslint-disable @typescript-eslint/no-explicit-any -- the tests edit a topic by path and feed hostile values */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../../src/i18n/locales';
import en from '../../src/i18n/messages/en.json';
import ur from '../../src/i18n/messages/ur.json';
import { SurfaceViewer, static2D, type SurfaceTopic } from '../../src/features/scene';
import { createProgram } from '../../src/lib/params';
import { buildSurface, type SurfaceSceneLike } from '../../src/lib/surface';
import { createTopicValidator, defaultSceneRegistry } from '../../src/lib/topic-schema';

vi.mock('next/navigation', () => ({ usePathname: () => '/en/dev/topic' }));

// Story 4.5: the surface z = f(x, y) as numerics (known values), a drawing model, schema and HTML.

const build = (scene: Partial<SurfaceSceneLike> & { expr: string }, scope: Record<string, number> = {}, hidden?: ReadonlySet<string>) => {
  const program = createProgram(Object.keys(scope));
  return buildSurface({ scene, program, scope: program.scope(scope), hidden });
};

describe('the numerics (known values)', () => {
  it('paraboloid: z is 8 at (2, 2) with slopes 4 and 4', () => {
    const { facts } = build({ expr: 'x^2 + y^2', probe: { x: 2, y: 2 } });
    expect(facts.probe!.z).toBe(8);
    expect(facts.probe!.dzdx).toBeCloseTo(4, 5);
    expect(facts.probe!.dzdy).toBeCloseTo(4, 5);
    expect(facts.zMin).toBe(0);
    expect(facts.zMax).toBe(18);
  });
  it('saddle: the slope along x is y and along y is x', () => {
    const { facts } = build({ expr: 'x*y', probe: { x: 2, y: 3 } });
    expect(facts.probe!.z).toBe(6);
    expect(facts.probe!.dzdx).toBeCloseTo(3, 5);
    expect(facts.probe!.dzdy).toBeCloseTo(2, 5);
  });
  it('flat: z = 5 has slopes 0 and a single height', () => {
    const { facts } = build({ expr: '5', probe: { x: 1, y: -1 } });
    expect(facts.probe!.z).toBe(5);
    expect(facts.probe!.dzdx).toBeCloseTo(0, 5);
    expect(facts.probe!.dzdy).toBeCloseTo(0, 5);
    expect([facts.zMin, facts.zMax]).toEqual([5, 5]);
  });
  it('a parameter in the expression moves the surface and the probe', () => {
    const one = build({ expr: 'a*x^2 + y^2', range: 50, probe: { x: 1, y: 1 } }, { a: 1 });
    const two = build({ expr: 'a*x^2 + y^2', range: 50, probe: { x: 1, y: 1 } }, { a: 2 });
    expect(one.facts.zMax).toBe(18);
    expect(two.facts.zMax).toBe(27);
    expect(one.facts.probe!.z).toBe(2);
    expect(two.facts.probe!.z).toBe(3);
    expect(two.facts.probe!.dzdx).toBeCloseTo(4, 5);
  });
  it('a probe may be placed by parameters', () => {
    const { facts } = build({ expr: 'x*y', probe: { x: 'px', y: 'py' } }, { px: 2, py: 1 });
    expect(facts.probe!.z).toBe(2);
  });
});

describe('the drawing model', () => {
  it('has n by n quads and a wire, all finite, and the axes', () => {
    const { facts, space } = build({ expr: 'x^2 + y^2', grid: 10, range: 20 });
    expect(facts.grid).toBe(10);
    expect(space.patches.filter((p) => p.id === 'surface')).toHaveLength(100);
    expect(space.segments.filter((s) => s.id === 'wire')).toHaveLength(2 * 10 * 11);
    expect(space.segments.some((s) => s.id === 'axes')).toBe(true);
    const all = [...space.patches.flatMap((p) => p.points.flat()), ...space.segments.flatMap((s) => [...s.a, ...s.b])];
    expect(all.every(Number.isFinite)).toBe(true);
  });
  it('holes: sqrt(x) from -1 leaves the left half out and counts it', () => {
    const { facts, space } = build({ expr: 'sqrt(x)', x: [-1, 1], y: [-1, 1], grid: 20, range: 6 });
    expect(facts.holes).toBe(210);
    expect(space.patches.filter((p) => p.id === 'surface').length).toBeLessThan(400);
    expect(space.patches.filter((p) => p.id === 'surface').length).toBeGreaterThan(0);
    const all = space.patches.flatMap((p) => p.points.flat());
    expect(all.every(Number.isFinite)).toBe(true);
  });
  it('a surface that is nowhere a number draws no quads and says so', () => {
    const { facts, space } = build({ expr: 'sqrt(-1 - x^2)' });
    expect(facts.zMin).toBeNull();
    expect(space.patches.filter((p) => p.id === 'surface')).toHaveLength(0);
  });
  it('tall: z is clamped to the box, counted, and the probe is cut at the box', () => {
    const { facts, space } = build({ expr: 'x^2 + y^2', range: 2, probe: { x: 3, y: 3 } });
    expect(facts.clamped).toBeGreaterThan(0);
    expect(facts.zMax).toBe(18);
    expect(facts.probe!.z).toBe(18);
    expect(facts.probe!.clamped).toBe(true);
    // The picture's y is the height.
    const heights = space.patches.flatMap((p) => p.points.map((q) => q[1]));
    expect(Math.max(...heights)).toBeLessThanOrEqual(2);
    expect(space.marks.find((m) => m.id === 'probe')!.at[1]).toBe(2);
  });
  it('a corner has no slope along x, but one along y: |x| at (0, 0)', () => {
    const { facts } = build({ expr: 'abs(x) + y', probe: { x: 0, y: 0 } });
    expect(facts.probe!.z).toBe(0);
    expect(facts.probe!.dzdx).toBeNull();
    expect(facts.probe!.dzdy).toBeCloseTo(1, 5);
  });
  it('a probe where there is no value is left out and said', () => {
    const { facts, space } = build({ expr: 'sqrt(x)', probe: { x: -1, y: 0 } });
    expect(facts.probe).toBeNull();
    expect(facts.probeMissing).toBe(true);
    expect(space.marks.some((m) => m.id === 'probe')).toBe(false);
  });
  it('a bad window is replaced by the default and said', () => {
    const { facts } = build({ expr: 'x + y', x: [3, -3] });
    expect(facts.windowDefaulted).toBe(true);
    expect(facts.x).toEqual([-3, 3]);
    const nan = build({ expr: 'x + y', y: ['q', 1] });
    expect(nan.facts.windowDefaulted).toBe(true);
    expect(build({ expr: 'x + y', x: [0, 2], y: [1, 4] }).facts.windowDefaulted).toBe(false);
  });
  it('the grid is held to 6 to 32 cells', () => {
    expect(build({ expr: 'x', grid: 500 }).facts.grid).toBe(32);
    expect(build({ expr: 'x', grid: 1 }).facts.grid).toBe(6);
  });
  it('a huge window stays finite', () => {
    const { space } = build({ expr: 'x*y', x: [-1e12, 1e12], y: [-1e12, 1e12], range: 6 });
    expect(space.patches.flatMap((p) => p.points.flat()).every(Number.isFinite)).toBe(true);
    expect(Math.max(...space.patches.flatMap((p) => p.points.flat().map(Math.abs)))).toBeLessThanOrEqual(6 * 50);
  });
  it('a step hides parts: surface, wire, probe', () => {
    const scene = { expr: 'x*y', probe: { x: 1, y: 1 } };
    expect(build(scene, {}, new Set(['surface'])).space.patches.some((p) => p.id === 'surface')).toBe(false);
    expect(build(scene, {}, new Set(['wire'])).space.segments.some((s) => s.id === 'wire')).toBe(false);
    const hiddenProbe = build(scene, {}, new Set(['probe']));
    expect(hiddenProbe.facts.probe).toBeNull();
    expect(hiddenProbe.space.marks.some((m) => m.id === 'probe')).toBe(false);
    expect(build({ ...scene, showWire: false }).space.segments.some((s) => s.id === 'wire')).toBe(false);
  });
  it('is deterministic', () => {
    const scene = { expr: 'sin(x)*cos(y)', probe: { x: 1, y: 2 } };
    expect(build(scene)).toEqual(build(scene));
  });
});

const validator = createTopicValidator({ locales: LOCALES, registry: defaultSceneRegistry });
const fixture = (name: string) => JSON.parse(readFileSync(`content/fixtures/${name}.json`, 'utf8')) as any;
const FIXTURES = ['sf-paraboloid', 'sf-saddle', 'sf-bend'];
const problems = (doc: unknown) => {
  const r = validator.validate(doc);
  return r.ok ? [] : r.problems.map((p) => `${p.code} ${p.pointer} ${p.message}`);
};

describe('the schema of surface3d', () => {
  it('the three fixture topics are valid, formula and worked-example checks included', () => {
    for (const name of FIXTURES) expect(problems(fixture(name)), name).toEqual([]);
  });
  it.each([
    ['a grid of 500', (d: any) => (d.scene.grid = 500)],
    ['a grid of 2', (d: any) => (d.scene.grid = 2)],
    ['a fractional grid', (d: any) => (d.scene.grid = 10.5)],
    ['a window from larger to smaller', (d: any) => (d.scene.x = [3, -3])],
    ['an empty window', (d: any) => (d.scene.y = [1, 1])],
    ['no expression', (d: any) => delete d.scene.expr],
    ['an unknown field', (d: any) => (d.scene.contours = true)],
    ['a probe with no y', (d: any) => (d.scene.probe = { x: 1 })],
    ['a camera that is not a preset', (d: any) => (d.scene.camera = { preset: 'underneath' })],
    ['a non-boolean showWire', (d: any) => (d.scene.showWire = 'yes')],
  ])('refuses %s', (_name, edit) => {
    const doc = fixture('sf-paraboloid');
    edit(doc);
    expect(problems(doc).length).toBeGreaterThan(0);
  });
  it('accepts expressions for the windows and the range, and the camera', () => {
    const doc = fixture('sf-bend');
    doc.scene.x = ['-a - 1', 'a + 3'];
    doc.scene.range = 'a + 8';
    doc.scene.camera = { preset: 'top' };
    expect(problems(doc)).toEqual([]);
  });
});

const html = (topic: SurfaceTopic, locale: 'en' | 'ur' = 'en', props: Record<string, unknown> = {}) =>
  renderToString(createElement(NextIntlClientProvider, { locale, messages: locale === 'en' ? en : ur, children: createElement(SurfaceViewer, { topic, ...props }) }));

describe('the viewer as server HTML', () => {
  it('the paraboloid says the window, the heights, the probe and both slopes', () => {
    const out = html(fixture('sf-paraboloid'));
    expect(out).toContain('The surface is drawn for x from −2 to 2 and y from −2 to 2.');
    expect(out).toContain('The height z goes from 0 to 8.');
    expect(out).toContain('At (x, y) = (2, 2) the height is z = 8.');
    expect(out).toContain('The slope along x is 4 and the slope along y is 4.');
    expect(out).toContain('data-surface-viewer');
    expect(out).toContain('data-readout="z"');
  });
  it('the saddle: slopes are the other coordinate', () => {
    const out = html(fixture('sf-saddle'));
    expect(out).toContain('At (x, y) = (2, 1) the height is z = 2.');
    expect(out).toContain('The slope along x is 1 and the slope along y is 2.');
  });
  it('the slider topic follows its parameter', () => {
    const t = fixture('sf-bend');
    t.parameters[0].default = -1;
    const out = html(t);
    expect(out).toContain('The height z goes from −4 to 4.');
    expect(out).toContain('At (x, y) = (1, 1) the height is z = 0.');
  });
  it('holes, clamping, a corner and a missing probe are each said', () => {
    const holes = fixture('sf-paraboloid');
    Object.assign(holes.scene, { expr: 'sqrt(x)', x: [-1, 1], y: [-1, 1] });
    holes.scene.probe = { x: -1, y: 0 };
    const out = html(holes);
    expect(out).toContain('210 points have no value, so the surface has holes there.');
    expect(out).toContain('The probe point is where the expression has no value, so it is left out.');
    const tall = fixture('sf-paraboloid');
    tall.scene.range = 2;
    expect(html(tall)).toContain('points lie outside the box, so they are cut off at its top or bottom.');
    const corner = fixture('sf-paraboloid');
    Object.assign(corner.scene, { expr: 'abs(x) + y', probe: { x: 0, y: 0 } });
    expect(html(corner)).toContain('There is no slope along x here (a corner or a jump).');
    const bad = fixture('sf-paraboloid');
    bad.scene.x = [3, -3];
    expect(html(bad)).toContain('The window given was not valid, so x and y both go from -3 to 3.');
  });
  it('a step that hides the probe takes it out of the text', () => {
    const out = html(fixture('sf-paraboloid'), 'en', { step: { index: 0, params: {}, hidden: new Set(['probe']) } });
    expect(out).not.toContain('the height is z');
    expect(out).toContain('The height z goes from 0 to 8.');
  });
  it('Urdu: Urdu sentences, the diagram left to right', () => {
    const out = html(fixture('sf-paraboloid'), 'ur');
    expect(out).toContain('اونچائی');
    expect(out).toContain('dir="ltr"');
  });
});

describe('the pictures', () => {
  it('static2D draws each fixture with no NaN: quads, wire and the probe', () => {
    for (const name of FIXTURES) {
      const out = renderToStaticMarkup(static2D({ topic: fixture(name), locale: 'en' })!);
      expect(out).toContain('data-static2d="surface3d"');
      expect(out).toContain('data-patch="surface"');
      expect(out).toContain('data-seg="wire"');
      expect(out).toContain('data-mark="probe"');
      expect(out).not.toMatch(/NaN|Infinity/);
    }
  });
  it('every new word exists in both languages', () => {
    expect(Object.keys(ur.surface).sort()).toEqual(Object.keys(en.surface).sort());
  });
});
