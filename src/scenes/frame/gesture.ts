import type { Capabilities, ViewAction } from './camera';

// Pointer gestures of the scene frame (FR-3.1 to 3.4), as a pure interpreter: the component feeds it
// pointer events, it answers with view actions. One pointer turns (or moves a scene that cannot turn),
// the right button moves, two pointers pinch and move. Sizes are the frame's, so pan is a fraction.

const DEG_PER_PX = 0.5;
const WHEEL_SPEED = 0.002;
const WHEEL_LINE = 16;
const WHEEL_PAGE = 100;

export interface Point {
  x: number;
  y: number;
}

export interface Pointer extends Point {
  /** 0 primary (left, touch, pen), 2 secondary. */
  button: number;
}

export type Gesture = ReadonlyMap<number, Pointer>;

export const gestureStart = (): Gesture => new Map();

export function down(g: Gesture, id: number, p: Pointer): Gesture {
  const next = new Map(g);
  next.set(id, p);
  return next;
}

/** A pointer that goes away: the ones that remain keep their own last position, so nothing jumps. */
export function up(g: Gesture, id: number): Gesture {
  if (!g.has(id)) return g;
  const next = new Map(g);
  next.delete(id);
  return next;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export interface Moved {
  gesture: Gesture;
  actions: ViewAction[];
}

/** One pointer moved to (x, y) in a frame of `width` by `height` pixels. */
export function move(g: Gesture, id: number, to: Point, size: { width: number; height: number }, caps: Capabilities): Moved {
  const before = g.get(id);
  if (!before || ![to.x, to.y, size.width, size.height].every(Number.isFinite) || size.width <= 0 || size.height <= 0) return { gesture: g, actions: [] };
  const after: Pointer = { x: to.x, y: to.y, button: before.button };
  const next = new Map(g);
  next.set(id, after);
  const actions: ViewAction[] = [];

  if (g.size === 1) {
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    if (before.button === 2) {
      if (caps.pan) actions.push({ type: 'pan', dx: dx / size.width, dy: dy / size.height });
    } else if (caps.rotate) {
      actions.push({ type: 'rotate', dAzimuth: -dx * DEG_PER_PX, dElevation: dy * DEG_PER_PX });
    } else if (caps.pan) {
      actions.push({ type: 'pan', dx: dx / size.width, dy: dy / size.height });
    }
  } else if (g.size === 2) {
    const other = [...g.entries()].find(([k]) => k !== id)?.[1];
    if (other) {
      const d0 = dist(before, other);
      const d1 = dist(after, other);
      if (caps.zoom && d0 > 0 && d1 > 0) actions.push({ type: 'zoom', factor: d1 / d0 });
      const m0 = mid(before, other);
      const m1 = mid(after, other);
      if (caps.pan) actions.push({ type: 'pan', dx: (m1.x - m0.x) / size.width, dy: (m1.y - m0.y) / size.height });
    }
  }
  return { gesture: next, actions };
}

/** The zoom a wheel event asks for. Up (negative deltaY) zooms in; one event is limited to a factor of 2. */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  if (!Number.isFinite(deltaY)) return 1;
  const px = deltaMode === 1 ? deltaY * WHEEL_LINE : deltaMode === 2 ? deltaY * WHEEL_PAGE : deltaY;
  return Math.min(2, Math.max(0.5, Math.exp(-px * WHEEL_SPEED)));
}
