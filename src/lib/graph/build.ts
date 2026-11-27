import type { Program, Scope } from '../params';
import { analyze, type Features } from './analyze';
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
  | (Common & { type: 'text'; at: [Num, Num]; label: Label })
  | (Common & { type: 'readout'; at: [Num, Num]; label: Loc; expr: string; decimals: number });

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

export interface Drawables {
  viewport: Viewport;
  curves: DrawCurve[];
  points: DrawPoint[];
  regions: DrawRegion[];
  texts: DrawText[];
  readouts: DrawReadout[];
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
  const out: Drawables = { viewport, curves: [], points: [], regions: [], texts: [], readouts: [] };
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  let curveIndex = 0;

  for (const el of scene.elements.slice(0, 60)) {
    if (hidden?.has(el.id)) continue;
    if (el.visible === false && !shown?.has(el.id)) continue;
    if (el.when !== undefined && !(program.evaluate(el.when, scope) !== 0 && Number.isFinite(program.evaluate(el.when, scope)))) continue;

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
