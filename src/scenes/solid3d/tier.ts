// Which way a 3D picture is drawn on this device (AD-13). Tier A is three.js; Tier B is the light 2D
// picture a visitor asks for (or is offered when A is slow); Tier C is the same flat picture with the
// plain message, for a device with no WebGL or a lost graphics context. Nothing here loads three.js.

export type Tier = 'A' | 'B' | 'C';

/** Tier A is offered a light picture after this long without a first frame. */
export const OFFER_AFTER_MS = 8000;

/** The one stored choice (docs: essential storage, "the 3D tier choice"). */
export const TIER_KEY = 'vm.tier';

/** three.js needs WebGL 2 for Tier A; a device without it gets Tier C (browserslist note in AD-30). */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    // Give the context back at once: a phone has very few, and the real canvas needs one.
    (gl as WebGL2RenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function lightChosen(): boolean {
  try {
    return window.localStorage.getItem(TIER_KEY) === 'light';
  } catch {
    return false; // storage blocked: the choice lasts for the visit only
  }
}

export function rememberLight(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(TIER_KEY, 'light');
    else window.localStorage.removeItem(TIER_KEY);
  } catch {
    // blocked storage is fine
  }
}
