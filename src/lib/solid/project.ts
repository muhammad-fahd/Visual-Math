import type { Geometry, Vec3 } from './kinds';

// Orthographic projection of a solid for the light 2D mode and the static image (AD-13 tiers B and C),
// and the one definition of "what the camera sees" that the three.js renderer is built to match: turn
// about the vertical axis by the azimuth, tilt by the elevation, then scale and move. Pure.

export interface ViewLike {
  readonly azimuth: number;
  readonly elevation: number;
  readonly scale: number;
  readonly panX: number;
  readonly panY: number;
}

/** The picture is drawn in a square of this half-size; the farthest vertex of the solid reaches `FIT`. */
export const HALF = 60;
export const FIT = 50;
/** No emitted coordinate leaves this window, whatever the input. */
export const WINDOW = 1000;

const RAD = Math.PI / 180;
const clampWindow = (x: number) => (Number.isFinite(x) ? Math.min(WINDOW, Math.max(-WINDOW, x)) : 0);

export interface Projected {
  x: number;
  y: number;
  /** Larger is nearer the viewer. */
  depth: number;
}

/** Rotation by the view, in solid units: x right, y up, depth toward the viewer. */
export function rotate(p: Vec3, view: ViewLike): Vec3 {
  const a = view.azimuth * RAD;
  const e = view.elevation * RAD;
  const x1 = p[0] * Math.cos(a) + p[2] * Math.sin(a);
  const z1 = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
  const y2 = p[1] * Math.cos(e) - z1 * Math.sin(e);
  const z2 = p[1] * Math.sin(e) + z1 * Math.cos(e);
  return [x1, y2, z2];
}

export function project(p: Vec3, view: ViewLike, radius: number): Projected {
  const [x, y, depth] = rotate(p, view);
  const unit = (FIT / Math.max(radius, 1e-9)) * view.scale;
  return {
    x: clampWindow(x * unit + view.panX * 2 * HALF),
    y: clampWindow(-y * unit + view.panY * 2 * HALF),
    depth: clampWindow(depth * unit),
  };
}

export type Mode = 'solid' | 'wireframe' | 'transparent';

export interface DrawFace {
  /** Points as `x,y` pairs for an SVG `points` attribute. */
  readonly points: string;
  readonly depth: number;
  /** A face toward the viewer; the others are only drawn in transparent mode. */
  readonly front: boolean;
  /** Dark to light by how directly the face looks at the viewer, 0 to 1. */
  readonly light: number;
}

export interface DrawEdge {
  readonly a: Projected;
  readonly b: Projected;
  /** Behind the solid: drawn dashed (transparent and wireframe) or not at all (solid). */
  readonly hidden: boolean;
}

export interface DrawList {
  /** Far to near. */
  readonly faces: readonly DrawFace[];
  readonly edges: readonly DrawEdge[];
  /** `label` is where the letter is written: beside the line, on the side away from the solid, so it does not sit on the picture. */
  readonly dimensions: readonly { id: string; a: Projected; b: Projected; mid: Projected; label: { x: number; y: number }; value: number }[];
  /** The three axes from the origin, in the same projection. */
  readonly axes: readonly { id: 'x' | 'y' | 'z'; a: Projected; b: Projected }[];
}

const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

/** Which faces touch each edge, so an edge is hidden exactly when every face beside it faces away. */
function adjacency(geometry: Geometry): Map<string, number[]> {
  const map = new Map<string, number[]>();
  geometry.faces.forEach((face, f) => {
    for (let i = 0; i < face.length; i++) {
      const k = key(face[i]!, face[(i + 1) % face.length]!);
      const list = map.get(k);
      if (list) list.push(f);
      else map.set(k, [f]);
    }
  });
  return map;
}

const cache = new WeakMap<Geometry, Map<string, number[]>>();

/**
 * What to draw for a solid seen through `view`. `fit` is the radius that fills the picture; a viewer
 * passes the largest the solid can get, so a slider that grows the solid visibly grows it.
 */
export function drawList(geometry: Geometry, view: ViewLike, fit: number = geometry.radius): DrawList {
  const pts = geometry.vertices.map((v) => project(v, view, fit));
  const turned = geometry.vertices.map((v) => rotate(v, view));

  // A face looks toward the viewer when the turned normal has a positive depth component. The solids
  // are convex, so this and a far-to-near sort are all the hidden-surface work there is.
  const faces: DrawFace[] = geometry.faces.map((loop) => {
    const p0 = turned[loop[0]!]!;
    const p1 = turned[loop[1]!]!;
    const p2 = turned[loop[2]!]!;
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    const facing = nz / len;
    const depth = loop.reduce((s, i) => s + pts[i]!.depth, 0) / loop.length;
    return {
      points: loop.map((i) => `${round(pts[i]!.x)},${round(pts[i]!.y)}`).join(' '),
      depth,
      front: facing > 1e-9,
      light: Math.min(1, Math.max(0, Math.abs(facing))),
    };
  });
  const order = faces.map((_, i) => i).sort((a, b) => faces[a]!.depth - faces[b]!.depth);

  let adj = cache.get(geometry);
  if (!adj) {
    adj = adjacency(geometry);
    cache.set(geometry, adj);
  }
  const edges: DrawEdge[] = geometry.edges.map(([a, b]) => {
    const touching = adj!.get(key(a, b)) ?? [];
    const hidden = touching.length > 0 && touching.every((f) => !faces[f]!.front);
    return { a: pts[a]!, b: pts[b]!, hidden };
  });

  const centre = project([0, 0, 0], view, fit);
  const dimensions = geometry.dimensions.map((d) => {
    const a = project(d.from, view, fit);
    const b = project(d.to, view, fit);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, depth: (a.depth + b.depth) / 2 };
    return { id: d.id, a, b, mid, label: labelPosition(a, b, mid, centre), value: d.value };
  });

  const reach = geometry.radius * 1.3;
  const origin: Vec3 = [0, 0, 0];
  const axes = (['x', 'y', 'z'] as const).map((id) => ({
    id,
    a: project(origin, view, fit),
    b: project(id === 'x' ? [reach, 0, 0] : id === 'y' ? [0, reach, 0] : [0, 0, reach], view, fit),
  }));

  return { faces: order.map((i) => faces[i]!), edges, dimensions, axes };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** How far beside its line a dimension's letter is written, in picture units. */
export const LABEL_OFFSET = 7;

/**
 * Beside the line and away from the solid's centre. A line through the centre (a height along the axis)
 * has no "away": the left is taken, so it keeps clear of a slant side written on the right. A line that
 * runs along the picture's horizontal (a radius) is written below.
 */
function labelPosition(a: Projected, b: Projected, mid: Projected, centre: Projected): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: mid.x, y: mid.y - LABEL_OFFSET };
  const nx = -dy / length;
  const ny = dx / length;
  const away = (mid.x - centre.x) * nx + (mid.y - centre.y) * ny;
  let sign: number;
  if (Math.abs(away) > 0.5) sign = away > 0 ? 1 : -1;
  else if (Math.abs(nx) > 1e-6) sign = nx < 0 ? 1 : -1; // the left
  else sign = ny > 0 ? 1 : -1; // below
  return { x: clampWindow(mid.x + sign * nx * LABEL_OFFSET), y: clampWindow(mid.y + sign * ny * LABEL_OFFSET) };
}
