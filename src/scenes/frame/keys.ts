import { STEPS, type Capabilities, type ViewAction } from './camera';

// The keyboard model of the scene frame (EXPERIENCE "Interaction Primitives", NFR-3.1): arrows turn
// by 5 degrees (15 with Shift), + and - zoom, 0 resets, Esc moves to the toolbar, and Tab is never
// handled, so focus can always leave. Arrow keys are NOT mirrored in right-to-left languages.

export interface KeyLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export type KeyResult = { kind: 'view'; action: ViewAction } | { kind: 'escape' } | null;

/** What a key does in the frame, or null when the frame must leave it alone (so the browser keeps it). */
export function keyAction(e: KeyLike, caps: Capabilities): KeyResult {
  // Browser shortcuts (Ctrl +, Ctrl 0, Alt Left for back) stay the browser's.
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const big = e.shiftKey === true;
  switch (e.key) {
    case 'Escape':
      return { kind: 'escape' };
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      const sign = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
      const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (caps.rotate) {
        const step = big ? STEPS.bigTurn : STEPS.turn;
        // Right turns the azimuth up and Up turns the elevation up, in every language.
        return { kind: 'view', action: { type: 'rotate', dAzimuth: horizontal ? sign * step : 0, dElevation: horizontal ? 0 : sign * step } };
      }
      if (caps.pan) {
        const step = big ? STEPS.bigPan : STEPS.pan;
        // A scene that cannot turn moves the picture the way the arrow points.
        return { kind: 'view', action: { type: 'pan', dx: horizontal ? sign * step : 0, dy: horizontal ? 0 : -sign * step } };
      }
      return null;
    }
    case '+':
    case '=':
      return caps.zoom ? { kind: 'view', action: { type: 'zoom', factor: STEPS.zoom } } : null;
    case '-':
    case '_':
      return caps.zoom ? { kind: 'view', action: { type: 'zoom', factor: 1 / STEPS.zoom } } : null;
    case '0':
      return { kind: 'view', action: { type: 'reset' } };
    default:
      return null; // Tab and everything else
  }
}
