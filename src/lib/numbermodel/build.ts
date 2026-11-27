import { format } from '../expr';
import type { Token } from '../graph';
import type { Program, Scope } from '../params';

// What a `number-model` scene is made of at one moment (FR-3.19, topic-format 2.6): a flat picture of
// rectangles, sectors, lines and text in a 400 by 300 box, the controls a visitor can move, and the sentences
// that say the same in words. Pure: the SVG renderer, a thumbnail and the tests all read this.
// A control is how drag and drop stays a parameter write: it has discrete positions, the pointer picks the
// nearest, the keyboard the next one, and `toParam` turns the picked value into the parameter's value.

export const W = 400;
export const H = 300;

type Num = number | string;
export type Label = { latex: string } | { text: Record<string, string> };

export type Model =
  | { kind: 'numberLine'; min: Num; max: Num; step: Num; marker?: Num; marks?: { at: Num; label?: Label }[]; jumps?: { from: Num; to: Num }[] }
  | { kind: 'fractionBars'; rows: { num: Num; den: Num }[]; alignLine?: boolean }
  | { kind: 'fractionCircle'; num: Num; den: Num }
  | { kind: 'areaModel'; rows: Num; cols: Num; splitRows?: Num; splitCols?: Num }
  | { kind: 'tenFrame'; count: Num }
  | { kind: 'placeValue'; value: Num }
  | { kind: 'percentGrid'; percent: Num };

export type Fill = 'none' | 'light' | 'medium' | 'solid';
type Anchor = 'start' | 'middle' | 'end';
export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; tone: Token; fill: Fill }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; tone: Token; width: number; dash?: boolean }
  | { t: 'text'; x: number; y: number; text: string; anchor: Anchor; size: number; tone: Token; bold?: boolean }
  | { t: 'sector'; cx: number; cy: number; r: number; a0: number; a1: number; tone: Token; fill: Fill }
  | { t: 'dot'; x: number; y: number; r: number; tone: Token }
  | { t: 'jump'; x1: number; x2: number; y: number; h: number; tone: Token };

/** A sentence as a message key and its values; the viewer says it in the visitor's language. */
export interface Sentence {
  key: string;
  values: Record<string, string | number>;
}

export interface Control {
  id: string;
  param: string;
  label: Sentence;
  /** The values the handle can take, in order, and where each one is in the picture. */
  values: number[];
  positions: [number, number][];
  index: number;
  /** The parameter value for a picked handle value (a place-value column replaces one digit of the number). */
  toParam: (value: number) => number;
}

export interface Built {
  prims: Prim[];
  controls: Control[];
  sentences: Sentence[];
}

export interface BuildOptions {
  model: Model;
  program: Program;
  scope: Scope;
  /** Parameter ids: a field is draggable only when it is exactly one of them. */
  params: ReadonlySet<string>;
  /** Part ids a step has hidden (`marks`, `jumps`, `align`, `labels`). */
  hidden?: ReadonlySet<string>;
  /** The words of a label in the visitor's language. */
  text?: (label: Label) => string;
}

export const MAX_STEPS = 400;
const EMPTY: Built = { prims: [], controls: [], sentences: [] };
const finite = (n: number) => Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const fmt = (n: number, d = 4) => format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** `n / d` in lowest terms as text ("1/2"); a whole number has no denominator. */
export const lowest = (n: number, d: number): string => {
  const g = gcd(n, d) || 1;
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
};

const nearest = (values: readonly number[], v: number): number => {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (Math.abs(values[i]! - v) < Math.abs(values[best]! - v)) best = i;
  return best;
};

export function buildModel(o: BuildOptions): Built {
  const { model, program, scope, params, hidden } = o;
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const whole = (v: Num | undefined, lo: number, hi: number): number | null => {
    const n = num(v);
    return finite(n) ? clamp(Math.round(n), lo, hi) : null;
  };
  /** A denominator: a whole number from 1 to 24; 0, below 0 or not a number is no fraction at all. */
  const denominator = (v: Num | undefined): number | null => {
    const n = num(v);
    return finite(n) && Math.round(n) >= 1 ? Math.min(24, Math.round(n)) : null;
  };
  const bound = (raw: Num | undefined): string | null => (typeof raw === 'string' && params.has(raw) ? raw : null);
  const show = (part: string) => !hidden?.has(part);
  const out: Built = { prims: [], controls: [], sentences: [] };
  const say = (key: string, values: Record<string, string | number> = {}) => out.sentences.push({ key, values });
  const control = (c: Omit<Control, 'index'> & { current: number }) => out.controls.push({ ...c, index: nearest(c.values, c.current) });
  const txt = (x: number, y: number, text: string, anchor: Anchor = 'middle', size = 12, tone: Token = 'axis', bold = false) => out.prims.push({ t: 'text', x, y, text, anchor, size, tone, bold });

  switch (model.kind) {
    case 'numberLine': {
      const min = num(model.min);
      const max = num(model.max);
      const step = num(model.step);
      if (!(finite(min) && finite(max) && finite(step) && step > 0 && max > min)) return EMPTY;
      // Ticks stop at the last whole step, so none is drawn past the end of the line.
      const n = Math.floor((max - min) / step + 1e-9);
      if (n < 1 || n > MAX_STEPS) return EMPTY;
      const x0 = 30;
      const x1 = 370;
      const y = 170;
      const xOf = (v: number) => x0 + ((v - min) / (max - min)) * (x1 - x0);
      let d = 0;
      while (d < 6 && Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) > 1e-9) d++;
      out.prims.push({ t: 'line', x1: x0, y1: y, x2: x1, y2: y, tone: 'axis', width: 1.6 });
      const every = Math.ceil(n / 10);
      for (let i = 0; i <= n; i++) {
        const v = min + i * step;
        const major = i % every === 0 || i === n;
        out.prims.push({ t: 'line', x1: xOf(v), y1: y - (major ? 7 : 4), x2: xOf(v), y2: y + (major ? 7 : 4), tone: 'axis', width: 1 });
        if (major && show('labels')) txt(xOf(v), y + 24, fmt(v, d), 'middle', 11, 'muted');
      }
      say('numberLine', { min: fmt(min, d), max: fmt(max, d), step: fmt(step, d) });
      if (show('marks')) {
        for (const m of (model.marks ?? []).slice(0, 12)) {
          const at = num(m.at);
          if (!finite(at) || at < min || at > max) continue;
          out.prims.push({ t: 'dot', x: xOf(at), y, r: 4, tone: 'accent' });
          const label = m.label && o.text ? o.text(m.label) : '';
          if (label && show('labels')) txt(xOf(at), y - 14, label, 'middle', 11, 'axis', true);
          say(label ? 'mark' : 'markAt', { at: fmt(at, d), label });
        }
      }
      if (show('jumps')) {
        for (const j of (model.jumps ?? []).slice(0, 6)) {
          const a = num(j.from);
          const b = num(j.to);
          if (!(finite(a) && finite(b) && a >= min && b <= max && a <= max && b >= min && a !== b)) continue;
          out.prims.push({ t: 'jump', x1: xOf(a), x2: xOf(b), y: y - 10, h: 34, tone: 'curve1' });
          txt((xOf(a) + xOf(b)) / 2, y - 52, `${b > a ? '+' : ''}${fmt(b - a, d)}`, 'middle', 12, 'curve1', true);
          say('jump', { from: fmt(a, d), to: fmt(b, d), by: fmt(b - a, d) });
        }
      }
      const marker = num(model.marker);
      if (model.marker !== undefined && finite(marker)) {
        const values = Array.from({ length: n + 1 }, (_, i) => min + i * step);
        const at = clamp(marker, min, max);
        out.prims.push({ t: 'dot', x: xOf(at), y, r: 7, tone: 'selected' });
        say('marker', { value: fmt(at, d) });
        const p = bound(model.marker);
        if (p) control({ id: 'marker', param: p, label: { key: 'drag.marker', values: {} }, values, positions: values.map((v): [number, number] => [xOf(v), y]), current: marker, toParam: (v) => v });
      }
      return out;
    }

    case 'fractionBars': {
      const rows = model.rows.slice(0, 4);
      const x0 = 40;
      const w = 320;
      const bh = 40;
      const gap = 34;
      const total = rows.length * bh + (rows.length - 1) * gap;
      const y0 = (H - total) / 2;
      const parts: { num: number; den: number; i: number }[] = [];
      rows.forEach((r, i) => {
        const den = denominator(r.den);
        const n = whole(r.num, 0, den ?? 24);
        if (den === null || n === null) return;
        const y = y0 + i * (bh + gap);
        const k = Math.min(n, den);
        for (let c = 0; c < den; c++) out.prims.push({ t: 'rect', x: x0 + (w * c) / den, y, w: w / den, h: bh, tone: i % 2 === 0 ? 'curve1' : 'curve2', fill: c < k ? 'medium' : 'none' });
        txt(x0, y - 8, `${k}/${den}`, 'start', 13, 'axis', true);
        parts.push({ num: k, den, i });
        say('bar', { n: i + 1, num: k, den, lowest: lowest(k, den) });
        const p = bound(r.num);
        if (p) {
          const values = Array.from({ length: den + 1 }, (_, c) => c);
          control({ id: `bar-${i + 1}`, param: p, label: { key: 'drag.bar', values: { n: i + 1 } }, values, positions: values.map((c): [number, number] => [x0 + (w * c) / den, y + bh / 2]), current: k, toParam: (v) => v });
        }
      });
      // The line is the end of the first bar, so it needs the first bar to be drawable.
      if (model.alignLine && show('align') && parts[0]?.i === 0) {
        const first = parts[0]!;
        const x = x0 + (w * first.num) / first.den;
        out.prims.push({ t: 'line', x1: x, y1: y0 - 14, x2: x, y2: y0 + total + 10, tone: 'accent', width: 2, dash: true });
        // Equal by cross-multiplication, never by comparing decimals.
        for (let a = 0; a < parts.length; a++) {
          for (let b = a + 1; b < parts.length; b++) {
            const pa = parts[a]!;
            const pb = parts[b]!;
            if (pa.num * pb.den === pb.num * pa.den) say('same', { a: pa.i + 1, b: pb.i + 1, lowest: lowest(pa.num, pa.den) });
          }
        }
      }
      return out;
    }

    case 'fractionCircle': {
      const den = denominator(model.den);
      const n = den === null ? null : whole(model.num, 0, den);
      if (den === null || n === null) return EMPTY;
      const cx = 200;
      const cy = 150;
      const r = 110;
      const angle = (k: number) => -Math.PI / 2 + (2 * Math.PI * k) / den;
      for (let k = 0; k < den; k++) out.prims.push({ t: 'sector', cx, cy, r, a0: angle(k), a1: angle(k + 1), tone: 'curve1', fill: k < n ? 'medium' : 'none' });
      txt(cx, 292, `${n}/${den}`, 'middle', 14, 'axis', true);
      say('circle', { num: n, den, lowest: lowest(n, den) });
      const p = bound(model.num);
      if (p) {
        const values = Array.from({ length: den + 1 }, (_, k) => k);
        control({ id: 'circle', param: p, label: { key: 'drag.circle', values: {} }, values, positions: values.map((k): [number, number] => {
          // The whole circle and no part are the same point (the top): the whole sits a little to its left so the pointer can reach both.
          const a = k === den && den > 1 ? angle(k) - 0.1 : angle(k);
          return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        }), current: n, toParam: (v) => v });
      }
      return out;
    }

    case 'areaModel': {
      const R = whole(model.rows, 1, 20);
      const C = whole(model.cols, 1, 20);
      if (R === null || C === null) return EMPTY;
      const sc0 = model.splitCols === undefined ? null : whole(model.splitCols, 0, C);
      const sr0 = model.splitRows === undefined ? null : whole(model.splitRows, 0, R);
      const sc = sc0 !== null && sc0 > 0 && sc0 < C ? sc0 : null;
      const sr = sr0 !== null && sr0 > 0 && sr0 < R ? sr0 : null;
      const s = Math.min(320 / C, 220 / R);
      const x0 = (W - s * C) / 2;
      const y0 = (H - s * R) / 2 + 6;
      const cols = sc === null ? [[0, C]] : [[0, sc], [sc, C]];
      const rowsParts = sr === null ? [[0, R]] : [[0, sr], [sr, R]];
      cols.forEach(([c0, c1], ci) => {
        rowsParts.forEach(([r0, r1], ri) => {
          out.prims.push({ t: 'rect', x: x0 + s * c0!, y: y0 + s * r0!, w: s * (c1! - c0!), h: s * (r1! - r0!), tone: ci === 0 ? 'curve1' : 'curve2', fill: ri === 0 ? 'medium' : 'light' });
        });
      });
      for (let c = 0; c <= C; c++) out.prims.push({ t: 'line', x1: x0 + s * c, y1: y0, x2: x0 + s * c, y2: y0 + s * R, tone: 'grid', width: 0.6 });
      for (let r = 0; r <= R; r++) out.prims.push({ t: 'line', x1: x0, y1: y0 + s * r, x2: x0 + s * C, y2: y0 + s * r, tone: 'grid', width: 0.6 });
      if (sc !== null) out.prims.push({ t: 'line', x1: x0 + s * sc, y1: y0 - 4, x2: x0 + s * sc, y2: y0 + s * R + 4, tone: 'axis', width: 2 });
      if (sr !== null) out.prims.push({ t: 'line', x1: x0 - 4, y1: y0 + s * sr, x2: x0 + s * C + 4, y2: y0 + s * sr, tone: 'axis', width: 2 });
      txt(x0 + (s * C) / 2, y0 - 28, String(C), 'middle', 13, 'axis', true);
      txt(x0 - 28, y0 + (s * R) / 2 + 4, String(R), 'end', 13, 'axis', true);
      if (show('labels')) {
        cols.forEach(([c0, c1]) => rowsParts.forEach(([r0, r1]) => {
          if (sc !== null || sr !== null) txt(x0 + s * ((c0! + c1!) / 2), y0 + s * ((r0! + r1!) / 2) + 4, `${r1! - r0!} × ${c1! - c0!}`, 'middle', 12, 'axis', true);
        }));
      }
      say('area', { rows: R, cols: C, area: R * C });
      if (sc !== null && sr === null) say('splitCols', { rows: R, a: sc, b: C - sc, p: R * sc, q: R * (C - sc), area: R * C });
      else if (sr !== null && sc === null) say('splitRows', { cols: C, a: sr, b: R - sr, p: C * sr, q: C * (R - sr), area: R * C });
      else if (sc !== null && sr !== null) say('splitBoth', { a: sr, b: R - sr, c: sc, d: C - sc, area: R * C });
      const pc = bound(model.splitCols);
      if (pc) {
        const values = Array.from({ length: C + 1 }, (_, k) => k);
        control({ id: 'split-cols', param: pc, label: { key: 'drag.splitCols', values: {} }, values, positions: values.map((k): [number, number] => [x0 + s * k, y0 - 4]), current: sc0 ?? 0, toParam: (v) => v });
      }
      const pr = bound(model.splitRows);
      if (pr) {
        const values = Array.from({ length: R + 1 }, (_, k) => k);
        control({ id: 'split-rows', param: pr, label: { key: 'drag.splitRows', values: {} }, values, positions: values.map((k): [number, number] => [x0 - 4, y0 + s * k]), current: sr0 ?? 0, toParam: (v) => v });
      }
      return out;
    }

    case 'tenFrame': {
      const count = whole(model.count, 0, 20);
      if (count === null) return EMPTY;
      const cell = 44;
      const fx = (W - 5 * cell) / 2;
      const fy = [26, 156];
      const centre = (i: number): [number, number] => [fx + (i % 5) * cell + cell / 2, fy[Math.floor(i / 10)]! + Math.floor((i % 10) / 5) * cell + cell / 2];
      for (let f = 0; f < 2; f++) {
        out.prims.push({ t: 'rect', x: fx, y: fy[f]!, w: 5 * cell, h: 2 * cell, tone: 'axis', fill: 'none' });
        out.prims.push({ t: 'line', x1: fx, y1: fy[f]! + cell, x2: fx + 5 * cell, y2: fy[f]! + cell, tone: 'axis', width: 1 });
        for (let c = 1; c < 5; c++) out.prims.push({ t: 'line', x1: fx + c * cell, y1: fy[f]!, x2: fx + c * cell, y2: fy[f]! + 2 * cell, tone: 'axis', width: 1 });
      }
      for (let i = 0; i < count; i++) {
        const [x, y] = centre(i);
        out.prims.push({ t: 'dot', x, y, r: 16, tone: i < 10 ? 'curve1' : 'curve2' });
      }
      say('tenFrame', { count });
      if (count < 10) say('toTen', { more: 10 - count, count });
      else if (count === 10) say('tenFull');
      else say('overTen', { extra: count - 10 });
      const p = bound(model.count);
      if (p) {
        const values = Array.from({ length: 21 }, (_, v) => v);
        const positions = values.map((v): [number, number] => (v === 0 ? [fx - 18, fy[0]! + cell] : centre(v - 1)));
        control({ id: 'count', param: p, label: { key: 'drag.count', values: {} }, values, positions, current: count, toParam: (v) => v });
      }
      return out;
    }

    case 'placeValue': {
      const value = whole(model.value, 0, 9999);
      if (value === null) return EMPTY;
      const digits = [Math.floor(value / 1000), Math.floor(value / 100) % 10, Math.floor(value / 10) % 10, value % 10];
      const weights = [1000, 100, 10, 1];
      const widths = [64, 52, 40, 28];
      const names = ['thousands', 'hundreds', 'tens', 'ones'];
      const base = 270;
      const block = 20;
      const pitch = 23;
      const p = bound(model.value);
      digits.forEach((dg, i) => {
        const cx = 80 + i * 80;
        txt(cx, 30, String(weights[i]), 'middle', 13, 'muted', true);
        for (let b = 0; b < dg; b++) out.prims.push({ t: 'rect', x: cx - widths[i]! / 2, y: base - (b + 1) * pitch + (pitch - block), w: widths[i]!, h: block, tone: 'curve1', fill: 'medium' });
        txt(cx, 292, String(dg), 'middle', 14, 'axis', true);
        if (p) {
          const values = Array.from({ length: 10 }, (_, d) => d);
          control({
            id: `digit-${names[i]}`,
            param: p,
            label: { key: 'drag.digit', values: { place: weights[i]! } },
            values,
            positions: values.map((d): [number, number] => [cx, base - d * pitch - block / 2 + (d === 0 ? block : pitch - block)]),
            current: dg,
            toParam: (d) => value + (d - dg) * weights[i]!,
          });
        }
      });
      say('placeValue', { value, th: digits[0]!, h: digits[1]!, t: digits[2]!, o: digits[3]! });
      return out;
    }

    case 'percentGrid': {
      const pc = num(model.percent);
      if (!finite(pc)) return EMPTY;
      const count = clamp(Math.round(pc), 0, 100);
      const s = 24;
      const x0 = (W - 10 * s) / 2;
      const y0 = 30;
      const centre = (i: number): [number, number] => [x0 + (i % 10) * s + s / 2, y0 + Math.floor(i / 10) * s + s / 2];
      for (let i = 0; i < 100; i++) out.prims.push({ t: 'rect', x: x0 + (i % 10) * s, y: y0 + Math.floor(i / 10) * s, w: s, h: s, tone: 'curve1', fill: i < count ? 'medium' : 'none' });
      for (let k = 0; k <= 10; k++) {
        out.prims.push({ t: 'line', x1: x0 + k * s, y1: y0, x2: x0 + k * s, y2: y0 + 10 * s, tone: 'grid', width: 0.6 });
        out.prims.push({ t: 'line', x1: x0, y1: y0 + k * s, x2: x0 + 10 * s, y2: y0 + k * s, tone: 'grid', width: 0.6 });
      }
      txt(W / 2, 292, `${count}%`, 'middle', 14, 'axis', true);
      say('percent', { count });
      const p = bound(model.percent);
      if (p) {
        const values = Array.from({ length: 101 }, (_, v) => v);
        const positions = values.map((v): [number, number] => (v === 0 ? [x0 - 12, y0 + s / 2] : centre(v - 1)));
        control({ id: 'percent', param: p, label: { key: 'drag.percent', values: {} }, values, positions, current: count, toParam: (v) => v });
      }
      return out;
    }
  }
}
