// The nine solids of `solid3d@1` as plain data (FR-3.1 to 3.5): vertices, faces, the edges worth
// drawing, the labelled dimensions and the exact volume and surface area. Pure. y is up, the solid is
// centred on the origin, and every emitted number is finite. Tier A (three.js) and Tier B and C (SVG)
// both read this, so the three views of a solid can never disagree.

export type Vec3 = readonly [number, number, number];

export const KINDS = ['cube', 'cuboid', 'prism', 'pyramid', 'cylinder', 'cone', 'sphere', 'hemisphere', 'frustum'] as const;
export type Kind = (typeof KINDS)[number];

/** The dimension names each kind takes (topic-format 2.8). */
export const DIMS: Record<Kind, readonly string[]> = {
  cube: ['side'],
  cuboid: ['length', 'width', 'height'],
  prism: ['sides', 'side', 'height'],
  pyramid: ['sides', 'side', 'height'],
  cylinder: ['radius', 'height'],
  cone: ['radius', 'height'],
  sphere: ['radius'],
  hemisphere: ['radius'],
  frustum: ['rTop', 'rBottom', 'height'],
};

/** A measurement shown on the object: a segment and the letter written beside it (FR-3.5). Radii run along x, so the front view shows them at full length. */
export interface Dimension {
  /** r, h, l, a, b, c ... */
  readonly id: string;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly value: number;
}

/** One face (or a whole cap) of the net: a hinge tree over the solid's real faces (FR-3.11). */
export interface Panel {
  /** Vertex indices, counter-clockwise seen from outside the solid. */
  readonly loop: readonly number[];
  /** Index of the panel it is hinged to; -1 for the one that stays put. */
  readonly parent: number;
  /** The two vertices it shares with its parent: the hinge. */
  readonly edge: readonly [number, number] | null;
  readonly role: 'base' | 'top' | 'lateral';
}

/** The area of each part of the net, exact (not the mesh's); the parts add up to the surface area. */
export interface NetPart {
  readonly role: 'base' | 'top' | 'lateral';
  readonly area: number;
}

export interface Geometry {
  readonly vertices: readonly Vec3[];
  /** Index loops, counter-clockwise seen from outside. */
  readonly faces: readonly (readonly number[])[];
  /** Index pairs: the lines worth drawing (rings and a few meridians on a curved solid). */
  readonly edges: readonly (readonly [number, number])[];
  readonly dimensions: readonly Dimension[];
  /** Distance from the centre to the farthest vertex; the camera fit. */
  readonly radius: number;
  readonly volume: number;
  readonly surface: number;
  /** Empty for the kinds that have no net (sphere, hemisphere, frustum). */
  readonly panels: readonly Panel[];
  readonly netParts: readonly NetPart[];
}

export type Dims = Readonly<Record<string, number>>;

const SEGMENTS = 32;
const RINGS = 16;
const MERIDIANS = 8;
/** The largest a dimension may be drawn at: a hostile or mistyped value cannot blow up the picture. */
const MAX_DIM = 1e6;
const MIN_DIM = 1e-6;

const tau = Math.PI * 2;
const dim = (d: Dims, name: string, fallback = 1): number => {
  const v = d[name];
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_DIM, Math.max(MIN_DIM, v)) : fallback;
};

interface Built {
  vertices: Vec3[];
  faces: number[][];
  edges: [number, number][];
  rows?: number[][];
}

/** A box with its centre at the origin. */
function box(l: number, h: number, w: number): Built {
  const x = l / 2;
  const y = h / 2;
  const z = w / 2;
  const vertices: Vec3[] = [
    [-x, -y, z], // 0 front bottom left
    [x, -y, z], // 1
    [x, y, z], // 2
    [-x, y, z], // 3
    [-x, -y, -z], // 4 back
    [x, -y, -z], // 5
    [x, y, -z], // 6
    [-x, y, -z], // 7
  ];
  const faces = [
    [0, 1, 2, 3], // front
    [5, 4, 7, 6], // back
    [4, 0, 3, 7], // left
    [1, 5, 6, 2], // right
    [3, 2, 6, 7], // top
    [4, 5, 1, 0], // bottom
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return { vertices, faces, edges };
}

/**
 * A surface of revolution about the y axis from a profile of `[radius, y]` points, bottom to top. A
 * profile point with radius 0 becomes one vertex (a pole or a cap centre), so a triangle fan comes out
 * of the same loop that makes the quads. `ringEdges` are the profile indices whose rings are drawn.
 */
function revolve(profile: readonly (readonly [number, number])[], segments: number, ringEdges: readonly number[], meridianStep: number, phase = 0): Built {
  const vertices: Vec3[] = [];
  const rows: number[][] = [];
  for (const [r, y] of profile) {
    if (r < 1e-12) {
      vertices.push([0, y, 0]);
      rows.push(new Array<number>(segments).fill(vertices.length - 1));
    } else {
      const row: number[] = [];
      for (let j = 0; j < segments; j++) {
        const a = phase + (j / segments) * tau;
        vertices.push([r * Math.sin(a), y, r * Math.cos(a)]);
        row.push(vertices.length - 1);
      }
      rows.push(row);
    }
  }
  const faces: number[][] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      const loop = [rows[i]![j]!, rows[i]![k]!, rows[i + 1]![k]!, rows[i + 1]![j]!]; // counter-clockwise seen from outside
      const cleaned = loop.filter((v, n) => v !== loop[(n + 1) % loop.length]);
      if (cleaned.length >= 3) faces.push(cleaned);
    }
  }
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push([a, b]);
    }
  };
  for (const i of ringEdges) for (let j = 0; j < segments; j++) add(rows[i]![j]!, rows[i]![(j + 1) % segments]!);
  for (let j = 0; j < segments; j += meridianStep) for (let i = 0; i + 1 < rows.length; i++) add(rows[i]![j]!, rows[i + 1]![j]!);
  return { vertices, faces, edges, rows };
}

/** The same solid, moved so its bounding box is centred vertically. */
function centre(b: Built): Built {
  const ys = b.vertices.map((v) => v[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { ...b, vertices: b.vertices.map((v) => [v[0], v[1] - mid, v[2]] as Vec3) };
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function dimension(id: string, from: Vec3, to: Vec3): Dimension {
  return { id, from, to, value: dist(from, to) };
}

/** The circumradius of a regular polygon with `n` sides of length `s`. */
const circumradius = (n: number, s: number) => s / (2 * Math.sin(Math.PI / n));

/** `sides` is an integer 3 to 12; anything else is made so, never refused here (the schema and the slider do that). */
const sides = (d: Dims) => Math.min(12, Math.max(3, Math.round(dim(d, 'sides', 4))));

/** The panels of a closed box: the bottom stays, four sides hinge to it, the top hinges to the front. */
function boxPanels(): Panel[] {
  const loops = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]; // front, back, left, right, top, bottom
  const shared = (a: number[], b: number[]): [number, number] => {
    const both = a.filter((v) => b.includes(v));
    return [both[0]!, both[1]!];
  };
  const bottom = loops[5]!;
  const panels: Panel[] = [{ loop: bottom, parent: -1, edge: null, role: 'base' }];
  for (const i of [0, 1, 2, 3]) panels.push({ loop: loops[i]!, parent: 0, edge: shared(loops[i]!, bottom), role: 'lateral' });
  panels.push({ loop: loops[4]!, parent: 1, edge: shared(loops[4]!, loops[0]!), role: 'top' });
  return panels;
}

/** A prism or a pyramid stood on a ring: the base stays, each side hinges to it, a prism's top hinges to side 0. */
function ringPanels(rows: number[][], n: number, top: boolean): Panel[] {
  const bottom = rows[1]!;
  const upper = rows[2]!;
  const panels: Panel[] = [{ loop: [...bottom].reverse(), parent: -1, edge: null, role: 'base' }];
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    const loop = top ? [bottom[j]!, bottom[k]!, upper[k]!, upper[j]!] : [bottom[j]!, bottom[k]!, upper[0]!];
    panels.push({ loop, parent: 0, edge: [bottom[j]!, bottom[k]!], role: 'lateral' });
  }
  if (top) panels.push({ loop: [...upper], parent: 1, edge: [upper[0]!, upper[1]!], role: 'top' });
  return panels;
}

/** A cylinder: the bottom disc stays, a strip of side quads hangs from it one hinged to the next, and the top disc hangs from the first quad. */
function cylinderPanels(rows: number[][], n: number): Panel[] {
  const bottom = rows[1]!;
  const upper = rows[2]!;
  const panels: Panel[] = [
    { loop: [...bottom].reverse(), parent: -1, edge: null, role: 'base' },
    { loop: [bottom[0]!, bottom[1]!, upper[1]!, upper[0]!], parent: 0, edge: [bottom[0]!, bottom[1]!], role: 'lateral' },
    { loop: [...upper], parent: 1, edge: [upper[0]!, upper[1]!], role: 'top' },
  ];
  for (let j = 1; j < n; j++) {
    const k = (j + 1) % n;
    panels.push({ loop: [bottom[j]!, bottom[k]!, upper[k]!, upper[j]!], parent: j === 1 ? 1 : 2 + (j - 1), edge: [bottom[j]!, upper[j]!], role: 'lateral' });
  }
  return panels;
}

/** A cone: the base stays, a chain of side triangles hangs from it round the apex. */
function conePanels(rows: number[][], n: number): Panel[] {
  const bottom = rows[1]!;
  const apex = rows[2]![0]!;
  const panels: Panel[] = [{ loop: [...bottom].reverse(), parent: -1, edge: null, role: 'base' }];
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    panels.push({ loop: [bottom[j]!, bottom[k]!, apex], parent: j === 0 ? 0 : j, edge: j === 0 ? [bottom[0]!, bottom[1]!] : [bottom[j]!, apex], role: 'lateral' });
  }
  return panels;
}

export function build(kind: Kind, dims: Dims): Geometry {
  let built: Built;
  let dimensions: Dimension[];
  let volume: number;
  let surface: number;
  let panels: Panel[] = [];
  let netParts: NetPart[] = [];
  const h = dim(dims, 'height');

  switch (kind) {
    case 'cube':
    case 'cuboid': {
      const l = kind === 'cube' ? dim(dims, 'side') : dim(dims, 'length');
      const hh = kind === 'cube' ? l : h;
      const w = kind === 'cube' ? l : dim(dims, 'width');
      built = box(l, hh, w);
      const v = built.vertices;
      dimensions =
        kind === 'cube'
          ? [dimension('a', v[0]!, v[1]!)]
          : [dimension('l', v[0]!, v[1]!), dimension('w', v[1]!, v[5]!), dimension('h', v[1]!, v[2]!)];
      volume = l * hh * w;
      surface = 2 * (l * hh + l * w + hh * w);
      panels = boxPanels();
      netParts = [{ role: 'base', area: l * w }, { role: 'top', area: l * w }, { role: 'lateral', area: 2 * (l + w) * hh }];
      break;
    }
    case 'prism':
    case 'pyramid': {
      const n = sides(dims);
      const s = dim(dims, 'side');
      const R = circumradius(n, s);
      const apothem = R * Math.cos(Math.PI / n);
      const baseArea = (n * s * apothem) / 2;
      if (kind === 'prism') {
        built = revolve(
          [[0, -h / 2], [R, -h / 2], [R, h / 2], [0, h / 2]],
          n,
          [1, 2],
          1,
        );
        volume = baseArea * h;
        surface = 2 * baseArea + n * s * h;
      } else {
        built = centre(revolve([[0, 0], [R, 0], [0, h]], n, [1], 1));
        const slant = Math.hypot(apothem, h);
        volume = (baseArea * h) / 3;
        surface = baseArea + (n * s * slant) / 2;
      }
      panels = ringPanels(built.rows!, n, kind === 'prism');
      netParts =
        kind === 'prism'
          ? [{ role: 'base', area: baseArea }, { role: 'top', area: baseArea }, { role: 'lateral', area: n * s * h }]
          : [{ role: 'base', area: baseArea }, { role: 'lateral', area: (n * s * Math.hypot(apothem, h)) / 2 }];
      // Vertex 0 of a ring is at the angle `phase`: the base edge is between its first two vertices.
      const ringStart = 1; // index 0 is the cap centre
      const a0 = built.vertices[ringStart]!;
      const a1 = built.vertices[ringStart + 1]!;
      const baseCentre: Vec3 = [0, a0[1], 0];
      dimensions = [dimension('a', a0, a1)];
      if (kind === 'prism') dimensions.push(dimension('h', a0, [a0[0], a0[1] + h, a0[2]]));
      else dimensions.push(dimension('h', baseCentre, [0, a0[1] + h, 0]));
      break;
    }
    case 'cylinder': {
      const r = dim(dims, 'radius');
      built = revolve([[0, -h / 2], [r, -h / 2], [r, h / 2], [0, h / 2]], SEGMENTS, [1, 2], SEGMENTS / MERIDIANS);
      dimensions = [dimension('r', [0, h / 2, 0], [r, h / 2, 0]), dimension('h', [r, -h / 2, 0], [r, h / 2, 0])];
      volume = Math.PI * r * r * h;
      surface = 2 * Math.PI * r * (r + h);
      panels = cylinderPanels(built.rows!, SEGMENTS);
      netParts = [{ role: 'base', area: Math.PI * r * r }, { role: 'top', area: Math.PI * r * r }, { role: 'lateral', area: 2 * Math.PI * r * h }];
      break;
    }
    case 'cone': {
      const r = dim(dims, 'radius');
      built = revolve([[0, -h / 2], [r, -h / 2], [0, h / 2]], SEGMENTS, [1], SEGMENTS / MERIDIANS);
      dimensions = [
        dimension('r', [0, -h / 2, 0], [r, -h / 2, 0]),
        dimension('h', [0, -h / 2, 0], [0, h / 2, 0]),
        dimension('l', [r, -h / 2, 0], [0, h / 2, 0]),
      ];
      volume = (Math.PI * r * r * h) / 3;
      surface = Math.PI * r * (r + Math.hypot(r, h));
      panels = conePanels(built.rows!, SEGMENTS);
      netParts = [{ role: 'base', area: Math.PI * r * r }, { role: 'lateral', area: Math.PI * r * Math.hypot(r, h) }];
      break;
    }
    case 'sphere': {
      const r = dim(dims, 'radius');
      const profile: [number, number][] = [];
      for (let i = 0; i <= RINGS; i++) {
        const t = -Math.PI / 2 + (i / RINGS) * Math.PI;
        profile.push([Math.max(0, r * Math.cos(t)), r * Math.sin(t)]);
      }
      profile[0] = [0, -r];
      profile[RINGS] = [0, r];
      built = revolve(profile, SEGMENTS, [RINGS / 2], SEGMENTS / MERIDIANS);
      dimensions = [dimension('r', [0, 0, 0], [r, 0, 0])];
      volume = (4 / 3) * Math.PI * r ** 3;
      surface = 4 * Math.PI * r * r;
      break;
    }
    case 'hemisphere': {
      const r = dim(dims, 'radius');
      const profile: [number, number][] = [[0, 0], [r, 0]];
      for (let i = 1; i <= RINGS / 2; i++) {
        const t = (i / (RINGS / 2)) * (Math.PI / 2);
        profile.push([Math.max(0, r * Math.cos(t)), r * Math.sin(t)]);
      }
      profile[profile.length - 1] = [0, r];
      built = centre(revolve(profile, SEGMENTS, [1, 1 + RINGS / 4], SEGMENTS / MERIDIANS));
      const y0 = built.vertices[0]![1];
      dimensions = [dimension('r', [0, y0, 0], [r, y0, 0])];
      volume = (2 / 3) * Math.PI * r ** 3;
      surface = 3 * Math.PI * r * r;
      break;
    }
    case 'frustum': {
      const rb = dim(dims, 'rBottom');
      const rt = typeof dims['rTop'] === 'number' && Number.isFinite(dims['rTop']) ? Math.min(MAX_DIM, Math.max(0, dims['rTop'])) : 1;
      built = revolve([[0, -h / 2], [rb, -h / 2], [rt, h / 2], [0, h / 2]], SEGMENTS, [1, 2], SEGMENTS / MERIDIANS);
      dimensions = [
        dimension('R', [0, -h / 2, 0], [rb, -h / 2, 0]),
        dimension('r', [0, h / 2, 0], [rt, h / 2, 0]),
        dimension('h', [0, -h / 2, 0], [0, h / 2, 0]),
      ];
      const slant = Math.hypot(rb - rt, h);
      volume = (Math.PI * h * (rb * rb + rb * rt + rt * rt)) / 3;
      surface = Math.PI * (rb * rb + rt * rt + (rb + rt) * slant);
      break;
    }
  }

  const radius = Math.max(MIN_DIM, ...built.vertices.map((v) => Math.hypot(v[0], v[1], v[2])));
  return { vertices: built.vertices, faces: built.faces, edges: built.edges, dimensions, radius, volume, surface, panels, netParts };
}
