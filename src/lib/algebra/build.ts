import { format } from '../expr';
import type { Prim, Sentence } from '../numbermodel';
import type { Program, Scope } from '../params';

// What an `algebra-tool` scene is made of at one moment (FR-3.20, topic-format 2.7): the balance scale, the
// algebra tiles and the function machine as the same flat prims the number models use (so one renderer draws
// them), and the step solver as data for a list of math lines. Pure: the renderer and the tests read this.
// All interaction is a parameter, so nothing here moves by itself.

type Num = number | string;
type Loc = Record<string, string>;

export type Tool =
  | { kind: 'balanceScale'; left: { xs: Num; ones: Num }; right: { xs: Num; ones: Num }; x: Num }
  | { kind: 'algebraTiles'; terms: { x2: Num; x: Num; one: Num }; mode: 'expand' | 'factor' }
  | { kind: 'functionMachine'; input: Num; rule: string; showRule: boolean }
  | { kind: 'stepSolver'; variable: string; solution: number; lines: { latex: string; lhs: string; rhs: string; note: Loc }[]; reveal: string };

export interface SolverView {
  variable: string;
  solution: number;
  /** How many lines are shown (1 to all of them). */
  revealed: number;
  lines: { latex: string; note: Loc }[];
  /** False when a step hid the `notes` part. */
  notes: boolean;
}

export interface Built {
  prims: Prim[];
  sentences: Sentence[];
  solver: SolverView | null;
}

export interface BuildOptions {
  tool: Tool;
  program: Program;
  scope: Scope;
  /** Part ids a step has hidden (`labels`, `rule`, `notes`). */
  hidden?: ReadonlySet<string>;
}

const finite = (n: number) => Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const fmt = (n: number, d = 4) => format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
const EMPTY: Built = { prims: [], sentences: [], solver: null };

/** The text of `xs` x-blocks and `ones` ones: "2x + 3", "x", "7", "0". */
export function sideText(xs: number, ones: number): string {
  const parts: string[] = [];
  if (xs > 0) parts.push(`${xs === 1 ? '' : xs}x`);
  if (ones > 0) parts.push(String(ones));
  return parts.length > 0 ? parts.join(' + ') : '0';
}

/** `a x^2 + b x + c` as text, with unit coefficients and zero terms left out: "x² + 5x + 6". */
export function polyText(a: number, b: number, c: number): string {
  const parts: string[] = [];
  if (a > 0) parts.push(`${a === 1 ? '' : a}x²`);
  if (b > 0) parts.push(`${b === 1 ? '' : b}x`);
  if (c > 0) parts.push(String(c));
  return parts.length > 0 ? parts.join(' + ') : '0';
}

/** Integers m, n, p, q with m n = a, p q = c and m q + n p = b: the tiles of a x^2 + b x + c fit the rectangle (m x + p)(n x + q). */
export function factorTiles(a: number, b: number, c: number): { m: number; n: number; p: number; q: number } | null {
  if (!(a >= 1)) return null;
  for (let m = 1; m <= a; m++) {
    if (a % m !== 0) continue;
    const n = a / m;
    for (let p = 0; p <= c; p++) {
      for (let q = 0; q <= Math.max(b, c); q++) {
        if (p * q === c && m * q + n * p === b) return { m, n, p, q };
      }
    }
  }
  return null;
}

const side = (k: number, r: number) => {
  const lead = k === 1 ? 'x' : `${k}x`;
  return `(${r > 0 ? `${lead} + ${r}` : lead})`;
};

export function buildTool(o: BuildOptions): Built {
  const { tool, program, scope, hidden } = o;
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const whole = (v: Num | undefined, lo: number, hi: number): number | null => {
    const n = num(v);
    return finite(n) ? clamp(Math.round(n), lo, hi) : null;
  };
  const show = (part: string) => !hidden?.has(part);
  const out: Built = { prims: [], sentences: [], solver: null };
  const say = (key: string, values: Record<string, string | number> = {}) => out.sentences.push({ key, values });
  const txt = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', size = 12, tone: 'axis' | 'muted' | 'curve1' | 'curve2' | 'accent' = 'axis', bold = false) =>
    out.prims.push({ t: 'text', x, y, text, anchor, size, tone, bold });

  switch (tool.kind) {
    case 'balanceScale': {
      const xsL = whole(tool.left.xs, 0, 10);
      const onesL = whole(tool.left.ones, 0, 20);
      const xsR = whole(tool.right.xs, 0, 10);
      const onesR = whole(tool.right.ones, 0, 20);
      const x = num(tool.x);
      if (xsL === null || onesL === null || xsR === null || onesR === null || !finite(x)) return EMPTY;
      const L = xsL * x + onesL;
      const R = xsR * x + onesR;
      const d = L - R;
      const level = Math.abs(d) <= 1e-9 * Math.max(1, Math.abs(L), Math.abs(R));
      // The heavier side is lower; the tilt grows with the difference up to 12 degrees.
      const theta = ((level ? 0 : clamp(d * 2, -12, 12)) * Math.PI) / 180;
      const cx = 200;
      const cy = 95;
      const half = 130;
      const ends: readonly [readonly [number, number], readonly [number, number]] = [
        [cx - half * Math.cos(theta), cy + half * Math.sin(theta)],
        [cx + half * Math.cos(theta), cy - half * Math.sin(theta)],
      ];
      out.prims.push({ t: 'line', x1: cx, y1: cy, x2: cx, y2: 265, tone: 'axis', width: 3 });
      out.prims.push({ t: 'line', x1: 150, y1: 265, x2: 250, y2: 265, tone: 'axis', width: 4 });
      out.prims.push({ t: 'line', x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1], tone: 'axis', width: 4 });
      out.prims.push({ t: 'dot', x: cx, y: cy, r: 6, tone: 'axis' });
      const sides = [
        { xs: xsL, ones: onesL },
        { xs: xsR, ones: onesR },
      ];
      sides.forEach((s, i) => {
        const [ex, ey] = ends[i]!;
        const panY = ey + 70;
        out.prims.push({ t: 'line', x1: ex, y1: ey, x2: ex - 46, y2: panY, tone: 'axis', width: 1.4 });
        out.prims.push({ t: 'line', x1: ex, y1: ey, x2: ex + 46, y2: panY, tone: 'axis', width: 1.4 });
        out.prims.push({ t: 'rect', x: ex - 56, y: panY, w: 112, h: 8, tone: 'axis', fill: 'solid' });
        // Blocks sit on the pan in rows, x-blocks first.
        const items = [...Array.from({ length: s.xs }, () => 26), ...Array.from({ length: s.ones }, () => 12)];
        // The most blocks a pan allows (10 x-blocks and 20 ones) would stack past the beam: shrink them until they fit.
        const stackHeight = (k: number) => {
          let x = 0;
          let h = 0;
          let rowH = 0;
          for (const base of items) {
            const size = base * k;
            if (x + size > 104 && x > 0) {
              h += rowH + 2;
              x = 0;
              rowH = 0;
            }
            x += size + 2;
            rowH = Math.max(rowH, size);
          }
          return h + rowH;
        };
        let k = 1;
        for (let n = 0; n < 5 && stackHeight(k) > 60; n++) k = Math.max(0.3, (k * 0.9 * 60) / stackHeight(k));
        let rowX = ex - 52;
        let rowBase = panY;
        let rowH = 0;
        items.forEach((base) => {
          const size = base * k;
          if (rowX + size > ex + 52 && rowX > ex - 52) {
            rowBase -= rowH + 2;
            rowX = ex - 52;
            rowH = 0;
          }
          out.prims.push({ t: 'rect', x: rowX, y: rowBase - size, w: size, h: size, tone: base === 26 ? 'curve1' : 'curve2', fill: 'medium' });
          if (base === 26 && size >= 16 && show('labels')) txt(rowX + size / 2, rowBase - size / 2 + 5, 'x', 'middle', 14, 'axis', true);
          rowX += size + 2;
          rowH = Math.max(rowH, size);
        });
        if (show('labels')) txt(ex, panY + 26, sideText(s.xs, s.ones), 'middle', 14, 'axis', true);
      });
      say('balance', { left: sideText(xsL, onesL), right: sideText(xsR, onesR), l: fmt(L), r: fmt(R), x: fmt(x) });
      say(level ? 'balanced' : d > 0 ? 'tipsLeft' : 'tipsRight');
      return out;
    }

    case 'algebraTiles': {
      const a = whole(tool.terms.x2, 0, 6);
      const b = whole(tool.terms.x, 0, 20);
      const c = whole(tool.terms.one, 0, 30);
      if (a === null || b === null || c === null) return EMPTY;
      const X = 4; // an x-tile is X units long and 1 unit wide: its length is not a whole number of units
      const poly = polyText(a, b, c);
      const f = factorTiles(a, b, c);
      const tile = (x: number, y: number, w: number, h: number, kind: 'x2' | 'x' | 'one', u: number) => {
        out.prims.push({ t: 'rect', x, y, w, h, tone: kind === 'x2' ? 'curve1' : kind === 'x' ? 'curve2' : 'accent', fill: 'medium' });
        if (show('labels') && Math.min(w, h) >= 12) txt(x + w / 2, y + h / 2 + 4, kind === 'x2' ? 'x²' : kind === 'x' ? 'x' : '1', 'middle', Math.min(14, Math.max(10, u)), 'axis', true);
      };
      if (f) {
        const widths = [...Array.from({ length: f.m }, () => X), ...Array.from({ length: f.p }, () => 1)];
        const heights = [...Array.from({ length: f.n }, () => X), ...Array.from({ length: f.q }, () => 1)];
        const Wu = widths.reduce((s, v) => s + v, 0);
        const Hu = heights.reduce((s, v) => s + v, 0);
        const u = Math.min(280 / Wu, 210 / Hu, 28);
        const x0 = (400 - Wu * u) / 2;
        const y0 = (300 - Hu * u) / 2 + 10;
        let yy = y0;
        heights.forEach((h) => {
          let xx = x0;
          widths.forEach((w) => {
            tile(xx, yy, w * u, h * u, w === X && h === X ? 'x2' : w === X || h === X ? 'x' : 'one', u);
            xx += w * u;
          });
          yy += h * u;
        });
        if (show('labels')) {
          txt(x0 + (Wu * u) / 2, y0 - 10, side(f.m, f.p).slice(1, -1), 'middle', 13, 'axis', true);
          txt(x0 - 8, y0 + (Hu * u) / 2 + 4, side(f.n, f.q).slice(1, -1), 'end', 13, 'axis', true);
        }
        const sides = `${side(f.m, f.p)}${side(f.n, f.q)}`;
        say(tool.mode === 'expand' ? 'expand' : 'factor', { poly, sides });
      } else {
        // No rectangle: the tiles lie in a pile, in rows.
        const u = 10;
        const items: ('x2' | 'x' | 'one')[] = [...Array.from({ length: a }, () => 'x2' as const), ...Array.from({ length: b }, () => 'x' as const), ...Array.from({ length: c }, () => 'one' as const)];
        let xx = 20;
        let yy = 40;
        let rowH = 0;
        items.forEach((kind) => {
          const w = kind === 'x2' ? X * u : kind === 'x' ? X * u : u;
          const h = kind === 'x2' ? X * u : u;
          if (xx + w > 380) {
            xx = 20;
            yy += rowH + 8;
            rowH = 0;
          }
          tile(xx, yy, w, h, kind, u);
          xx += w + 6;
          rowH = Math.max(rowH, h);
        });
        say('noRectangle', { poly });
      }
      return out;
    }

    case 'functionMachine': {
      const input = num(tool.input);
      if (!finite(input)) return EMPTY;
      const f = program.fn(tool.rule, 'x', scope);
      const result = f(input);
      const showRule = tool.showRule && show('rule');
      out.prims.push({ t: 'rect', x: 30, y: 120, w: 80, h: 60, tone: 'curve1', fill: 'light' });
      out.prims.push({ t: 'rect', x: 140, y: 70, w: 120, h: 160, tone: 'axis', fill: 'light' });
      out.prims.push({ t: 'rect', x: 290, y: 120, w: 80, h: 60, tone: 'curve2', fill: 'light' });
      for (const [x1, x2] of [[110, 138], [260, 288]] as const) {
        out.prims.push({ t: 'line', x1, y1: 150, x2, y2: 150, tone: 'axis', width: 2 });
        out.prims.push({ t: 'line', x1: x2 - 7, y1: 144, x2, y2: 150, tone: 'axis', width: 2 });
        out.prims.push({ t: 'line', x1: x2 - 7, y1: 156, x2, y2: 150, tone: 'axis', width: 2 });
      }
      txt(70, 156, fmt(input, 2), 'middle', 18, 'axis', true);
      txt(330, 156, finite(result) ? fmt(result, 2) : '—', 'middle', 18, 'axis', true);
      txt(70, 112, 'x', 'middle', 13, 'muted');
      txt(330, 112, 'f(x)', 'middle', 13, 'muted');
      txt(200, 155, showRule ? tool.rule.slice(0, 18) : '?', 'middle', showRule ? 15 : 28, 'axis', true);
      if (finite(result)) say('machine', { input: fmt(input, 2), output: fmt(result, 2) });
      else say('machineUndefined', { input: fmt(input, 2) });
      if (showRule) say('rule', { rule: tool.rule });
      return out;
    }

    case 'stepSolver': {
      const n = tool.lines.length;
      if (n < 1) return EMPTY;
      const raw = scope[tool.reveal];
      const revealed = typeof raw === 'number' && finite(raw) ? clamp(Math.round(raw), 1, n) : 1;
      out.solver = { variable: tool.variable, solution: tool.solution, revealed, lines: tool.lines.map((l) => ({ latex: l.latex, note: l.note })), notes: show('notes') };
      return out;
    }
  }
}
