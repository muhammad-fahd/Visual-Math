import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DIMS, KINDS, WINDOW, build, drawList, project, type Dims, type Kind } from '../../src/lib/solid';

// Known values first (NFR-6.2), then properties: the picture is finite, inside its window, and the
// faces point out of the solid, whatever the measurements.

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

const VIEW = { azimuth: 30, elevation: 20, scale: 1, panX: 0, panY: 0 };

describe('volume and surface area of each kind', () => {
  const hexBase = 6 * Math.sqrt(3); // a regular hexagon of side 2
  const cases: [Kind, number, number][] = [
    ['cube', 27, 54],
    ['cuboid', 24, 52],
    ['prism', hexBase * 5, 2 * hexBase + 6 * 2 * 5],
    ['cylinder', Math.PI * 9 * 5, 2 * Math.PI * 3 * 8],
    ['cone', (Math.PI * 9 * 10) / 3, Math.PI * 3 * (3 + Math.hypot(3, 10))],
    ['sphere', (4 / 3) * Math.PI * 8, 16 * Math.PI],
    ['hemisphere', (2 / 3) * Math.PI * 8, 12 * Math.PI],
    ['frustum', (Math.PI * 4 * (9 + 3 + 1)) / 3, Math.PI * (9 + 1 + 4 * Math.hypot(2, 4))],
  ];
  it.each(cases)('%s', (kind, volume, surface) => {
    const g = build(kind, SAMPLE[kind]);
    expect(g.volume).toBeCloseTo(volume, 9);
    expect(g.surface).toBeCloseTo(surface, 9);
  });
  it('a square pyramid: V = a^2 h / 3, area = a^2 + 2 a slant', () => {
    const g = build('pyramid', SAMPLE.pyramid);
    expect(g.volume).toBeCloseTo((9 * 4) / 3, 9);
    expect(g.surface).toBeCloseTo(9 + 2 * 3 * Math.hypot(1.5, 4), 9);
  });
  it('the cone of the worked example: r 3, h 10 is 94.2', () => {
    expect(build('cone', SAMPLE.cone).volume.toFixed(1)).toBe('94.2');
  });
});

describe('every kind', () => {
  it.each(KINDS)('%s has the dimensions the format names, labelled', (kind) => {
    expect(Object.keys(SAMPLE[kind]).sort()).toEqual([...DIMS[kind]].sort());
    const g = build(kind, SAMPLE[kind]);
    expect(g.dimensions.length).toBeGreaterThan(0);
    for (const d of g.dimensions) expect(d.value).toBeGreaterThan(0);
  });
  it.each(KINDS)('%s: its faces point out of the solid', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    const c = g.vertices.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]).map((x) => x / g.vertices.length);
    for (const face of g.faces) {
      const [p0, p1, p2] = [g.vertices[face[0]!]!, g.vertices[face[1]!]!, g.vertices[face[2]!]!];
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
      const out = [p0[0] - c[0]!, p0[1] - c[1]!, p0[2] - c[2]!];
      expect(n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]!).toBeGreaterThan(-1e-9);
    }
  });
  it.each(KINDS)('%s: every index is a vertex and the solid is centred vertically', (kind) => {
    const g = build(kind, SAMPLE[kind]);
    for (const f of g.faces) for (const i of f) expect(g.vertices[i]).toBeDefined();
    for (const [a, b] of g.edges) {
      expect(g.vertices[a]).toBeDefined();
      expect(g.vertices[b]).toBeDefined();
    }
    const ys = g.vertices.map((v) => v[1]);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(0, 9);
  });
  it('a dimension drawn on the object touches the object (the h of a cone runs along its axis)', () => {
    const g = build('cone', SAMPLE.cone);
    const h = g.dimensions.find((d) => d.id === 'h')!;
    expect(h.from[1]).toBeCloseTo(-5, 9);
    expect(h.to[1]).toBeCloseTo(5, 9);
    expect(g.dimensions.find((d) => d.id === 'r')!.value).toBeCloseTo(3, 9);
    expect(g.dimensions.find((d) => d.id === 'l')!.value).toBeCloseTo(Math.hypot(3, 10), 9);
  });
});

describe('projection and the draw list', () => {
  const geo = build('cone', SAMPLE.cone);
  it('the front view puts the axis straight up the picture', () => {
    const top = project([0, 5, 0], { ...VIEW, azimuth: 0, elevation: 0 }, geo.radius);
    expect(top.x).toBeCloseTo(0, 9);
    expect(top.y).toBeLessThan(0); // up is toward the top of the SVG
  });
  it('scale doubles distances and pan moves the picture by that fraction of its width', () => {
    const a = project([1, 0, 0], { ...VIEW, azimuth: 0, elevation: 0 }, 5);
    const b = project([1, 0, 0], { ...VIEW, azimuth: 0, elevation: 0, scale: 2 }, 5);
    expect(b.x).toBeCloseTo(a.x * 2, 9);
    const c = project([0, 0, 0], { ...VIEW, panX: 0.25, panY: -0.5 }, 5);
    expect(c.x).toBeCloseTo(30, 9);
    expect(c.y).toBeCloseTo(-60, 9);
  });
  it('an edge is hidden only when every face beside it faces away', () => {
    const cube = build('cube', SAMPLE.cube);
    const list = drawList(cube, { ...VIEW, azimuth: 0, elevation: 0 });
    // Seen straight on, only the front square is on a visible face; the back square and the four edges
    // running into the page (seen end on) are behind or beside it.
    expect(list.edges.filter((e) => !e.hidden)).toHaveLength(4);
    expect(list.edges.filter((e) => e.hidden)).toHaveLength(8);
    expect(list.faces.filter((f) => f.front)).toHaveLength(1);
  });
  it('faces come far to near', () => {
    const list = drawList(build('cuboid', SAMPLE.cuboid), VIEW);
    for (let i = 1; i < list.faces.length; i++) expect(list.faces[i]!.depth).toBeGreaterThanOrEqual(list.faces[i - 1]!.depth);
  });
  it('a box seen from any side shows at least one face and at most three', () => {
    for (const az of [0, 45, 90, 135, 180, 270]) {
      const n = drawList(build('cuboid', SAMPLE.cuboid), { ...VIEW, azimuth: az, elevation: 30 }).faces.filter((f) => f.front).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
  it('property: whatever the view and the measurements, every coordinate is finite and inside the window', () => {
    const wild = (limit: number) => fc.double({ min: -limit, max: limit });
    fc.assert(
      fc.property(
        fc.constantFrom(...KINDS),
        wild(1e9),
        fc.record({ azimuth: wild(1e6), elevation: wild(1e6), scale: wild(1e9), panX: wild(1e9), panY: wild(1e9) }),
        (kind, d, view) => {
          const dims = Object.fromEntries(DIMS[kind].map((n) => [n, d]));
          const g = build(kind, dims);
          expect(Number.isFinite(g.volume)).toBe(true);
          const list = drawList(g, view);
          for (const e of list.edges) for (const p of [e.a, e.b]) for (const n of [p.x, p.y, p.depth]) expect(Math.abs(n)).toBeLessThanOrEqual(WINDOW);
          for (const f of list.faces) {
            for (const n of f.points.split(/[ ,]/).map(Number)) {
              expect(Number.isFinite(n)).toBe(true);
              expect(Math.abs(n)).toBeLessThanOrEqual(WINDOW);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
  it('dimension letters are written beside their lines, apart from each other, at the usual views', () => {
    for (const kind of KINDS) {
      const g = build(kind, SAMPLE[kind]);
      for (const view of [VIEW, { ...VIEW, azimuth: 45, elevation: 30 }, { ...VIEW, azimuth: 0, elevation: 0 }, { ...VIEW, azimuth: 20, elevation: 15 }]) {
        const labels = drawList(g, view).dimensions;
        for (const d of labels) expect(Math.hypot(d.label.x - d.mid.x, d.label.y - d.mid.y), `${kind} ${d.id}`).toBeCloseTo(7, 6);
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            const gap = Math.hypot(labels[i]!.label.x - labels[j]!.label.x, labels[i]!.label.y - labels[j]!.label.y);
            expect(gap, `${kind} ${labels[i]!.id} and ${labels[j]!.id} at ${JSON.stringify(view)}`).toBeGreaterThan(6);
          }
        }
      }
    }
  });
  it('hostile measurements (NaN, infinity, nothing at all) cannot throw', () => {
    for (const kind of KINDS) {
      expect(() => build(kind, { height: NaN, radius: Infinity, sides: -5, side: 0 })).not.toThrow();
      expect(() => build(kind, {})).not.toThrow();
    }
  });
});
