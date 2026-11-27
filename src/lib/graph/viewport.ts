// The window of a 2D graph (FR-3.17): the declared viewport, what the frame's zoom and pan make of it, and
// the mapping from data to the picture. The picture is always drawn in a W by H box that the SVG scales,
// so the same numbers serve the screen, a thumbnail and the tests. Pure.

export interface Viewport {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/** What the frame says: 1 is the declared viewport, above 1 is zoomed in; pan is a fraction of the picture, positive moves it right and down. */
export interface GraphView {
  readonly scale: number;
  readonly panX: number;
  readonly panY: number;
}

/** The picture box; 4:3 like the frame's surface. */
export const W = 400;
export const H = 300;

const finite = (x: number) => Number.isFinite(x);

/** A viewport that is safe to draw: finite, with a positive width and height; anything else becomes -10..10. */
export function sane(v: Partial<Viewport>): Viewport {
  const ok = finite(v.xMin ?? NaN) && finite(v.xMax ?? NaN) && finite(v.yMin ?? NaN) && finite(v.yMax ?? NaN) && v.xMax! > v.xMin! && v.yMax! > v.yMin!;
  return ok ? (v as Viewport) : { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
}

/**
 * The window shown at this zoom and pan. Zoom is about the centre; the frame limits it to 0.25 to 8. With
 * `equal` one unit has the same length on both axes: the window grows on the axis that has room.
 */
export function effectiveViewport(base: Viewport, view: GraphView, aspect: 'equal' | 'free' = 'equal'): Viewport {
  const b = sane(base);
  const scale = finite(view.scale) && view.scale > 0 ? Math.min(8, Math.max(0.25, view.scale)) : 1;
  let spanX = (b.xMax - b.xMin) / scale;
  let spanY = (b.yMax - b.yMin) / scale;
  if (aspect === 'equal') {
    const unitsPerPixel = Math.max(spanX / W, spanY / H);
    spanX = unitsPerPixel * W;
    spanY = unitsPerPixel * H;
  }
  const cx = (b.xMin + b.xMax) / 2 - (finite(view.panX) ? view.panX : 0) * spanX;
  const cy = (b.yMin + b.yMax) / 2 + (finite(view.panY) ? view.panY : 0) * spanY;
  return sane({ xMin: cx - spanX / 2, xMax: cx + spanX / 2, yMin: cy - spanY / 2, yMax: cy + spanY / 2 });
}

export const toX = (v: Viewport, x: number): number => ((x - v.xMin) / (v.xMax - v.xMin)) * W;
export const toY = (v: Viewport, y: number): number => H - ((y - v.yMin) / (v.yMax - v.yMin)) * H;
export const fromX = (v: Viewport, px: number): number => v.xMin + (px / W) * (v.xMax - v.xMin);
export const fromY = (v: Viewport, py: number): number => v.yMin + ((H - py) / H) * (v.yMax - v.yMin);

/** Round tick marks: a step of 1, 2 or 5 times a power of ten, whichever gives the count nearest `target`. */
export function niceTicks(min: number, max: number, target = 8): number[] {
  if (!finite(min) || !finite(max) || max <= min || target < 1) return [];
  const raw = (max - min) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  let step = pow;
  let best = Infinity;
  for (const m of [1, 2, 5, 10]) {
    const count = (max - min) / (m * pow);
    const miss = Math.abs(count - target);
    if (miss < best) {
      best = miss;
      step = m * pow;
    }
  }
  const first = Math.ceil(min / step - 1e-9);
  const out: number[] = [];
  for (let i = 0; i < 200; i++) {
    const v = (first + i) * step;
    if (v > max + step * 1e-9) break;
    const value = Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12));
    if (out.length > 0 && value <= out[out.length - 1]!) break; // the step is below the precision of the numbers
    out.push(value);
  }
  return out;
}

/** Decimals that show a tick step exactly (0.5 gives 1, 0.25 gives 2, 20 gives 0). */
export function tickDecimals(ticks: readonly number[]): number {
  if (ticks.length < 2) return 0;
  const step = Math.abs(ticks[1]! - ticks[0]!);
  for (let d = 0; d <= 6; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6 * Math.max(1, scaled)) return d;
  }
  return 6;
}
