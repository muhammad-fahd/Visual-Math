import { basis, clipBelow, enclosedVolume, type Poly } from './clip';
import type { Geometry, Kind, NetPart, Vec3 } from './kinds';
import { netPose, netRadius } from './net';
import { crossSection, sectionPlane, type Section, type SectionSpec } from './section';

// What a solid scene is made of at one moment (FR-3.10 to 3.12): the solid, or its net while it is
// unfolding, the cutting plane and the cut face, and the liquid. Each is plain geometry in a layer, and
// both renderers (three.js and SVG) draw the same layers, so the tiers cannot disagree. Pure.

export type Token = 'fill' | 'section' | 'curve1';

export interface Layer {
  readonly id: 'solid' | 'liquid' | 'cut' | 'plane' | 'net';
  readonly vertices: readonly Vec3[];
  readonly faces: readonly (readonly number[])[];
  readonly edges: readonly (readonly [number, number])[];
  /** The scene color role (DESIGN.md tokens); never a color value. */
  readonly token: Token;
  /** Drawn from both sides (a net, a cut face, a plane), not only the outer side. */
  readonly doubleSided: boolean;
  /** 1 is opaque. The solid's own opacity also depends on the view mode. */
  readonly opacity: number;
}

export function solidLayer(g: Geometry): Layer {
  return { id: 'solid', vertices: g.vertices, faces: g.faces, edges: g.edges, token: 'fill', doubleSided: false, opacity: 1 };
}

/** Separate polygons as one layer, each with its own vertices and an outline. */
export function layerOfPolys(id: Layer['id'], polys: readonly Poly[], token: Token, opacity: number, doubleSided = true): Layer {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const edges: [number, number][] = [];
  for (const poly of polys) {
    const start = vertices.length;
    vertices.push(...poly);
    faces.push(poly.map((_, i) => start + i));
    for (let i = 0; i < poly.length; i++) edges.push([start + i, start + ((i + 1) % poly.length)]);
  }
  return { id, vertices, faces, edges, token, doubleSided, opacity };
}

export interface SceneState {
  readonly section?: SectionSpec;
  /** 0 to 1; undefined when the scene has no net. */
  readonly net?: { readonly progress: number };
  /** 0 to 1 of the height; undefined when the scene has no fill. */
  readonly fill?: { readonly level: number };
}

export interface Composed {
  readonly layers: readonly Layer[];
  /** The radius that fills the picture: the solid, or its flat net if that is wider. */
  readonly fit: number;
  /** The plane cut the solid and this is what it cut; null if there is no section or the plane misses. */
  readonly section: Section | null;
  readonly sectionAsked: boolean;
  readonly net: { readonly progress: number; readonly parts: readonly NetPart[]; readonly total: number } | null;
  readonly fill: { readonly level: number; readonly share: number } | null;
  /** A section or a liquid needs a see-through solid to be seen. */
  readonly glass: boolean;
  /** The dimension lines belong to the folded solid; they are hidden while it is unfolded. */
  readonly showDimensions: boolean;
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

const toPolys = (g: Geometry): Poly[] => g.faces.map((f) => f.map((i) => g.vertices[i]!));

export function compose(kind: Kind, g: Geometry, state: SceneState): Composed {
  const layers: Layer[] = [];
  let fit = g.radius;

  // The net.
  let net: Composed['net'] = null;
  const supported = g.panels.length > 0;
  if (state.net && supported) {
    const progress = clamp01(state.net.progress);
    net = { progress, parts: g.netParts, total: g.netParts.reduce((s, p) => s + p.area, 0) };
    fit = Math.max(fit, netRadius(g));
    layers.push(progress > 1e-6 ? layerOfPolys('net', netPose(g, progress), 'fill', 1) : solidLayer(g));
  } else {
    layers.push(solidLayer(g));
  }

  // The cutting plane and the cut face.
  const plane = sectionPlane(state.section);
  let section: Section | null = null;
  if (plane) {
    section = crossSection(g, kind, plane);
    const { u, v } = basis(plane.n);
    const o: Vec3 = [plane.n[0] * plane.d, plane.n[1] * plane.d, plane.n[2] * plane.d];
    const reach = g.radius * 1.25;
    const corner = (a: number, b: number): Vec3 => [o[0] + (u[0] * a + v[0] * b) * reach, o[1] + (u[1] * a + v[1] * b) * reach, o[2] + (u[2] * a + v[2] * b) * reach];
    layers.push(layerOfPolys('plane', [[corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]], 'section', 0.12));
    if (section) layers.push(layerOfPolys('cut', [section.polygon3], 'section', 0.55));
  }

  // The liquid.
  let fill: Composed['fill'] = null;
  if (state.fill) {
    const level = clamp01(state.fill.level);
    const ys = g.vertices.map((p) => p[1]);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const all = toPolys(g);
    const whole = enclosedVolume(all) || 1;
    let share = 0;
    if (level >= 1) {
      layers.push(layerOfPolys('liquid', all, 'curve1', 0.45));
      share = 1;
    } else if (level > 0) {
      const { kept, cut } = clipBelow(all, { n: [0, 1, 0], d: lo + level * (hi - lo) }, g.radius);
      const closed = cut ? [...kept, cut] : kept;
      layers.push(layerOfPolys('liquid', closed, 'curve1', 0.45));
      share = enclosedVolume(closed) / whole;
    }
    fill = { level, share: Math.min(1, share) };
  }

  const unfolded = net !== null && net.progress > 1e-6;
  return { layers, fit, section, sectionAsked: plane !== null, net, fill, glass: plane !== null || state.fill !== undefined, showDimensions: !unfolded };
}
