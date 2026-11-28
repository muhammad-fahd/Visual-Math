import type { Program, Scope } from '../params';
import { basis, cross, dot, length } from '../solid/clip';
import type { Vec3 } from '../solid/kinds';

// The drawing model of a `space3d@1` scene at one set of parameter values (Story 4.1, FR-3.22): the geometry of every
// element as plain segments, patches, marks and labels, plus the numbers behind them as `facts`. Both renderers (three.js
// and SVG) draw this one model through the same projection, and the viewer turns the facts into the readout and the
// text, so the tiers and the words cannot disagree. Pure; every number goes through `lib/expr` (the `program`).
//
// Coordinates. The author writes math coordinates (x, y, z with z up). The model's geometry is in the picture's
// coordinates (x right, y up, depth toward the viewer), which is the same right-handed system turned: math (x, y, z) is
// drawn at (y, z, x), so a cross product that is right-handed in the numbers is right-handed on the screen. The facts
// keep the math coordinates.

type Num = number | string;
type Src3 = readonly [Num, Num, Num];
export type Label = { latex: string } | { text: Record<string, string> };

export type SpaceElement =
  | { type: 'point'; id: string; at: Src3; label?: Label }
  | { type: 'vector'; id: string; from?: Src3; to: Src3; label?: Label }
  | { type: 'op'; id: string; op: 'add' | 'scale' | 'cross'; of: string[]; k?: Num; label?: Label }
  | { type: 'dot'; id: string; a: string; b: string; label?: Label }
  | { type: 'line'; id: string; point: Src3; direction: Src3; label?: Label }
  | { type: 'plane'; id: string; normal: Src3; d: Num; label?: Label };

export interface SpaceSceneLike {
  range?: Num;
  elements: SpaceElement[];
}

export type SpaceToken = 'curve1' | 'curve2' | 'section' | 'accent' | 'axis' | 'grid' | 'edge';
export type Dash = 'solid' | 'dashed' | 'dotted';

export interface Seg {
  id: string;
  a: Vec3;
  b: Vec3;
  token: SpaceToken;
  dash: Dash;
  /** 1 thin, 2 the thing itself. */
  weight: 1 | 2;
}
export interface Patch {
  id: string;
  points: Vec3[];
  token: SpaceToken;
  opacity: number;
}
export interface Mark {
  id: string;
  at: Vec3;
  token: SpaceToken;
}
export interface Tag {
  id: string;
  at: Vec3;
  text: string;
}

export type Fact =
  | { kind: 'point'; id: string; label: string; at: Vec3 }
  | { kind: 'vector'; id: string; label: string; v: Vec3; length: number }
  | { kind: 'add'; id: string; label: string; parts: string[]; v: Vec3; length: number }
  | { kind: 'scale'; id: string; label: string; of: string; k: number; v: Vec3; length: number }
  | { kind: 'cross'; id: string; label: string; of: [string, string]; v: Vec3; length: number; parallel: boolean }
  | { kind: 'dot'; id: string; label: string; of: [string, string]; value: number; angle: number | null }
  | { kind: 'line'; id: string; label: string; point: Vec3; direction: Vec3; inside: boolean }
  | { kind: 'plane'; id: string; label: string; normal: Vec3; d: number; inside: boolean }
  | { kind: 'skipped'; id: string; label: string; reason: 'missing' | 'zero' | 'notFinite' };

export interface SpaceModel {
  /** Half the side of the axes box. */
  range: number;
  /** The radius the picture is fitted to: the box's corner. */
  fit: number;
  segments: Seg[];
  patches: Patch[];
  marks: Mark[];
  tags: Tag[];
  facts: Fact[];
}

export const DEFAULT_RANGE = 6;
const MAX_RANGE = 50;
/** Nothing is drawn farther than this many ranges from the origin, so a huge value cannot reach the renderer. */
const REACH = 50;

/** How each element looks, by its order in the scene: color and line, so two never differ by color alone. */
const LOOKS: readonly { token: SpaceToken; dash: Dash }[] = [
  { token: 'curve1', dash: 'solid' },
  { token: 'curve2', dash: 'solid' },
  { token: 'section', dash: 'solid' },
  { token: 'accent', dash: 'solid' },
  { token: 'curve1', dash: 'dashed' },
  { token: 'curve2', dash: 'dashed' },
  { token: 'section', dash: 'dashed' },
  { token: 'accent', dash: 'dashed' },
];

/** Math coordinates to the picture's. */
export const toScene = (p: Vec3): Vec3 => [p[1], p[2], p[0]];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const ORIGIN: Vec3 = [0, 0, 0];

export interface BuildInput {
  scene: SpaceSceneLike;
  program: Program;
  scope: Scope;
  /** Parts a step has hidden: element ids and `axes`, `grid`, `box`. */
  hidden?: ReadonlySet<string>;
  /** The name of an element: its label in the visitor's language, else its id. */
  labelOf: (label: Label | undefined, id: string) => string;
}

export function buildSpace({ scene, program, scope, hidden, labelOf }: BuildInput): SpaceModel {
  const num = (v: Num | undefined) => program.evaluate(v ?? NaN, scope);
  const rawRange = num(scene.range ?? DEFAULT_RANGE);
  const range = Number.isFinite(rawRange) ? Math.min(MAX_RANGE, Math.max(1, rawRange)) : DEFAULT_RANGE;
  const reach = range * REACH;
  const clamp = (x: number) => Math.min(reach, Math.max(-reach, x));
  const finite3 = (v: Vec3) => v.every(Number.isFinite);
  const vec = (src: Src3 | undefined, fallback?: Vec3): Vec3 | null => {
    if (!src) return fallback ?? null;
    const v: Vec3 = [num(src[0]), num(src[1]), num(src[2])];
    return finite3(v) ? ([clamp(v[0]), clamp(v[1]), clamp(v[2])] as Vec3) : null;
  };
  const shown = (id: string) => !hidden?.has(id);

  const segments: Seg[] = [];
  const patches: Patch[] = [];
  const marks: Mark[] = [];
  const tags: Tag[] = [];
  const facts: Fact[] = [];

  const seg = (id: string, a: Vec3, b: Vec3, token: SpaceToken, dash: Dash, weight: 1 | 2) => segments.push({ id, a: toScene(a), b: toScene(b), token, dash, weight });
  const tag = (id: string, at: Vec3, text: string) => tags.push({ id, at: toScene(at), text });

  /** A segment with an arrowhead at `b`: four short barbs, so the head reads from every side. */
  function arrow(id: string, a: Vec3, b: Vec3, token: SpaceToken, dash: Dash, weight: 1 | 2) {
    seg(id, a, b, token, dash, weight);
    const d = sub(toScene(b), toScene(a));
    const len = length(d);
    if (len < 1e-9) return;
    const head = Math.min(len * 0.3, range * 0.14);
    const unit = mul(d, 1 / len);
    const { u, v } = basis(unit);
    const tip = toScene(b);
    const base = sub(tip, mul(unit, head));
    for (const side of [u, mul(u, -1), v, mul(v, -1)]) {
      const barb = add(base, mul(side, head * 0.4));
      segments.push({ id, a: tip, b: barb, token, dash: 'solid', weight });
    }
  }

  // ---- fixed parts ----
  if (shown('grid')) {
    const step = range <= 12 ? 1 : Math.ceil(range / 12);
    const last = Math.floor(range / step) * step;
    for (let i = -last; i <= last; i += step) {
      seg('grid', [i, -range, 0], [i, range, 0], 'grid', 'solid', 1);
      seg('grid', [-range, i, 0], [range, i, 0], 'grid', 'solid', 1);
    }
  }
  if (shown('box')) {
    const corner = (i: number): Vec3 => [i & 1 ? range : -range, i & 2 ? range : -range, i & 4 ? range : -range];
    for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) seg('box', corner(i), corner(i | bit), 'edge', 'dotted', 1);
  }
  if (shown('axes')) {
    const names = ['x', 'y', 'z'] as const;
    names.forEach((name, i) => {
      const on = (value: number): Vec3 => (i === 0 ? [value, 0, 0] : i === 1 ? [0, value, 0] : [0, 0, value]);
      arrow('axes', on(-range), on(range), 'axis', 'solid', 1);
      tag('axes', on(range * 1.1), name);
    });
  }

  // ---- the elements, in order ----
  interface Resolved {
    from: Vec3;
    d: Vec3;
    label: string;
  }
  const resolved = new Map<string, Resolved>();
  const skip = (id: string, label: string, reason: 'missing' | 'zero' | 'notFinite') => facts.push({ kind: 'skipped', id, label, reason });

  scene.elements.forEach((el, index) => {
    const look = LOOKS[index % LOOKS.length]!;
    const label = labelOf(el.label, el.id);
    const visible = shown(el.id);
    const draw = <T,>(fn: () => T): T | undefined => (visible ? fn() : undefined);
    // A hidden element is still computed (another element may build on it) but not drawn, listed or read out.
    const fact = (f: Fact) => {
      if (visible) facts.push(f);
    };
    const bail = (reason: 'missing' | 'zero' | 'notFinite') => {
      if (visible) skip(el.id, label, reason);
    };

    switch (el.type) {
      case 'point': {
        const at = vec(el.at);
        if (!at) return bail('notFinite');
        draw(() => {
          marks.push({ id: el.id, at: toScene(at), token: look.token });
          tag(el.id, at, label);
        });
        fact({ kind: 'point', id: el.id, label, at });
        return;
      }
      case 'vector': {
        const from = vec(el.from, ORIGIN);
        const to = vec(el.to);
        if (!from || !to) return bail('notFinite');
        const d = sub(to, from);
        resolved.set(el.id, { from, d, label });
        draw(() => {
          arrow(el.id, from, to, look.token, look.dash, 2);
          tag(el.id, to, label);
        });
        fact({ kind: 'vector', id: el.id, label, v: d, length: length(d) });
        return;
      }
      case 'op': {
        const parts = el.of.map((id) => resolved.get(id));
        if (parts.some((p) => !p)) return bail('missing');
        const ps = parts as Resolved[];
        if (el.op === 'add') {
          if (ps.length < 2) return bail('missing');
          let cursor = ORIGIN;
          for (const p of ps) {
            const next = add(cursor, p.d);
            draw(() => arrow(el.id, cursor, next, look.token, 'dashed', 1));
            cursor = next;
          }
          const total = cursor;
          resolved.set(el.id, { from: ORIGIN, d: total, label });
          draw(() => {
            arrow(el.id, ORIGIN, total, look.token, 'solid', 2);
            tag(el.id, total, label);
          });
          fact({ kind: 'add', id: el.id, label, parts: ps.map((p) => p.label), v: total, length: length(total) });
          return;
        }
        if (el.op === 'scale') {
          const source = ps[0];
          const k = num(el.k);
          if (!source || !Number.isFinite(k)) return bail('notFinite');
          const d = mul(source.d, k);
          const to = add(source.from, d);
          resolved.set(el.id, { from: source.from, d, label });
          draw(() => {
            if (length(d) > 1e-9) arrow(el.id, source.from, to, look.token, look.dash, 2);
            tag(el.id, to, label);
          });
          fact({ kind: 'scale', id: el.id, label, of: source.label, k, v: d, length: length(d) });
          return;
        }
        // cross
        const [a, b] = ps;
        if (!a || !b) return bail('missing');
        const c = cross(a.d, b.d);
        const lc = length(c);
        const parallel = lc <= 1e-9 * Math.max(1, length(a.d) * length(b.d));
        const result: Vec3 = parallel ? ORIGIN : c;
        resolved.set(el.id, { from: ORIGIN, d: result, label });
        draw(() => {
          if (!parallel) {
            arrow(el.id, ORIGIN, result, look.token, look.dash, 2);
            tag(el.id, result, label);
          }
        });
        fact({ kind: 'cross', id: el.id, label, of: [a.label, b.label], v: result, length: parallel ? 0 : lc, parallel });
        return;
      }
      case 'dot': {
        const a = resolved.get(el.a);
        const b = resolved.get(el.b);
        if (!a || !b) return bail('missing');
        const value = dot(a.d, b.d);
        const la = length(a.d);
        const lb = length(b.d);
        const angle = la > 1e-9 && lb > 1e-9 ? (Math.acos(Math.min(1, Math.max(-1, value / (la * lb)))) * 180) / Math.PI : null;
        draw(() => {
          if (lb > 1e-9) {
            const foot = add(a.from, mul(b.d, value / (lb * lb)));
            if (length(sub(foot, a.from)) > 1e-9) arrow(el.id, a.from, foot, look.token, 'dashed', 2);
            seg(el.id, add(a.from, a.d), foot, look.token, 'dotted', 1);
            tag(el.id, foot, label);
          }
        });
        fact({ kind: 'dot', id: el.id, label, of: [a.label, b.label], value, angle });
        return;
      }
      case 'line': {
        const p = vec(el.point);
        const dir = vec(el.direction);
        if (!p || !dir) return bail('notFinite');
        if (length(dir) < 1e-9) return bail('zero');
        const t = clipLine(p, dir, range);
        draw(() => {
          if (!t) return;
          const a = add(p, mul(dir, t[0]));
          const b = add(p, mul(dir, t[1]));
          seg(el.id, a, b, look.token, look.dash, 2);
          if (p.every((x) => Math.abs(x) <= range)) marks.push({ id: el.id, at: toScene(p), token: look.token });
          tag(el.id, b, label);
        });
        fact({ kind: 'line', id: el.id, label, point: p, direction: dir, inside: t !== null });
        return;
      }
      case 'plane': {
        const n = vec(el.normal);
        const d = num(el.d);
        if (!n || !Number.isFinite(d)) return bail('notFinite');
        const ln = length(n);
        if (ln < 1e-9) return bail('zero');
        const poly = planeInBox(n, d, range);
        draw(() => {
          if (!poly) return;
          patches.push({ id: el.id, points: poly.map(toScene), token: look.token, opacity: 0.22 });
          for (let i = 0; i < poly.length; i++) seg(el.id, poly[i]!, poly[(i + 1) % poly.length]!, look.token, look.dash, 1);
          const centre = poly.reduce((s, q) => add(s, q), ORIGIN as Vec3);
          const foot = mul(centre, 1 / poly.length);
          const tip = add(foot, mul(n, (range * 0.45) / ln));
          arrow(el.id, foot, tip, look.token, 'solid', 2);
          tag(el.id, tip, label);
        });
        fact({ kind: 'plane', id: el.id, label, normal: n, d, inside: poly !== null });
        return;
      }
    }
  });

  return { range, fit: range * Math.sqrt(3), segments, patches, marks, tags, facts };
}

/** The part of the line `p + t * dir` inside the box `[-r, r]^3`, as `[t0, t1]`; null if it misses the box. */
export function clipLine(p: Vec3, dir: Vec3, r: number): [number, number] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]!) < 1e-12) {
      if (Math.abs(p[i]!) > r) return null;
      continue;
    }
    const a = (-r - p[i]!) / dir[i]!;
    const b = (r - p[i]!) / dir[i]!;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t0 <= t1 && Number.isFinite(t0) && Number.isFinite(t1) ? [t0, t1] : null;
}

/** The polygon where the plane `n . x = d` meets the box `[-r, r]^3`, ordered around its middle; null if it misses. */
export function planeInBox(n: Vec3, d: number, r: number): Vec3[] | null {
  const hits: Vec3[] = [];
  const corners: Vec3[] = [];
  for (let i = 0; i < 8; i++) corners.push([i & 1 ? r : -r, i & 2 ? r : -r, i & 4 ? r : -r]);
  const side = corners.map((c) => dot(n, c) - d);
  const eps = 1e-9 * Math.max(1, Math.abs(d), r * length(n));
  for (let i = 0; i < 8; i++) {
    for (const bit of [1, 2, 4]) {
      if (i & bit) continue;
      const j = i | bit;
      const si = side[i]!;
      const sj = side[j]!;
      if (Math.abs(si) <= eps) hits.push(corners[i]!);
      if ((si < -eps && sj > eps) || (si > eps && sj < -eps)) {
        const t = si / (si - sj);
        hits.push(add(corners[i]!, mul(sub(corners[j]!, corners[i]!), t)));
      }
      if (Math.abs(sj) <= eps && !(i & bit)) hits.push(corners[j]!);
    }
  }
  // The same point can come from two edges (a corner on the plane): keep one.
  const unique: Vec3[] = [];
  for (const h of hits) if (!unique.some((u) => length(sub(u, h)) < 1e-7 * Math.max(1, r))) unique.push(h);
  if (unique.length < 3) return null;
  const centre = mul(unique.reduce((s, q) => add(s, q), ORIGIN as Vec3), 1 / unique.length);
  const { u, v } = basis(n);
  const angle = (q: Vec3) => Math.atan2(dot(sub(q, centre), v), dot(sub(q, centre), u));
  return unique.sort((a, b) => angle(a) - angle(b));
}
