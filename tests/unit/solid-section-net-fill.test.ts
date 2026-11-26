import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { basis, build, compose, crossSection, enclosedVolume, netPose, netRadius, planeFrom, sectionPlane, type Dims, type Kind, type Vec3 } from '../../src/lib/solid';

// Cross-section, net and fill against values worked out by hand (NFR-6.2), then properties.

const SAMPLE: Record<Kind, Dims> = {
  cube: { side: 3 },
  cuboid: { length: 4, width: 3, height: 2 },
  prism: { sides: 6, side: 2, height: 5 },
  pyramid: { sides: 4, side: 3, height: 4 },
  cylinder: { radius: 3, height: 5 },
  cone: { radius: 3, height: 10 },
  sphere: { radius: 2 },
  hemisphere: { radius: 2 },
  frustum: { rTop: 1, rBottom: 3, height: 4 },
};
const NETS: Kind[] = ['cube', 'cuboid', 'prism', 'pyramid', 'cylinder', 'cone'];
const cut = (kind: Kind, axis: 'x' | 'y' | 'z', offset: number) => {
  const g = build(kind, SAMPLE[kind]);
  return crossSection(g, kind, sectionPlane({ enabled: 1, plane: { axis, offset } })!);
};
const measure = (s: ReturnType<typeof cut>, id: string) => s!.measures.find((m) => m.id === id)!.value;

describe('cross-section (FR-3.10)', () => {
  it('a cone cut across the middle is a circle of half the radius', () => {
    const s = cut('cone', 'y', 0)!;
    expect(s.shape).toBe('circle');
    expect(measure(s, 'radius')).toBeCloseTo(1.5, 6);
    expect(measure(s, 'area')).toBeCloseTo(Math.PI * 2.25, 6);
  });
  it('a cone cut through its axis is a triangle: base 6, height 10', () => {
    const s = cut('cone', 'x', 0)!;
    expect(s.shape).toBe('triangle');
    expect(measure(s, 'base')).toBeCloseTo(6, 6);
    expect(measure(s, 'height')).toBeCloseTo(10, 6);
    expect(measure(s, 'area')).toBeCloseTo(30, 6);
  });
  it('a cylinder: a circle across, a rectangle through the axis, and a narrower rectangle off it', () => {
    expect(cut('cylinder', 'y', 1)!.shape).toBe('circle');
    expect(measure(cut('cylinder', 'y', 1), 'radius')).toBeCloseTo(3, 6);
    const through = cut('cylinder', 'x', 0)!;
    expect(through.shape).toBe('rectangle');
    expect(measure(through, 'width')).toBeCloseTo(6, 2);
    expect(measure(through, 'height')).toBeCloseTo(5, 6);
    const off = cut('cylinder', 'x', 2)!;
    expect(off.shape).toBe('rectangle');
    // The longer side is the width: the 5 high side, and the chord 2 sqrt(9 - 4) (the mesh is a 32-gon: within about half a percent).
    expect(measure(off, 'width')).toBeCloseTo(5, 6);
    expect(measure(off, 'height')).toBeCloseTo(2 * Math.sqrt(5), 1);
  });
  it('a sphere cut off the middle is a circle of radius sqrt(R^2 - d^2)', () => {
    const g = build('sphere', SAMPLE.sphere);
    const s = crossSection(g, 'sphere', planeFrom([0, 1, 0], 1)!)!;
    expect(s.shape).toBe('circle');
    expect(measure(s, 'radius')).toBeCloseTo(Math.sqrt(3), 1);
  });
  it('a cube is cut into a square, a cuboid into rectangles', () => {
    expect(cut('cube', 'y', 0.5)!.shape).toBe('square');
    expect(measure(cut('cube', 'y', 0.5), 'side')).toBeCloseTo(3, 9);
    const r = cut('cuboid', 'x', 0)!;
    expect(r.shape).toBe('rectangle');
    expect(measure(r, 'width')).toBeCloseTo(3, 9);
    expect(measure(r, 'height')).toBeCloseTo(2, 9);
    expect(measure(r, 'area')).toBeCloseTo(6, 9);
  });
  it('a hexagonal prism cut across is a six-sided polygon', () => {
    const s = cut('prism', 'y', 0)!;
    expect(s.shape).toBe('polygon');
    expect(measure(s, 'sides')).toBe(6);
    expect(measure(s, 'area')).toBeCloseTo(6 * Math.sqrt(3), 6);
  });
  it('a tilted plane through a cube gives a rectangle sqrt(2) a by a', () => {
    const g = build('cube', SAMPLE.cube);
    const s = crossSection(g, 'cube', planeFrom([1, 1, 0], 0)!)!;
    expect(s.shape).toBe('rectangle');
    expect(measure(s, 'width')).toBeCloseTo(3 * Math.SQRT2, 9);
    expect(measure(s, 'height')).toBeCloseTo(3, 9);
  });
  it('a cone cut off its axis is a curved shape, with an area', () => {
    const s = cut('cone', 'x', 1)!;
    expect(['curved', 'ellipse']).toContain(s.shape);
    expect(measure(s, 'area')).toBeGreaterThan(0);
  });
  it('a plane that misses the solid cuts nothing; a zero normal or a missing field is no plane', () => {
    expect(cut('cone', 'y', 5.01)).toBeNull();
    expect(cut('cone', 'y', -9)).toBeNull();
    expect(sectionPlane({ enabled: 1, normal: [0, 0, 0], d: 1 })).toBeNull();
    expect(sectionPlane({ enabled: 0, plane: { axis: 'y', offset: 0 } })).toBeNull();
    expect(sectionPlane({ enabled: NaN, plane: { axis: 'y', offset: 0 } })).toBeNull();
    expect(sectionPlane({ enabled: 1, plane: { axis: 'y', offset: NaN } })).toBeNull();
    expect(sectionPlane({ enabled: 1 })).toBeNull();
    expect(sectionPlane(undefined)).toBeNull();
  });
  it('the cut points lie on the plane and its flat copy has the same corners', () => {
    const plane = planeFrom([1, 2, 3], 0.7)!;
    const g = build('cuboid', SAMPLE.cuboid);
    const s = crossSection(g, 'cuboid', plane)!;
    for (const p of s.polygon3) expect(Math.abs(p[0] * plane.n[0] + p[1] * plane.n[1] + p[2] * plane.n[2] - plane.d)).toBeLessThan(1e-9);
    expect(s.polygon2).toHaveLength(s.polygon3.length);
    void basis;
  });
  it('property: any plane gives a finite shape or nothing, never a throw', () => {
    fc.assert(
      fc.property(fc.constantFrom(...(Object.keys(SAMPLE) as Kind[])), fc.tuple(fc.double({ min: -5, max: 5 }), fc.double({ min: -5, max: 5 }), fc.double({ min: -5, max: 5 })), fc.double({ min: -8, max: 8 }), (kind, normal, d) => {
        const plane = planeFrom(normal as Vec3, d);
        if (!plane) return;
        const s = crossSection(build(kind, SAMPLE[kind]), kind, plane);
        if (!s) return;
        for (const m of s.measures) expect(Number.isFinite(m.value)).toBe(true);
        for (const p of s.polygon2) for (const n of p) expect(Number.isFinite(n)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe('the net (FR-3.11)', () => {
  it.each(NETS)('%s: the parts add up to the surface area, exactly', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    expect(g.netParts.reduce((s, p) => s + p.area, 0)).toBeCloseTo(g.surface, 9);
  });
  it.each(['sphere', 'hemisphere', 'frustum'] as Kind[])('%s has no net', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    expect(g.panels).toEqual([]);
    expect(netPose(g, 0.5)).toEqual([]);
    expect(compose(kind, g, { net: { progress: 1 } }).net).toBeNull();
  });
  it.each(NETS)('%s: progress 0 is the solid itself', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    const folded = netPose(g, 0);
    g.panels.forEach((panel, i) => {
      panel.loop.forEach((idx, k) => {
        const v = g.vertices[idx]!;
        const q = folded[i]![k]!;
        expect(Math.hypot(v[0] - q[0], v[1] - q[1], v[2] - q[2])).toBeLessThan(1e-9);
      });
    });
  });
  it.each(NETS)('%s: the panels cover every face of the solid, once', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    const area = (loop: readonly number[]) => {
      let n: Vec3 = [0, 0, 0];
      for (let i = 0; i < loop.length; i++) {
        const a = g.vertices[loop[i]!]!;
        const b = g.vertices[loop[(i + 1) % loop.length]!]!;
        n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])];
      }
      return Math.hypot(...n) / 2;
    };
    const panelArea = g.panels.reduce((s, p) => s + area(p.loop), 0);
    const faceArea = g.faces.reduce((s, f) => s + area(f), 0);
    expect(panelArea).toBeCloseTo(faceArea, 6);
  });
  it.each(NETS)('%s: at progress 1 every panel lies in one plane', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    const flat = netPose(g, 1);
    const pts = flat.flat();
    // The plane through the first panel.
    const [a, b, c] = [flat[0]![0]!, flat[0]![1]!, flat[0]![2]!];
    const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    for (const p of pts) expect(Math.abs(((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2]) / len)).toBeLessThan(1e-8);
  });
  it.each(NETS)('%s: the net is centred and the flat panels do not overlap', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    const flat = netPose(g, 1);
    const all = flat.flat();
    const centre = [0, 1, 2].map((k) => (Math.min(...all.map((p) => p[k]!)) + Math.max(...all.map((p) => p[k]!))) / 2);
    for (const c of centre) expect(Math.abs(c)).toBeLessThan(1e-9);
    // Flatten to the plane's axes and test sample points of each panel against the others.
    const a = flat[0]![0]!;
    const e1: Vec3 = [flat[0]![1]![0] - a[0], flat[0]![1]![1] - a[1], flat[0]![1]![2] - a[2]];
    const l1 = Math.hypot(...e1);
    const x: Vec3 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
    const c2 = flat[0]![2]!;
    const w: Vec3 = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]];
    const nrm: Vec3 = [x[1] * w[2] - x[2] * w[1], x[2] * w[0] - x[0] * w[2], x[0] * w[1] - x[1] * w[0]];
    const nl = Math.hypot(...nrm);
    const nn: Vec3 = [nrm[0] / nl, nrm[1] / nl, nrm[2] / nl];
    const y: Vec3 = [nn[1] * x[2] - nn[2] * x[1], nn[2] * x[0] - nn[0] * x[2], nn[0] * x[1] - nn[1] * x[0]];
    const flat2 = flat.map((poly) => poly.map((p) => [(p[0] - a[0]) * x[0] + (p[1] - a[1]) * x[1] + (p[2] - a[2]) * x[2], (p[0] - a[0]) * y[0] + (p[1] - a[1]) * y[1] + (p[2] - a[2]) * y[2]] as [number, number]));
    const inside = (pt: [number, number], poly: [number, number][]) => {
      let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]!;
        const [xj, yj] = poly[j]!;
        if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    };
    const centroid = (poly: [number, number][]): [number, number] => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
    flat2.forEach((poly, i) => {
      const c = centroid(poly);
      // A point a little inside each panel (toward its centroid from each corner) must not be inside another panel.
      const samples = [c, ...poly.map((p) => [p[0] + (c[0] - p[0]) * 0.1, p[1] + (c[1] - p[1]) * 0.1] as [number, number])];
      flat2.forEach((other, j) => {
        if (i === j) return;
        for (const s of samples) expect(inside(s, other), `${kind}: panel ${i} overlaps panel ${j}`).toBe(false);
      });
    });
  });
  it.each(NETS)('%s: every panel keeps its shape while it folds, and stays joined to its parent', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    for (const p of [0.13, 0.5, 0.87, 1]) {
      const pose = netPose(g, p);
      g.panels.forEach((panel, i) => {
        panel.loop.forEach((idx, k) => {
          const next = (k + 1) % panel.loop.length;
          const before = g.vertices[idx]!;
          const beforeNext = g.vertices[panel.loop[next]!]!;
          const d0 = Math.hypot(before[0] - beforeNext[0], before[1] - beforeNext[1], before[2] - beforeNext[2]);
          const q = pose[i]![k]!;
          const qn = pose[i]![next]!;
          expect(Math.hypot(q[0] - qn[0], q[1] - qn[1], q[2] - qn[2])).toBeCloseTo(d0, 6);
        });
        if (panel.parent >= 0 && panel.edge) {
          for (const v of panel.edge) {
            const own = pose[i]![panel.loop.indexOf(v)]!;
            const par = pose[panel.parent]![g.panels[panel.parent]!.loop.indexOf(v)]!;
            expect(Math.hypot(own[0] - par[0], own[1] - par[1], own[2] - par[2])).toBeLessThan(1e-7);
          }
        }
      });
    }
  });
  it('progress is clamped and NaN is zero; the flat net is wider than the folded solid', () => {
    const g = build('cylinder', SAMPLE.cylinder);
    expect(netPose(g, -3)).toEqual(netPose(g, 0));
    expect(netPose(g, 9)).toEqual(netPose(g, 1));
    expect(netPose(g, NaN)).toEqual(netPose(g, 0));
    expect(netRadius(g)).toBeGreaterThan(g.radius);
  });
  it('flattening keeps every area: the flat panels add up to the mesh surface, within the 32-gon', () => {
    const g = build('cylinder', SAMPLE.cylinder);
    const area = (poly: readonly Vec3[]) => {
      let n: Vec3 = [0, 0, 0];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])];
      }
      return Math.hypot(...n) / 2;
    };
    const flat = netPose(g, 1).reduce((s, p) => s + area(p), 0);
    expect(flat / g.surface).toBeGreaterThan(0.99);
    expect(flat / g.surface).toBeLessThanOrEqual(1);
  });
  it('property: any progress and any size gives finite panels', () => {
    fc.assert(
      fc.property(fc.constantFrom(...NETS), fc.double({ min: -3, max: 3 }), fc.double({ min: 0.001, max: 1000 }), (kind, p, size) => {
        const g = build(kind, Object.fromEntries(Object.keys(SAMPLE[kind]).map((k) => [k, k === 'sides' ? 5 : size])));
        for (const poly of netPose(g, p)) for (const q of poly) for (const n of q) expect(Number.isFinite(n)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

describe('fill (FR-3.12)', () => {
  const share = (kind: Kind, level: number) => compose(kind, build(kind, SAMPLE[kind]), { fill: { level } }).fill!.share;
  it('a third of a cylinder is a third of its volume, a whole is all of it, nothing is none', () => {
    expect(share('cylinder', 1 / 3)).toBeCloseTo(1 / 3, 9);
    expect(share('cylinder', 1)).toBe(1);
    expect(share('cylinder', 0)).toBe(0);
    expect(share('cylinder', 0.75)).toBeCloseTo(0.75, 9);
  });
  it('a cone filled to half its height holds 7/8 of its volume (the narrow part is at the top)', () => {
    expect(share('cone', 0.5)).toBeCloseTo(7 / 8, 9);
  });
  it('a cuboid and a sphere', () => {
    expect(share('cuboid', 0.4)).toBeCloseTo(0.4, 9);
    expect(share('sphere', 0.5)).toBeCloseTo(0.5, 2);
  });
  it('the level is clamped and NaN is empty', () => {
    expect(share('cylinder', 7)).toBe(1);
    expect(share('cylinder', -2)).toBe(0);
    expect(share('cylinder', NaN)).toBe(0);
  });
  it('three cones poured into a cylinder of the same size fill it: the cone is one third of the cylinder', () => {
    const cone = build('cone', { radius: 3, height: 5 }).volume;
    const cylinder = build('cylinder', { radius: 3, height: 5 }).volume;
    expect(cylinder / cone).toBeCloseTo(3, 9);
  });
  it('the liquid is a closed solid: its volume is enclosed by its own layer', () => {
    const c = compose('cylinder', build('cylinder', SAMPLE.cylinder), { fill: { level: 0.5 } });
    const liquid = c.layers.find((l) => l.id === 'liquid')!;
    const polys = liquid.faces.map((f) => f.map((i) => liquid.vertices[i]!));
    const g = build('cylinder', SAMPLE.cylinder);
    expect(enclosedVolume(polys)).toBeCloseTo(0.5 * enclosedVolume(g.faces.map((f) => f.map((i) => g.vertices[i]!))), 6);
  });
});

describe('compose', () => {
  const g = build('cone', SAMPLE.cone);
  it('a plain solid is one layer, with its dimensions shown', () => {
    const c = compose('cone', g, {});
    expect(c.layers.map((l) => l.id)).toEqual(['solid']);
    expect(c.showDimensions).toBe(true);
    expect(c.glass).toBe(false);
    expect(c.fit).toBe(g.radius);
  });
  it('a section adds the plane and the cut face, and makes the solid see-through; one that misses adds only the plane', () => {
    const hit = compose('cone', g, { section: { enabled: 1, plane: { axis: 'y', offset: 0 } } });
    expect(hit.layers.map((l) => l.id)).toEqual(['solid', 'plane', 'cut']);
    expect(hit.glass).toBe(true);
    expect(hit.section?.shape).toBe('circle');
    const miss = compose('cone', g, { section: { enabled: 1, plane: { axis: 'y', offset: 9 } } });
    expect(miss.layers.map((l) => l.id)).toEqual(['solid', 'plane']);
    expect(miss.section).toBeNull();
    expect(miss.sectionAsked).toBe(true);
    const off = compose('cone', g, { section: { enabled: 0, plane: { axis: 'y', offset: 0 } } });
    expect(off.layers.map((l) => l.id)).toEqual(['solid']);
    expect(off.sectionAsked).toBe(false);
  });
  it('while it unfolds the net replaces the solid, the dimensions go, and the picture widens to fit', () => {
    const closed = compose('cone', g, { net: { progress: 0 } });
    expect(closed.layers.map((l) => l.id)).toEqual(['solid']);
    expect(closed.showDimensions).toBe(true);
    const open = compose('cone', g, { net: { progress: 0.5 } });
    expect(open.layers.map((l) => l.id)).toEqual(['net']);
    expect(open.showDimensions).toBe(false);
    expect(open.fit).toBeGreaterThan(g.radius);
    expect(open.net?.total).toBeCloseTo(g.surface, 9);
  });
  it('section, net and fill can be on together', () => {
    const c = compose('cylinder', build('cylinder', SAMPLE.cylinder), { section: { enabled: 1, plane: { axis: 'y', offset: 0 } }, net: { progress: 0 }, fill: { level: 0.5 } });
    expect(c.layers.map((l) => l.id)).toEqual(['solid', 'plane', 'cut', 'liquid']);
  });
});
