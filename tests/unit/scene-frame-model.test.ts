import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS, STEPS, normalize, reduceView, sameView, startView, type Capabilities, type View, type ViewAction } from '../../src/scenes/frame';
import { createAnnouncer } from '../../src/scenes/frame/announce';
import { down, gestureStart, move, up, wheelFactor } from '../../src/scenes/frame/gesture';
import { HINT_KEY, dismissHint, hintDismissed, type KeyValueStore } from '../../src/scenes/frame/hint';
import { keyAction } from '../../src/scenes/frame/keys';

const ALL: Capabilities = { rotate: true, zoom: true, pan: true };
const start = startView();
const run = (v: View, a: ViewAction, caps = ALL) => reduceView(v, a, start, caps);

describe('start views (topic-format 2.1 rule 5)', () => {
  it('presets', () => {
    expect(startView({ preset: 'iso' })).toEqual({ azimuth: 45, elevation: 30, scale: 1, panX: 0, panY: 0 });
    expect(startView({ preset: 'front' })).toEqual({ azimuth: 0, elevation: 0, scale: 1, panX: 0, panY: 0 });
    expect(startView({ preset: 'top' })).toMatchObject({ azimuth: 0, elevation: 90 });
    expect(startView({ preset: 'side' })).toMatchObject({ azimuth: 90, elevation: 0 });
  });
  it('an explicit camera, wrapped and clamped; no camera is iso; an unknown preset is iso', () => {
    expect(startView({ azimuth: 400, elevation: 120 })).toMatchObject({ azimuth: 40, elevation: 90 });
    expect(startView({ azimuth: -30, elevation: -200 })).toMatchObject({ azimuth: 330, elevation: -90 });
    expect(startView()).toEqual(startView({ preset: 'iso' }));
    expect(startView({ preset: 'nope' as never })).toEqual(startView({ preset: 'iso' }));
  });
});

describe('the view reducer (FR-3.1 to 3.4)', () => {
  it('rotate adds, wraps the azimuth, clamps the elevation at the poles', () => {
    expect(run(start, { type: 'rotate', dAzimuth: 10, dElevation: 5 })).toMatchObject({ azimuth: 55, elevation: 35 });
    expect(run(start, { type: 'rotate', dAzimuth: 330, dElevation: 0 }).azimuth).toBe(15);
    expect(run(start, { type: 'rotate', dAzimuth: -50, dElevation: 0 }).azimuth).toBe(355);
    expect(run(start, { type: 'rotate', dAzimuth: 0, dElevation: 500 }).elevation).toBe(90);
    expect(run(start, { type: 'rotate', dAzimuth: 0, dElevation: -500 }).elevation).toBe(-90);
  });
  it('zoom multiplies the scale and stays within 0.25 to 8', () => {
    expect(run(start, { type: 'zoom', factor: 2 }).scale).toBe(2);
    let v = start;
    for (let i = 0; i < 50; i++) v = run(v, { type: 'zoom', factor: 1.25 });
    expect(v.scale).toBe(LIMITS.maxScale);
    for (let i = 0; i < 80; i++) v = run(v, { type: 'zoom', factor: 0.8 });
    expect(v.scale).toBe(LIMITS.minScale);
  });
  it('pan adds and stays within +-1', () => {
    expect(run(start, { type: 'pan', dx: 0.25, dy: -0.5 })).toMatchObject({ panX: 0.25, panY: -0.5 });
    expect(run(start, { type: 'pan', dx: 5, dy: -5 })).toMatchObject({ panX: 1, panY: -1 });
  });
  it('reset is exactly the start view', () => {
    let v = run(start, { type: 'rotate', dAzimuth: 77, dElevation: -40 });
    v = run(v, { type: 'zoom', factor: 3 });
    v = run(v, { type: 'pan', dx: 0.3, dy: 0.3 });
    expect(sameView(v, start)).toBe(false);
    expect(run(v, { type: 'reset' })).toEqual(start);
    expect(run(v, { type: 'reset' })).toBe(start);
  });
  it('a capability that is off ignores its action', () => {
    const flat: Capabilities = { rotate: false, zoom: true, pan: true };
    expect(run(start, { type: 'rotate', dAzimuth: 20, dElevation: 20 }, flat)).toBe(start);
    expect(run(start, { type: 'zoom', factor: 2 }, { ...ALL, zoom: false })).toBe(start);
    expect(run(start, { type: 'pan', dx: 0.2, dy: 0 }, { ...ALL, pan: false })).toBe(start);
  });
  it('non-finite or nonsense input is ignored, never a NaN in the view', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(run(start, { type: 'rotate', dAzimuth: bad, dElevation: 0 })).toBe(start);
      expect(run(start, { type: 'zoom', factor: bad })).toBe(start);
      expect(run(start, { type: 'pan', dx: bad, dy: 0 })).toBe(start);
    }
    expect(run(start, { type: 'zoom', factor: 0 })).toBe(start);
    expect(run(start, { type: 'zoom', factor: -2 })).toBe(start);
  });
  it('set normalizes whatever it is given', () => {
    expect(run(start, { type: 'set', view: { azimuth: 725, scale: 100, panX: NaN, elevation: Infinity } })).toEqual({ azimuth: 5, elevation: 0, scale: 8, panX: 0, panY: 0 });
  });
  it('an explicit undefined in `set` keeps the current value', () => {
    const v = run(run(start, { type: 'rotate', dAzimuth: 20, dElevation: 0 }), { type: 'set', view: { azimuth: undefined, scale: 2 } });
    expect(v).toMatchObject({ azimuth: 65, scale: 2 });
  });
  it('a missing, null or odd camera falls back to the iso view instead of throwing', () => {
    for (const bad of [null, undefined, 5, 'iso', true]) expect(startView(bad as never)).toEqual(startView({ preset: 'iso' }));
  });
  it('a no-op returns the very same object (so nothing re-renders)', () => {
    const atMax = run(start, { type: 'zoom', factor: 1000 });
    expect(run(atMax, { type: 'zoom', factor: 2 })).toBe(atMax);
    expect(run(start, { type: 'zoom', factor: 1 })).toBe(start);
    expect(run(start, { type: 'rotate', dAzimuth: 0, dElevation: 0 })).toBe(start);
    expect(run(start, { type: 'pan', dx: 0, dy: 0 })).toBe(start);
    expect(run(start, { type: 'set', view: {} })).toBe(start);
    const atPole = run(start, { type: 'rotate', dAzimuth: 0, dElevation: 500 });
    expect(run(atPole, { type: 'rotate', dAzimuth: 0, dElevation: 10 })).toBe(atPole);
  });
  it('normalize repairs a view', () => {
    expect(normalize({})).toEqual({ azimuth: 0, elevation: 0, scale: 1, panX: 0, panY: 0 });
    expect(normalize({ azimuth: -720, scale: 0.0001, panY: 9 })).toMatchObject({ azimuth: 0, scale: 0.25, panY: 1 });
  });
  it('property: any sequence of actions leaves a valid view, and reset always returns the start', () => {
    const action: fc.Arbitrary<ViewAction> = fc.oneof(
      fc.record({ type: fc.constant('rotate' as const), dAzimuth: fc.double({ noNaN: false }), dElevation: fc.double() }),
      fc.record({ type: fc.constant('zoom' as const), factor: fc.double() }),
      fc.record({ type: fc.constant('pan' as const), dx: fc.double(), dy: fc.double() }),
      fc.constant({ type: 'reset' as const }),
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 40 }), (actions) => {
        let v = start;
        for (const a of actions) v = run(v, a);
        expect(v.azimuth).toBeGreaterThanOrEqual(0);
        expect(v.azimuth).toBeLessThan(360);
        expect(Math.abs(v.elevation)).toBeLessThanOrEqual(90);
        expect(v.scale).toBeGreaterThanOrEqual(LIMITS.minScale);
        expect(v.scale).toBeLessThanOrEqual(LIMITS.maxScale);
        expect(Math.abs(v.panX)).toBeLessThanOrEqual(1);
        expect(Math.abs(v.panY)).toBeLessThanOrEqual(1);
        expect(Object.values(v).every(Number.isFinite)).toBe(true);
        expect(run(v, { type: 'reset' })).toEqual(start);
      }),
      { numRuns: 500 },
    );
  });
});

describe('keyboard (NFR-3.1, EXPERIENCE)', () => {
  const key = (k: string, extra: object = {}) => keyAction({ key: k, ...extra }, ALL);
  it('arrows turn by 5 degrees, Shift by 15', () => {
    expect(key('ArrowRight')).toEqual({ kind: 'view', action: { type: 'rotate', dAzimuth: 5, dElevation: 0 } });
    expect(key('ArrowLeft')).toEqual({ kind: 'view', action: { type: 'rotate', dAzimuth: -5, dElevation: 0 } });
    expect(key('ArrowUp')).toEqual({ kind: 'view', action: { type: 'rotate', dAzimuth: 0, dElevation: 5 } });
    expect(key('ArrowDown')).toEqual({ kind: 'view', action: { type: 'rotate', dAzimuth: 0, dElevation: -5 } });
    expect(key('ArrowRight', { shiftKey: true })).toEqual({ kind: 'view', action: { type: 'rotate', dAzimuth: 15, dElevation: 0 } });
    expect(key('ArrowDown', { shiftKey: true })).toEqual({ kind: 'view', action: { type: 'rotate', dAzimuth: 0, dElevation: -15 } });
    expect(STEPS.turn).toBe(5);
    expect(STEPS.bigTurn).toBe(15);
  });
  it('the mapping has no language input: it is the same in Urdu (not flipped)', () => {
    // keyAction takes no direction: the page's dir cannot reach it. ArrowRight is +5 everywhere.
    expect(keyAction.length).toBe(2);
    expect(key('ArrowRight')).toMatchObject({ action: { dAzimuth: 5 } });
  });
  it('+ and = zoom in, - and _ zoom out, 0 resets', () => {
    expect(key('+')).toEqual({ kind: 'view', action: { type: 'zoom', factor: 1.25 } });
    expect(key('=')).toEqual({ kind: 'view', action: { type: 'zoom', factor: 1.25 } });
    expect(key('-')).toEqual({ kind: 'view', action: { type: 'zoom', factor: 0.8 } });
    expect(key('_')).toEqual({ kind: 'view', action: { type: 'zoom', factor: 0.8 } });
    expect(key('0')).toEqual({ kind: 'view', action: { type: 'reset' } });
  });
  it('Esc is the escape request; Tab and every other key are not handled (focus can always leave)', () => {
    expect(key('Escape')).toEqual({ kind: 'escape' });
    for (const k of ['Tab', 'Enter', ' ', 'a', 'Home', 'End', 'PageUp', 'PageDown', 'F5', 'Shift', 'Control', '1', '9', '*', '/']) expect(key(k), k).toBeNull();
    expect(key('Tab', { shiftKey: true })).toBeNull();
  });
  it('browser shortcuts with Ctrl, Alt or Meta are left alone', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey']) {
      for (const k of ['ArrowLeft', '+', '-', '0', 'Escape']) expect(key(k, { [mod]: true }), `${mod} ${k}`).toBeNull();
    }
  });
  it('a scene that cannot turn moves the picture with the arrows; one that cannot move or turn leaves them alone', () => {
    const flat = (k: string, shift = false) => keyAction({ key: k, shiftKey: shift }, { rotate: false, zoom: true, pan: true });
    expect(flat('ArrowRight')).toEqual({ kind: 'view', action: { type: 'pan', dx: 0.05, dy: 0 } });
    expect(flat('ArrowLeft', true)).toEqual({ kind: 'view', action: { type: 'pan', dx: -0.15, dy: 0 } });
    expect(flat('ArrowUp')).toEqual({ kind: 'view', action: { type: 'pan', dx: 0, dy: -0.05 } }); // up moves the picture up (panY down is positive)
    expect(flat('ArrowDown')).toEqual({ kind: 'view', action: { type: 'pan', dx: 0, dy: 0.05 } });
    expect(keyAction({ key: 'ArrowLeft' }, { rotate: false, zoom: true, pan: false })).toBeNull();
    expect(keyAction({ key: '+' }, { rotate: true, zoom: false, pan: true })).toBeNull();
    expect(keyAction({ key: '0' }, { rotate: false, zoom: false, pan: false })).toEqual({ kind: 'view', action: { type: 'reset' } });
  });
});

describe('pointer gestures (FR-3.1 to 3.4)', () => {
  const size = { width: 400, height: 300 };
  const at = (x: number, y: number, button = 0) => ({ x, y, button });
  it('one pointer turns: right lowers the azimuth, down raises the elevation, 0.5 degree per pixel', () => {
    let g = down(gestureStart(), 1, at(100, 100));
    const r = move(g, 1, { x: 200, y: 140 }, size, ALL);
    expect(r.actions).toEqual([{ type: 'rotate', dAzimuth: -50, dElevation: 20 }]);
    g = r.gesture;
    // The next move is relative to the last position, not the start.
    expect(move(g, 1, { x: 210, y: 140 }, size, ALL).actions).toEqual([{ type: 'rotate', dAzimuth: -5, dElevation: 0 }]);
  });
  it('the right button moves the picture, as a fraction of the frame', () => {
    const g = down(gestureStart(), 1, at(100, 100, 2));
    expect(move(g, 1, { x: 140, y: 130 }, size, ALL).actions).toEqual([{ type: 'pan', dx: 0.1, dy: 0.1 }]);
    expect(move(g, 1, { x: 140, y: 130 }, size, { ...ALL, pan: false }).actions).toEqual([]);
  });
  it('a scene that cannot turn: one pointer moves the picture', () => {
    const g = down(gestureStart(), 1, at(0, 0));
    expect(move(g, 1, { x: 40, y: 30 }, size, { rotate: false, zoom: true, pan: true }).actions).toEqual([{ type: 'pan', dx: 0.1, dy: 0.1 }]);
    expect(move(g, 1, { x: 40, y: 30 }, size, { rotate: false, zoom: true, pan: false }).actions).toEqual([]);
  });
  it('two pointers pinch (distance ratio) and move (midpoint)', () => {
    let g = down(down(gestureStart(), 1, at(100, 100)), 2, at(200, 100));
    const r = move(g, 2, { x: 300, y: 100 }, size, ALL); // the fingers move apart: 100 -> 200
    expect(r.actions[0]).toEqual({ type: 'zoom', factor: 2 });
    expect(r.actions[1]).toEqual({ type: 'pan', dx: 50 / 400, dy: 0 });
    g = r.gesture;
    expect(move(g, 2, { x: 250, y: 100 }, size, ALL).actions[0]).toEqual({ type: 'zoom', factor: 0.75 }) // 200 -> 150: relative to the last position;
  });
  it('two pointers on a zoom-only scene only zoom; on a pan-only scene only move', () => {
    const g = down(down(gestureStart(), 1, at(0, 0)), 2, at(100, 0));
    expect(move(g, 2, { x: 200, y: 0 }, size, { rotate: false, zoom: true, pan: false }).actions.map((a) => a.type)).toEqual(['zoom']);
    expect(move(g, 2, { x: 200, y: 0 }, size, { rotate: false, zoom: false, pan: true }).actions.map((a) => a.type)).toEqual(['pan']);
  });
  it('lifting one of two fingers does not jump: the remaining finger continues from where it is', () => {
    let g = down(down(gestureStart(), 1, at(100, 100)), 2, at(200, 100));
    g = move(g, 1, { x: 90, y: 100 }, size, ALL).gesture; // finger 1 is now at 90
    g = up(g, 2);
    expect(g.size).toBe(1);
    const r = move(g, 1, { x: 95, y: 100 }, size, ALL);
    expect(r.actions).toEqual([{ type: 'rotate', dAzimuth: -2.5, dElevation: 0 }]); // 5 px from where it was, not from its first position
  });
  it('a third pointer is tracked but adds no action; unknown ids and bad numbers do nothing', () => {
    const g = down(down(down(gestureStart(), 1, at(0, 0)), 2, at(10, 0)), 3, at(20, 0));
    expect(move(g, 3, { x: 30, y: 0 }, size, ALL).actions).toEqual([]);
    const one = down(gestureStart(), 1, at(0, 0));
    expect(move(one, 9, { x: 1, y: 1 }, size, ALL).actions).toEqual([]);
    expect(move(one, 1, { x: NaN, y: 1 }, size, ALL).actions).toEqual([]);
    expect(move(one, 1, { x: 1, y: 1 }, { width: 0, height: 0 }, ALL).actions).toEqual([]);
    expect(up(one, 9)).toBe(one);
  });
  it('a pinch with the fingers on the same spot cannot divide by zero', () => {
    const g = down(down(gestureStart(), 1, at(5, 5)), 2, at(5, 5));
    expect(move(g, 2, { x: 50, y: 5 }, size, ALL).actions.some((a) => a.type === 'zoom' && !Number.isFinite(a.factor))).toBe(false);
  });
  it('wheel: up zooms in, down zooms out, limited to a factor of 2 per event; lines and pages scale', () => {
    expect(wheelFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0)).toBeLessThan(1);
    expect(wheelFactor(-100000, 0)).toBe(2);
    expect(wheelFactor(100000, 0)).toBe(0.5);
    expect(wheelFactor(-3, 1)).toBeGreaterThan(wheelFactor(-3, 0)); // a line is worth more than a pixel
    expect(wheelFactor(-1, 2)).toBeGreaterThan(wheelFactor(-1, 1));
    expect(wheelFactor(NaN, 0)).toBe(1);
    expect(wheelFactor(0, 0)).toBe(1);
  });
});

describe('the first-time hint storage (FR-2.8)', () => {
  const memory = (): KeyValueStore & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
  };
  it('shows until dismissed, then never again', () => {
    const s = memory();
    expect(hintDismissed(s)).toBe(false);
    dismissHint(s);
    expect(hintDismissed(s)).toBe(true);
    expect(s.data[HINT_KEY]).toBe('1');
  });
  it('only the dismissal is stored, under one key, with no other data', () => {
    const s = memory();
    hintDismissed(s);
    expect(s.data).toEqual({});
    dismissHint(s);
    expect(s.data).toEqual({ 'vm.sceneHint': '1' });
  });
  it('only the exact value counts as dismissed', () => {
    const s = memory();
    s.data[HINT_KEY] = 'true';
    expect(hintDismissed(s)).toBe(false);
  });
  it('blocked or full storage behaves as "not dismissed" and never throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(hintDismissed(broken)).toBe(false);
    expect(() => dismissHint(broken)).not.toThrow();
    expect(hintDismissed(null)).toBe(false);
    expect(() => dismissHint(null)).not.toThrow();
  });
});

describe('the debounced announcer (500 ms)', () => {
  const fake = () => {
    let now = 0;
    const queue: { at: number; fn: () => void; id: number }[] = [];
    let next = 1;
    return {
      timers: {
        set: ((fn: () => void, ms: number) => (queue.push({ at: now + ms, fn, id: next }), next++)) as unknown as typeof setTimeout,
        clear: ((id: number) => void queue.splice(0, queue.length, ...queue.filter((q) => q.id !== id))) as unknown as typeof clearTimeout,
      },
      advance(ms: number) {
        now += ms;
        for (const q of queue.filter((x) => x.at <= now).sort((a, b) => a.at - b.at)) {
          queue.splice(queue.indexOf(q), 1);
          q.fn();
        }
      },
    };
  };
  it('says the last message once the visitor has stopped for 500 ms', () => {
    const t = fake();
    const said: string[] = [];
    const a = createAnnouncer((m) => said.push(m), 500, t.timers);
    a.say('first');
    t.advance(300);
    a.say('second');
    t.advance(300);
    expect(said).toEqual([]);
    t.advance(200);
    expect(said).toEqual(['second']);
  });
  it('the default timers work in a browser: setTimeout is never called as a method of another object', async () => {
    // A browser throws "Illegal invocation" when setTimeout runs with `this` set to anything but the window.
    const calls: string[] = [];
    const realSet = globalThis.setTimeout;
    const realClear = globalThis.clearTimeout;
    const strict = function (this: unknown, fn: () => void, ms: number) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      calls.push('set');
      return realSet.call(undefined, fn, ms);
    };
    globalThis.setTimeout = strict as unknown as typeof setTimeout;
    globalThis.clearTimeout = function (this: unknown, id?: ReturnType<typeof setTimeout>) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      calls.push('clear');
      realClear.call(undefined, id);
    } as typeof clearTimeout;
    try {
      const said: string[] = [];
      const a = createAnnouncer((m) => said.push(m), 5);
      a.say('x');
      a.say('y'); // clears the first
      await new Promise((r) => realSet(r, 40));
      expect(said).toEqual(['y']);
      expect(calls).toEqual(['set', 'clear', 'set']);
    } finally {
      globalThis.setTimeout = realSet;
      globalThis.clearTimeout = realClear;
    }
  });
  it('cancel drops what is pending', () => {
    const t = fake();
    const said: string[] = [];
    const a = createAnnouncer((m) => said.push(m), 500, t.timers);
    a.say('x');
    a.cancel();
    t.advance(1000);
    expect(said).toEqual([]);
  });
  it('can speak again after it has spoken', () => {
    const t = fake();
    const said: string[] = [];
    const a = createAnnouncer((m) => said.push(m), 500, t.timers);
    a.say('one');
    t.advance(500);
    a.say('two');
    t.advance(500);
    expect(said).toEqual(['one', 'two']);
  });
});
