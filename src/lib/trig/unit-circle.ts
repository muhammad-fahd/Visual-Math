import type { Prim, Sentence } from '../numbermodel';
import { exactValue, normalize, quadrant, radText, trigValues, trim } from './values';

// What a `unit-circle` scene is made of at one angle (FR-3.21, topic-format 2.4): the circle with its point,
// the cosine, the sine and the tangent as lines, the angle's arc, the wave the point traces in a second panel,
// and the sentences that say the same in words. The picture is in a 400 by 300 box with y downward, so the
// point at angle t is (cx + r cos t, cy - r sin t). Pure.

export interface UnitCircleOptions {
  /** The angle in degrees (the viewer converts from the parameter's unit). */
  angleDeg: number;
  /** The tangent is drawn (the scene has `tangent` and its `when` is non-zero). */
  tangent: boolean;
  wave: { fn: 'sin' | 'cos' | 'tan'; fromDeg: number; toDeg: number } | null;
  quadrants: boolean;
  /** Part ids a step has hidden: `circle`, `point`, `radius`, `arc`, `cosine`, `sine`, `tangent`, `wave`, `quadrants`. */
  hidden?: ReadonlySet<string>;
}

export interface Built {
  prims: Prim[];
  sentences: Sentence[];
  /** Where the point is and the circle it is on, for the handle; null when nothing is drawn. */
  circle: { cx: number; cy: number; r: number; x: number; y: number } | null;
}

const finite = (n: number) => Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function buildUnitCircle(o: UnitCircleOptions): Built {
  const out: Built = { prims: [], sentences: [], circle: null };
  if (!finite(o.angleDeg)) return out;
  const show = (part: string) => !o.hidden?.has(part);
  const { prims } = out;
  const say = (key: string, values: Record<string, string | number> = {}) => out.sentences.push({ key, values });
  const txt = (x: number, y: number, text: string, tone: 'axis' | 'muted' | 'accent' | 'curve1' | 'curve2' = 'axis', size = 12, anchor: 'start' | 'middle' | 'end' = 'middle', bold = false) =>
    prims.push({ t: 'text', x, y, text, anchor, size, tone, bold });

  const deg = o.angleDeg;
  const theta = (deg * Math.PI) / 180;
  const v = trigValues(deg);
  // The wave's axis is 0 to 360 degrees at most, however wide a range the author asks for.
  const range = o.wave ? { fn: o.wave.fn, fromDeg: Math.max(0, o.wave.fromDeg), toDeg: Math.min(360, o.wave.toDeg) } : null;
  const wave = range && show('wave') && finite(range.fromDeg) && finite(range.toDeg) && range.toDeg > range.fromDeg ? range : null;
  const cx = wave ? 105 : 200;
  const cy = 150;
  const r = wave ? 85 : 100;
  const px = cx + r * Math.cos(theta);
  const py = cy - r * Math.sin(theta);
  out.circle = { cx, cy, r, x: px, y: py };

  // Axes and the circle.
  prims.push({ t: 'line', x1: cx - r - 12, y1: cy, x2: cx + r + 12, y2: cy, tone: 'grid', width: 1 });
  prims.push({ t: 'line', x1: cx, y1: cy - r - 12, x2: cx, y2: cy + r + 12, tone: 'grid', width: 1 });
  if (show('circle')) prims.push({ t: 'sector', cx, cy, r, a0: 0, a1: 2 * Math.PI, tone: 'axis', fill: 'none' });
  if (o.quadrants && show('quadrants')) {
    const k = r * 0.6;
    txt(cx + k, cy - k, 'I', 'muted', 13, 'middle', true);
    txt(cx - k, cy - k, 'II', 'muted', 13, 'middle', true);
    txt(cx - k, cy + k + 8, 'III', 'muted', 13, 'middle', true);
    txt(cx + k, cy + k + 8, 'IV', 'muted', 13, 'middle', true);
  }

  // The angle's arc and its number.
  if (show('arc') && normalize(deg) > 0.5) {
    const a = normalize(deg) * (Math.PI / 180);
    prims.push({ t: 'sector', cx, cy, r: 20, a0: -a, a1: 0, tone: 'accent', fill: 'light' });
    txt(cx + 36 * Math.cos(-a / 2), cy + 36 * Math.sin(-a / 2) + 4, `${trim(normalize(deg), 1)}°`, 'accent', 11);
  }
  if (show('radius')) prims.push({ t: 'line', x1: cx, y1: cy, x2: px, y2: py, tone: 'axis', width: 2 });
  // The cosine runs along the x-axis and the sine up from it; they differ by dash as well as by color.
  if (show('cosine')) prims.push({ t: 'line', x1: cx, y1: cy, x2: px, y2: cy, tone: 'curve1', width: 3.5 });
  if (show('sine')) prims.push({ t: 'line', x1: px, y1: cy, x2: px, y2: py, tone: 'curve2', width: 3.5, dash: true });

  // The tangent: where the line through the centre and the point meets the line x = 1.
  if (o.tangent && show('tangent') && v.tan !== null) {
    const ty = clamp(cy - r * v.tan, cy - 145, cy + 145);
    prims.push({ t: 'line', x1: cx + r, y1: cy, x2: cx + r, y2: ty, tone: 'accent', width: 3 });
    prims.push({ t: 'line', x1: px, y1: py, x2: cx + r, y2: ty, tone: 'accent', width: 1, dash: true });
  }
  if (show('point')) prims.push({ t: 'dot', x: px, y: py, r: 6, tone: 'selected' });

  // The wave in a second panel.
  if (wave) {
    const x0 = 215;
    const x1 = 385;
    const amp = wave.fn === 'tan' ? 40 : 80;
    const f = (d: number): number | null => {
      const t = trigValues(d);
      return wave.fn === 'sin' ? t.sin : wave.fn === 'cos' ? t.cos : t.tan;
    };
    const xOf = (d: number) => x0 + ((d - wave.fromDeg) / (wave.toDeg - wave.fromDeg)) * (x1 - x0);
    prims.push({ t: 'line', x1: x0, y1: cy, x2: x1, y2: cy, tone: 'axis', width: 1.4 });
    prims.push({ t: 'line', x1: x0, y1: cy - 125, x2: x0, y2: cy + 125, tone: 'axis', width: 1.4 });
    for (const k of [1, -1]) {
      prims.push({ t: 'line', x1: x0 - 3, y1: cy - amp * k, x2: x0 + 3, y2: cy - amp * k, tone: 'axis', width: 1 });
      txt(x0 - 6, cy - amp * k + 4, k > 0 ? '1' : '\u22121', 'muted', 10, 'end');
    }
    for (const d of [wave.fromDeg, (wave.fromDeg + wave.toDeg) / 2, wave.toDeg]) {
      prims.push({ t: 'line', x1: xOf(d), y1: cy - 4, x2: xOf(d), y2: cy + 4, tone: 'axis', width: 1 });
      txt(xOf(d), cy + 18, `${trim(d, 0)}°`, 'muted', 10);
    }
    // Samples: a value that cannot be computed, one far off the panel, or a jump of more than 2 breaks the line.
    const N = 180;
    let run: [number, number][] = [];
    let prev: number | null = null;
    const flush = () => {
      if (run.length > 1) prims.push({ t: 'path', points: run, tone: 'curve1', width: 2 });
      run = [];
      prev = null;
    };
    for (let i = 0; i <= N; i++) {
      const d = wave.fromDeg + ((wave.toDeg - wave.fromDeg) * i) / N;
      const y = f(d);
      if (y === null || !finite(y) || Math.abs(y) > 3 || (prev !== null && Math.abs(y - prev) > 2)) {
        flush();
        continue;
      }
      run.push([xOf(d), cy - amp * y]);
      prev = y;
    }
    flush();
    // The dot at the current angle, when it is in range, and a guide from the circle for the sine.
    // The angle itself, else the same angle in 0 to 360, else a turn less: whichever is on the panel.
    const here = [deg, normalize(deg), normalize(deg) - 360].find((d) => d >= wave.fromDeg && d <= wave.toDeg) ?? null;
    const yHere = here === null ? null : f(here);
    if (here !== null && yHere !== null && Math.abs(yHere) <= 3) {
      const dy = cy - amp * yHere;
      if (wave.fn === 'sin' && show('point')) prims.push({ t: 'line', x1: px, y1: py, x2: xOf(here), y2: dy, tone: 'muted', width: 1, dash: true });
      prims.push({ t: 'dot', x: xOf(here), y: dy, r: 5, tone: 'selected' });
    }
  }

  // Words.
  say('angle', { deg: trim(deg, 2), rad: radText(deg) });
  const exact = (fn: 'sin' | 'cos' | 'tan', value: number) => {
    const e = exactValue(fn, deg);
    return e ? `${trim(value)} (${e})` : trim(value);
  };
  say('sine', { v: exact('sin', v.sin) });
  say('cosine', { v: exact('cos', v.cos) });
  if (v.tan === null) say('tangentUndefined');
  else say('tangent', { v: exact('tan', v.tan) });
  const q = quadrant(deg);
  if (q === 'axis') say('axis');
  else say('quadrant', { q });
  return out;
}
