import type { Program, Scope } from '../params';
import { analyze, type Features } from './analyze';
import { angleAt, clipLine, distance, perimeter, polygonArea, reflectLine, reflectX, reflectY, rotate, scaleAbout, translate, type P } from './geometry';
import { sampleFunction, sampleParametric, type Pt, type Segment } from './sample';
import { effectiveViewport, sane, type GraphView, type Viewport } from './viewport';

// What a `canvas2d` scene is made of at one moment (FR-3.17): every element evaluated against the current
// parameters and the window the frame's zoom and pan give, ready for a renderer to draw. Pure: the SVG
// renderer, a thumbnail and the tests all read this. Elements this story does not know are ignored.

type Num = number | string;
type Loc = Record<string, string>;
export type Label = { latex: string } | { text: Loc };

export type Token = 'axis' | 'grid' | 'curve1' | 'curve2' | 'fill' | 'accent' | 'muted' | 'success' | 'error' | 'hint' | 'selected' | 'edge' | 'section';
export type Dash = 'solid' | 'dashed' | 'dotted';
export type Marker = 'circle' | 'square' | 'diamond' | 'triangle';

export interface Style {
  color?: Token;
  width?: 1 | 2 | 3;
  dash?: Dash;
  marker?: Marker;
  fill?: 'none' | 'light' | 'medium';
}

interface Common {
  id: string;
  when?: string;
  visible?: boolean;
  style?: Style;
}
export type Element =
  | (Common & { type: 'function'; expr: string; domain?: [Num, Num]; samples?: number; label?: Label; mark?: ('intercepts' | 'turning' | 'asymptotes')[]; shade?: 'above' | 'below'; strict?: boolean })
  | (Common & { type: 'parametric'; x: string; y: string; t: [Num, Num]; samples?: number; label?: Label })
  | (Common & { type: 'point'; at: [Num, Num]; drag?: { x?: string; y?: string }; label?: Label; snap?: { step: number } })
  | (Common & { type: 'region'; between: [string, string]; from: Num; to: Num })
  | (Common & { type: 'segment'; a: string; b: string; label?: Label; measure?: boolean })
  | (Common & { type: 'line'; through: [string, string]; ray?: boolean; label?: Label })
  | (Common & { type: 'circle'; center: string; radius?: Num; through?: string; label?: Label; measure?: boolean })
  | (Common & { type: 'polygon'; points: (string | [Num, Num])[]; label?: Label; measure?: boolean })
  | (Common & { type: 'angle'; points: [string, string, string]; label?: Label; measure?: boolean })
  | (Common & { type: 'transform'; of: string; how: Transform; label?: Label })
  | (Common & { type: 'text'; at: [Num, Num]; label: Label })
  | (Common & { type: 'readout'; at: [Num, Num]; label: Loc; expr: string; decimals: number });

export type Transform =
  | { kind: 'reflect'; over: 'x' | 'y' | [string, string] }
  | { kind: 'rotate'; about?: string; degrees: Num }
  | { kind: 'translate'; dx: Num; dy: Num }
  | { kind: 'scale'; about?: string; k: Num };

export interface Canvas2DScene {
  viewport: { xMin: Num; xMax: Num; yMin: Num; yMax: Num };
  aspect?: 'equal' | 'free';
  axes?: { show: boolean; xLabel?: Label; yLabel?: Label; ticks?: 'auto' | number };
  grid?: boolean;
  pan?: boolean;
  zoom?: boolean;
  trace?: boolean;
  elements: Element[];
}

/** The look of a curve with no `style`: each takes the next, so two curves never differ by color alone (DESIGN.md). */
export const CURVE_SEQUENCE: readonly Required<Pick<Style, 'color' | 'dash' | 'marker' | 'width'>>[] = [
  { color: 'curve1', dash: 'solid', marker: 'circle', width: 2 },
  { color: 'curve2', dash: 'dashed', marker: 'square', width: 2 },
  { color: 'accent', dash: 'dotted', marker: 'diamond', width: 2 },
  { color: 'success', dash: 'dashed', marker: 'triangle', width: 2 },
];

export interface CurveStyle {
  color: Token;
  width: 1 | 2 | 3;
  dash: Dash;
  marker: Marker;
}

export interface DrawCurve {
  id: string;
  kind: 'function' | 'parametric';
  segments: Segment[];
  style: CurveStyle;
  label: Label | undefined;
  /** What to mark on a function, and what was found. */
  marks: { intercepts: boolean; turning: boolean; asymptotes: boolean };
  features: Features | null;
  /** The tinted side of an inequality: polygons in data coordinates. */
  shade: { side: 'above' | 'below'; strict: boolean; polygons: Segment[] } | null;
  /** Value of the curve at the trace position (functions only); NaN when not defined. */
  traceY: number | null;
}

export interface DrawPoint {
  id: string;
  x: number;
  y: number;
  label: Label | undefined;
  style: Style;
  /** Parameter ids this point moves, only when its coordinates are exactly those parameters. */
  drag: { x: string | null; y: string | null } | null;
  snap: number | null;
}

export interface DrawRegion {
  id: string;
  polygons: Segment[];
  style: Style;
}

export interface DrawText {
  id: string;
  x: number;
  y: number;
  label: Label;
}

export interface DrawReadout {
  id: string;
  x: number;
  y: number;
  label: Loc;
  value: number;
  decimals: number;
}

/** A shape of the geometry elements, in data coordinates. */
export type DrawShape =
  | { kind: 'line'; id: string; ends: [Pt, Pt]; style: ShapeStyle; label: Label | undefined; mid: Pt }
  | { kind: 'circle'; id: string; cx: number; cy: number; r: number; style: ShapeStyle; label: Label | undefined }
  | { kind: 'polygon'; id: string; points: Pt[]; style: ShapeStyle; label: Label | undefined; image: boolean }
  | { kind: 'angle'; id: string; o: Pt; a: Pt; b: Pt; degrees: number; style: ShapeStyle };

export interface ShapeStyle {
  color: Token;
  width: 1 | 2 | 3;
  dash: Dash;
  fill: 'none' | 'light' | 'medium';
}

/** A number a shape has, to be written beside it and listed as text. `of` is the element it belongs to. */
export interface DrawMeasure {
  id: string;
  of: string;
  kind: 'length' | 'angle' | 'radius' | 'circumference' | 'area' | 'perimeter';
  value: number;
  at: Pt;
  label: Label | undefined;
}

export interface Drawables {
  viewport: Viewport;
  curves: DrawCurve[];
  points: DrawPoint[];
  regions: DrawRegion[];
  texts: DrawText[];
  readouts: DrawReadout[];
  shapes: DrawShape[];
  measures: DrawMeasure[];
}

export interface BuildOptions {
  scene: Canvas2DScene;
  program: Program;
  scope: Scope;
  view: GraphView;
  /** Element ids a step has hidden, and ids a step has shown (for elements that start invisible). */
  hidden?: ReadonlySet<string>;
  shown?: ReadonlySet<string>;
  /** Where the trace cursor is, or null for none. */
  traceX?: number | null;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function resolveViewport(scene: Canvas2DScene, program: Program, scope: Scope): Viewport {
  const v = scene.viewport;
  return sane({ xMin: program.evaluate(v.xMin, scope), xMax: program.evaluate(v.xMax, scope), yMin: program.evaluate(v.yMin, scope), yMax: program.evaluate(v.yMax, scope) });
}

const polygonsBetween = (top: (x: number) => number, bottom: (x: number) => number, a: number, b: number, n: number): Segment[] => {
  if (!(isNumber(a) && isNumber(b) && b > a)) return [];
  const out: Segment[] = [];
  let upper: Pt[] = [];
  let lower: Pt[] = [];
  const flush = () => {
    if (upper.length > 1) out.push([...upper, ...lower.reverse()]);
    upper = [];
    lower = [];
  };
  for (let i = 0; i <= n; i++) {
    const x = i === n ? b : a + ((b - a) * i) / n;
    const p = top(x);
    const q = bottom(x);
    if (!(Number.isFinite(p) && Number.isFinite(q))) flush();
    else {
      upper.push([x, p]);
      lower.push([x, q]);
    }
  }
  flush();
  return out;
};

/** The elements of the scene at these parameter values, in this window. */
export function buildDrawables({ scene, program, scope, view, hidden, shown, traceX = null }: BuildOptions): Drawables {
  const base = resolveViewport(scene, program, scope);
  const viewport = effectiveViewport(base, view, scene.aspect ?? 'equal');
  const out: Drawables = { viewport, curves: [], points: [], regions: [], texts: [], readouts: [], shapes: [], measures: [] };
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  let curveIndex = 0;

  const elements = scene.elements.slice(0, 60);
  const isOn = (el: Element): boolean => {
    if (hidden?.has(el.id)) return false;
    if (el.visible === false && !shown?.has(el.id)) return false;
    if (el.when !== undefined) {
      const w = program.evaluate(el.when, scope);
      if (!(w !== 0 && Number.isFinite(w))) return false;
    }
    return true;
  };

  // Geometry names points by id: the points that are on and computable, then the polygons built on them
  // (the visibility of a polygon does not matter to a `transform` of it, so a step can show only the image).
  const pts = new Map<string, P>();
  for (const el of elements) {
    if (el.type !== 'point' || !isOn(el)) continue;
    const x = num(el.at[0]);
    const y = num(el.at[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) pts.set(el.id, [x, y]);
  }
  const vertices = (list: (string | [Num, Num])[]): P[] | null => {
    const v: P[] = [];
    for (const item of list) {
      const p: P | undefined = typeof item === 'string' ? pts.get(item) : [num(item[0]), num(item[1])];
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
      v.push(p);
    }
    return v;
  };
  const polys = new Map<string, P[]>();
  for (const el of elements) {
    if (el.type !== 'polygon') continue;
    const v = vertices(el.points);
    if (v) polys.set(el.id, v);
  }
  const shape = (el: Element, base: ShapeStyle): ShapeStyle => ({ color: el.style?.color ?? base.color, width: el.style?.width ?? base.width, dash: el.style?.dash ?? base.dash, fill: el.style?.fill ?? base.fill });
  const mid = (a: P, b: P): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  for (const el of elements) {
    if (!isOn(el)) continue;

    switch (el.type) {
      case 'function': {
        const f = program.fn(el.expr, 'x', scope);
        const dom: [number, number] = el.domain ? [num(el.domain[0]), num(el.domain[1])] : [viewport.xMin, viewport.xMax];
        // The marks look over the whole domain asked for, not only what is on screen, so they stay while panning.
        const lo = isNumber(dom[0]) ? dom[0] : viewport.xMin;
        const hi = isNumber(dom[1]) ? dom[1] : viewport.xMax;
        const segments = sampleFunction(f, lo, hi, viewport, el.samples);
        const marks = { intercepts: el.mark?.includes('intercepts') === true, turning: el.mark?.includes('turning') === true, asymptotes: el.mark?.includes('asymptotes') === true };
        const features = marks.intercepts || marks.turning || marks.asymptotes ? analyze(f, Math.max(lo, viewport.xMin - (viewport.xMax - viewport.xMin)), Math.min(hi, viewport.xMax + (viewport.xMax - viewport.xMin))) : null;
        const look = CURVE_SEQUENCE[curveIndex % CURVE_SEQUENCE.length]!;
        const style: CurveStyle = {
          color: el.style?.color ?? look.color,
          width: el.style?.width ?? look.width,
          dash: el.style?.dash ?? (el.shade && el.strict ? 'dashed' : look.dash),
          marker: el.style?.marker ?? look.marker,
        };
        curveIndex++;
        let shade: DrawCurve['shade'] = null;
        if (el.shade) {
          const edge = el.shade === 'below' ? viewport.yMin : viewport.yMax;
          const polygons = segments.map((seg): Segment => [...seg, [seg[seg.length - 1]![0], edge] as Pt, [seg[0]![0], edge] as Pt]);
          shade = { side: el.shade, strict: el.strict === true, polygons };
        }
        const ty = traceX !== null && Number.isFinite(traceX) ? f(traceX) : null;
        out.curves.push({ id: el.id, kind: 'function', segments, style, label: el.label, marks, features, shade, traceY: ty });
        break;
      }
      case 'parametric': {
        const fx = program.fn(el.x, 't', scope);
        const fy = program.fn(el.y, 't', scope);
        const t0 = num(el.t[0]);
        const t1 = num(el.t[1]);
        const look = CURVE_SEQUENCE[curveIndex % CURVE_SEQUENCE.length]!;
        curveIndex++;
        out.curves.push({
          id: el.id,
          kind: 'parametric',
          segments: sampleParametric(fx, fy, t0, t1, viewport, el.samples),
          style: { color: el.style?.color ?? look.color, width: el.style?.width ?? look.width, dash: el.style?.dash ?? look.dash, marker: el.style?.marker ?? look.marker },
          label: el.label,
          marks: { intercepts: false, turning: false, asymptotes: false },
          features: null,
          shade: null,
          traceY: null,
        });
        break;
      }
      case 'point': {
        const x = num(el.at[0]);
        const y = num(el.at[1]);
        if (!(Number.isFinite(x) && Number.isFinite(y))) break;
        // Draggable only when each coordinate is exactly the parameter it moves (topic-format 2.1 rule 2).
        const xp = el.drag?.x && el.at[0] === el.drag.x ? el.drag.x : null;
        const yp = el.drag?.y && el.at[1] === el.drag.y ? el.drag.y : null;
        out.points.push({ id: el.id, x, y, label: el.label, style: el.style ?? {}, drag: xp || yp ? { x: xp, y: yp } : null, snap: el.snap?.step ?? null });
        break;
      }
      case 'region': {
        const top = program.fn(el.between[0], 'x', scope);
        const bottom = program.fn(el.between[1], 'x', scope);
        out.regions.push({ id: el.id, polygons: polygonsBetween(top, bottom, num(el.from), num(el.to), 200), style: el.style ?? {} });
        break;
      }
      case 'segment': {
        const a = pts.get(el.a);
        const b = pts.get(el.b);
        if (!a || !b) break;
        const ends = clipLine(a, b, viewport, 'segment');
        if (ends) out.shapes.push({ kind: 'line', id: el.id, ends, style: shape(el, { color: 'curve1', width: 2, dash: 'solid', fill: 'none' }), label: el.label, mid: mid(a, b) });
        if (el.measure) out.measures.push({ id: `${el.id}-length`, of: el.id, kind: 'length', value: distance(a, b), at: mid(a, b), label: el.label });
        break;
      }
      case 'line': {
        const a = pts.get(el.through[0]);
        const b = pts.get(el.through[1]);
        if (!a || !b) break;
        const ends = clipLine(a, b, viewport, el.ray ? 'ray' : 'line');
        if (ends) out.shapes.push({ kind: 'line', id: el.id, ends, style: shape(el, { color: 'curve1', width: 1, dash: 'solid', fill: 'none' }), label: el.label, mid: mid(ends[0], ends[1]) });
        break;
      }
      case 'circle': {
        const c = pts.get(el.center);
        if (!c) break;
        const through = el.through ? pts.get(el.through) : undefined;
        const r = el.radius !== undefined ? num(el.radius) : through ? distance(c, through) : NaN;
        if (!(Number.isFinite(r) && r > 0)) break;
        out.shapes.push({ kind: 'circle', id: el.id, cx: c[0], cy: c[1], r, style: shape(el, { color: 'curve2', width: 2, dash: 'solid', fill: 'none' }), label: el.label });
        if (el.measure) {
          const at: Pt = [c[0] + r, c[1]];
          out.measures.push({ id: `${el.id}-radius`, of: el.id, kind: 'radius', value: r, at, label: el.label });
          out.measures.push({ id: `${el.id}-circumference`, of: el.id, kind: 'circumference', value: 2 * Math.PI * r, at, label: el.label });
          out.measures.push({ id: `${el.id}-area`, of: el.id, kind: 'area', value: Math.PI * r * r, at, label: el.label });
        }
        break;
      }
      case 'polygon': {
        const v = polys.get(el.id);
        if (!v || v.length < 3) break;
        out.shapes.push({ kind: 'polygon', id: el.id, points: v.map((p): Pt => [p[0], p[1]]), style: shape(el, { color: 'curve1', width: 2, dash: 'solid', fill: 'light' }), label: el.label, image: false });
        if (el.measure) {
          const at = v.reduce<Pt>((s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length], [0, 0]);
          out.measures.push({ id: `${el.id}-perimeter`, of: el.id, kind: 'perimeter', value: perimeter(v), at, label: el.label });
          out.measures.push({ id: `${el.id}-area`, of: el.id, kind: 'area', value: polygonArea(v), at, label: el.label });
        }
        break;
      }
      case 'angle': {
        const a = pts.get(el.points[0]);
        const o = pts.get(el.points[1]);
        const b = pts.get(el.points[2]);
        if (!a || !o || !b) break;
        const degrees = angleAt(a, o, b);
        if (degrees !== null) out.shapes.push({ kind: 'angle', id: el.id, o, a, b, degrees, style: shape(el, { color: 'accent', width: 2, dash: 'solid', fill: 'light' }) });
        // An angle lists its measure unless the author turned it off; one with no direction reads "undefined" (NaN).
        if (el.measure !== false) out.measures.push({ id: `${el.id}-angle`, of: el.id, kind: 'angle', value: degrees ?? NaN, at: o, label: el.label });
        break;
      }
      case 'transform': {
        const src = polys.get(el.of);
        if (!src) break;
        const how = el.how;
        let map: ((p: P) => P | null) | null = null;
        if (how.kind === 'reflect') {
          if (how.over === 'x') map = reflectX;
          else if (how.over === 'y') map = reflectY;
          else {
            const a = pts.get(how.over[0]);
            const b = pts.get(how.over[1]);
            if (a && b) map = (p) => reflectLine(p, a, b);
          }
        } else if (how.kind === 'rotate') {
          const c = how.about ? pts.get(how.about) : ([0, 0] as P);
          const deg = num(how.degrees);
          if (c && Number.isFinite(deg)) map = (p) => rotate(p, c, deg);
        } else if (how.kind === 'translate') {
          const dx = num(how.dx);
          const dy = num(how.dy);
          if (Number.isFinite(dx) && Number.isFinite(dy)) map = (p) => translate(p, dx, dy);
        } else {
          const c = how.about ? pts.get(how.about) : ([0, 0] as P);
          const k = num(how.k);
          if (c && Number.isFinite(k)) map = (p) => scaleAbout(p, c, k);
        }
        if (!map) break;
        const image: Pt[] = [];
        for (const p of src) {
          const q = map(p);
          if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) break;
          image.push(q);
        }
        if (image.length !== src.length) break;
        out.shapes.push({ kind: 'polygon', id: el.id, points: image, style: shape(el, { color: 'accent', width: 2, dash: 'dashed', fill: 'light' }), label: el.label, image: true });
        break;
      }
      case 'text': {
        const x = num(el.at[0]);
        const y = num(el.at[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) out.texts.push({ id: el.id, x, y, label: el.label });
        break;
      }
      case 'readout': {
        const x = num(el.at[0]);
        const y = num(el.at[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) out.readouts.push({ id: el.id, x, y, label: el.label, value: program.evaluate(el.expr, scope), decimals: el.decimals });
        break;
      }
    }
  }
  return out;
}
