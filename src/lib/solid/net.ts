import { dot, length } from './clip';
import type { Geometry, Vec3 } from './kinds';

// The unfold of a solid (FR-3.11). The net is a hinge tree over the solid's real faces: every panel
// keeps its folded place at progress 0, and a child turns about the edge it shares with its parent by
// `progress` times the angle that lays it flat with the parent. So progress 0 is exactly the solid and
// progress 1 is the flat net, with nothing typed in by an author and nothing stored. Pure.

type Mat = readonly [number, number, number, number, number, number, number, number, number]; // row-major 3x3

interface Rigid {
  readonly r: Mat;
  readonly t: Vec3;
}

const IDENTITY: Rigid = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

const apply = (m: Rigid, p: Vec3): Vec3 => [
  m.r[0] * p[0] + m.r[1] * p[1] + m.r[2] * p[2] + m.t[0],
  m.r[3] * p[0] + m.r[4] * p[1] + m.r[5] * p[2] + m.t[1],
  m.r[6] * p[0] + m.r[7] * p[1] + m.r[8] * p[2] + m.t[2],
];

/** `a` after `b`: x goes to a(b(x)). */
function compose(a: Rigid, b: Rigid): Rigid {
  const r = a.r;
  const s = b.r;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(r[i * 3]! * s[j]! + r[i * 3 + 1]! * s[3 + j]! + r[i * 3 + 2]! * s[6 + j]!);
  return { r: out as unknown as Mat, t: apply(a, b.t) };
}

/** Rotation by `angle` about the line through `point` along the unit vector `axis` (Rodrigues). */
function rotation(point: Vec3, axis: Vec3, angle: number): Rigid {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [x, y, z] = axis;
  const k = 1 - c;
  const r: Mat = [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  const about: Rigid = { r, t: [0, 0, 0] };
  const moved = apply(about, point);
  return { r, t: [point[0] - moved[0], point[1] - moved[1], point[2] - moved[2]] };
}

function normalOf(loop: readonly number[], v: readonly Vec3[]): Vec3 {
  let n: Vec3 = [0, 0, 0];
  for (let i = 0; i < loop.length; i++) {
    const a = v[loop[i]!]!;
    const b = v[loop[(i + 1) % loop.length]!]!;
    n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])];
  }
  const l = length(n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

interface Hinge {
  point: Vec3;
  axis: Vec3;
  /** Signed angle that lays the child flat with its parent. */
  angle: number;
}

const cache = new WeakMap<Geometry, readonly (Hinge | null)[]>();

function hinges(g: Geometry): readonly (Hinge | null)[] {
  const hit = cache.get(g);
  if (hit) return hit;
  const out = g.panels.map((panel): Hinge | null => {
    if (panel.parent < 0 || !panel.edge) return null;
    const a = g.vertices[panel.edge[0]]!;
    const b = g.vertices[panel.edge[1]]!;
    const e: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = length(e) || 1;
    const axis: Vec3 = [e[0] / l, e[1] / l, e[2] / l];
    const np = normalOf(g.panels[panel.parent]!.loop, g.vertices);
    const nc = normalOf(panel.loop, g.vertices);
    const psi = Math.acos(Math.min(1, Math.max(-1, dot(np, nc))));
    // Whichever way of turning makes the child face the way its parent does is the way to lay it flat.
    const turned = rotation(a, axis, psi);
    const after = apply({ r: turned.r, t: [0, 0, 0] }, nc);
    const angle = dot(after, np) >= dot(apply({ r: rotation(a, axis, -psi).r, t: [0, 0, 0] }, nc), np) ? psi : -psi;
    return { point: a, axis, angle };
  });
  cache.set(g, out);
  return out;
}

/** The place of every panel at `progress` (0 folded, 1 flat), before the net is centred. */
function poses(g: Geometry, progress: number): Rigid[] {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const h = hinges(g);
  const out: Rigid[] = [];
  g.panels.forEach((panel, i) => {
    const hinge = h[i];
    if (!hinge || panel.parent < 0) out.push(IDENTITY);
    else out.push(compose(out[panel.parent]!, rotation(hinge.point, hinge.axis, hinge.angle * p)));
  });
  return out;
}

const centreOfNet = (g: Geometry): Vec3 => {
  const flat = poses(g, 1);
  let lo: Vec3 = [Infinity, Infinity, Infinity];
  let hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  g.panels.forEach((panel, i) => {
    for (const idx of panel.loop) {
      const q = apply(flat[i]!, g.vertices[idx]!);
      lo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1]), Math.min(lo[2], q[2])];
      hi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1]), Math.max(hi[2], q[2])];
    }
  });
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
};

const centres = new WeakMap<Geometry, Vec3>();

/** The panels as polygons at `progress`; the net slides toward the middle of the picture as it flattens. */
export function netPose(g: Geometry, progress: number): Vec3[][] {
  if (g.panels.length === 0) return [];
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  let c = centres.get(g);
  if (!c) {
    c = centreOfNet(g);
    centres.set(g, c);
  }
  const shift: Vec3 = [-c[0] * p, -c[1] * p, -c[2] * p];
  const place = poses(g, p);
  return g.panels.map((panel, i) =>
    panel.loop.map((idx) => {
      const q = apply(place[i]!, g.vertices[idx]!);
      return [q[0] + shift[0], q[1] + shift[1], q[2] + shift[2]] as Vec3;
    }),
  );
}

/** How far the flat net reaches from the middle: the picture has to fit it. */
export function netRadius(g: Geometry): number {
  let r = 0;
  for (const poly of netPose(g, 1)) for (const q of poly) r = Math.max(r, length(q));
  return r;
}
