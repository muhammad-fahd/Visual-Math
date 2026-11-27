// The view model of every scene (AD-15): what the visitor can change by turning, zooming and moving the
// picture. Pure and framework-free. Camera moves are instant (no easing), so reduced motion needs no
// special case here.

export interface View {
  /** Degrees, 0 up to but not including 360. */
  azimuth: number;
  /** Degrees, -90 to 90. */
  elevation: number;
  /** 1 at the topic's start view; 0.25 to 8. Above 1 is zoomed in. */
  scale: number;
  /** Fractions of the frame's width and height, -1 to 1. Positive moves the picture right and down. */
  panX: number;
  panY: number;
}

export interface Capabilities {
  /** 3D scenes turn; a 2D scene has nothing to rotate. */
  rotate: boolean;
  zoom: boolean;
  pan: boolean;
}

export const LIMITS = { minScale: 0.25, maxScale: 8, minElevation: -90, maxElevation: 90, maxPan: 1 } as const;

/** What the keys, the wheel and the buttons use: a zoom step is x1.25, a turn is 5 degrees (15 with Shift). */
export const STEPS = { zoom: 1.25, turn: 5, bigTurn: 15, pan: 0.05, bigPan: 0.15 } as const;

export type Preset = 'iso' | 'front' | 'top' | 'side';

const PRESETS: Record<Preset, { azimuth: number; elevation: number }> = {
  iso: { azimuth: 45, elevation: 30 },
  front: { azimuth: 0, elevation: 0 },
  top: { azimuth: 0, elevation: 90 },
  side: { azimuth: 90, elevation: 0 },
};

export type Camera = { azimuth: number; elevation: number } | { preset: Preset };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const wrap360 = (a: number) => ((a % 360) + 360) % 360;

/** A view made safe: angles wrapped or clamped, scale and pan within limits, anything not finite replaced. */
export function normalize(view: Partial<View>): View {
  return {
    azimuth: finite(view.azimuth) ? wrap360(view.azimuth) : 0,
    elevation: finite(view.elevation) ? clamp(view.elevation, LIMITS.minElevation, LIMITS.maxElevation) : 0,
    scale: finite(view.scale) ? clamp(view.scale, LIMITS.minScale, LIMITS.maxScale) : 1,
    panX: finite(view.panX) ? clamp(view.panX, -LIMITS.maxPan, LIMITS.maxPan) : 0,
    panY: finite(view.panY) ? clamp(view.panY, -LIMITS.maxPan, LIMITS.maxPan) : 0,
  };
}

/** The topic's start view from its `camera` field (topic-format 2.1 rule 5); an iso view when there is none. */
export function startView(camera?: Camera): View {
  const base = camera == null || typeof camera !== 'object' ? PRESETS.iso : 'preset' in camera ? (PRESETS[camera.preset] ?? PRESETS.iso) : camera;
  return normalize({ azimuth: base.azimuth, elevation: base.elevation, scale: 1, panX: 0, panY: 0 });
}

export type ViewAction =
  | { type: 'rotate'; dAzimuth: number; dElevation: number }
  | { type: 'zoom'; factor: number }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'reset' }
  | { type: 'set'; view: Partial<View> };

/** The one place a view changes. Non-finite input is ignored; a capability that is off ignores its action. */
export function reduceView(view: View, action: ViewAction, start: View, caps: Capabilities): View {
  switch (action.type) {
    case 'rotate':
      if (!caps.rotate || !finite(action.dAzimuth) || !finite(action.dElevation)) return view;
      return keep(view, normalize({ ...view, azimuth: view.azimuth + action.dAzimuth, elevation: view.elevation + action.dElevation }));
    case 'zoom':
      if (!caps.zoom || !finite(action.factor) || action.factor <= 0) return view;
      return keep(view, normalize({ ...view, scale: view.scale * action.factor }));
    case 'pan':
      if (!caps.pan || !finite(action.dx) || !finite(action.dy)) return view;
      return keep(view, normalize({ ...view, panX: view.panX + action.dx, panY: view.panY + action.dy }));
    case 'reset':
      return start;
    case 'set': {
      // An explicit undefined must not erase the current value.
      const given = Object.fromEntries(Object.entries(action.view).filter(([, v]) => v !== undefined));
      return keep(view, normalize({ ...view, ...given }));
    }
  }
}

/** The same object when nothing changed, so a no-op (a zoom at its limit, a wheel of 0) causes no re-render. */
function keep(before: View, after: View): View {
  return sameView(before, after) ? before : after;
}

export const sameView = (a: View, b: View): boolean => a.azimuth === b.azimuth && a.elevation === b.elevation && a.scale === b.scale && a.panX === b.panX && a.panY === b.panY;
