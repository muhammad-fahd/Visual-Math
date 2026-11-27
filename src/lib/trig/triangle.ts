import type { Prim, Sentence } from '../numbermodel';
import type { Program, Scope } from '../params';
import { trim } from './values';

// What a `right-triangle` scene is made of (FR-3.21, topic-format 2.5): the triangle, its right-angle mark, the
// angle arc, the side labels, and the ratios as sentences. The sides come from the two the author gave or from the
// angle and the hypotenuse. Pure.

type Num = number | string;

export type Given = { mode: 'sides'; adjacent: Num; opposite: Num } | { mode: 'angle'; angle: Num; hypotenuse: Num };

export interface TriangleOptions {
  given: Given;
  labels?: 'abc' | 'opp-adj-hyp';
  ratios?: ('sin' | 'cos' | 'tan')[];
  program: Program;
  scope: Scope;
  /** The words for the sides, in the visitor's language (the layout stays free of any language). */
  words: { opposite: string; adjacent: string; hypotenuse: string };
  /** Part ids a step has hidden: `triangle`, `rightAngle`, `angleArc`, `sideLabels`, `ratios`. */
  hidden?: ReadonlySet<string>;
}

export interface Triangle {
  adjacent: number;
  opposite: number;
  hypotenuse: number;
  angleDeg: number;
}

export interface Built {
  prims: Prim[];
  sentences: Sentence[];
  triangle: Triangle | null;
}

const finite = (n: number) => Number.isFinite(n);

/** The sides and the angle, or null when the given numbers do not make a triangle. */
export function solveTriangle(program: Program, scope: Scope, given: Given): Triangle | null {
  const num = (v: Num) => program.evaluate(v, scope);
  if (given.mode === 'sides') {
    const adjacent = num(given.adjacent);
    const opposite = num(given.opposite);
    if (!(finite(adjacent) && finite(opposite) && adjacent > 0 && opposite > 0)) return null;
    return { adjacent, opposite, hypotenuse: Math.hypot(adjacent, opposite), angleDeg: (Math.atan2(opposite, adjacent) * 180) / Math.PI };
  }
  const angle = num(given.angle);
  const hypotenuse = num(given.hypotenuse);
  if (!(finite(angle) && finite(hypotenuse) && hypotenuse > 0)) return null;
  const a = Math.min(89, Math.max(1, angle));
  const rad = (a * Math.PI) / 180;
  return { adjacent: hypotenuse * Math.cos(rad), opposite: hypotenuse * Math.sin(rad), hypotenuse, angleDeg: a };
}

export function buildTriangle(o: TriangleOptions): Built {
  const out: Built = { prims: [], sentences: [], triangle: null };
  const t = solveTriangle(o.program, o.scope, o.given);
  if (!t) return out;
  out.triangle = t;
  const show = (part: string) => !o.hidden?.has(part);
  const { prims } = out;
  const say = (key: string, values: Record<string, string | number> = {}) => out.sentences.push({ key, values });
  const txt = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end', tone: 'axis' | 'accent' = 'axis', size = 13) => prims.push({ t: 'text', x, y, text, anchor, size, tone, bold: true });

  // The angle is at the bottom left, the right angle at the bottom right.
  const s = Math.min(250 / t.adjacent, 190 / t.opposite);
  const w = t.adjacent * s;
  const h = t.opposite * s;
  const x0 = (400 - w) / 2 - 10;
  const y1 = (300 + h) / 2;
  const R: [number, number] = [x0 + w, y1];
  const A: [number, number] = [x0 + w, y1 - h];
  if (show('triangle')) {
    prims.push({ t: 'line', x1: x0, y1, x2: R[0], y2: R[1], tone: 'axis', width: 2.5 });
    prims.push({ t: 'line', x1: R[0], y1: R[1], x2: A[0], y2: A[1], tone: 'axis', width: 2.5 });
    prims.push({ t: 'line', x1: x0, y1, x2: A[0], y2: A[1], tone: 'axis', width: 2.5 });
  }
  if (show('rightAngle')) {
    const k = Math.min(14, 0.3 * Math.min(w, h));
    prims.push({ t: 'rect', x: R[0] - k, y: R[1] - k, w: k, h: k, tone: 'muted', fill: 'none' });
  }
  if (show('angleArc')) {
    const rad = (t.angleDeg * Math.PI) / 180;
    const ar = Math.min(34, w * 0.5);
    prims.push({ t: 'sector', cx: x0, cy: y1, r: ar, a0: -rad, a1: 0, tone: 'accent', fill: 'light' });
    txt(x0 + (ar + 12) * Math.cos(-rad / 2), y1 + (ar + 12) * Math.sin(-rad / 2) + 4, 'θ', 'middle', 'accent', 14);
  }
  if (show('sideLabels')) {
    const abc = o.labels === 'abc';
    txt(x0 + w / 2, y1 + 22, abc ? 'b' : o.words.adjacent, 'middle');
    txt(R[0] + 8, y1 - h / 2 + 5, abc ? 'a' : o.words.opposite, 'start');
    txt(x0 + w / 2 - 8, y1 - h / 2 - 8, abc ? 'c' : o.words.hypotenuse, 'end');
  }

  say('sides', { adj: trim(t.adjacent, 2), opp: trim(t.opposite, 2), hyp: trim(t.hypotenuse, 2), angle: trim(t.angleDeg, 2) });
  if (show('ratios')) {
    for (const ratio of o.ratios ?? []) {
      if (ratio === 'sin') say('ratioSin', { opp: trim(t.opposite, 2), hyp: trim(t.hypotenuse, 2), value: trim(t.opposite / t.hypotenuse) });
      else if (ratio === 'cos') say('ratioCos', { adj: trim(t.adjacent, 2), hyp: trim(t.hypotenuse, 2), value: trim(t.adjacent / t.hypotenuse) });
      else say('ratioTan', { opp: trim(t.opposite, 2), adj: trim(t.adjacent, 2), value: trim(t.opposite / t.adjacent) });
    }
  }
  return out;
}
