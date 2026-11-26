import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFER_AFTER_MS, TIER_KEY, lightChosen, rememberLight, webglAvailable } from '../../src/scenes/solid3d';

// The tier decisions of Story 2.4 that depend on the device: what storage and WebGL do when they are
// missing, blocked or broken. The browser tests cover the real thing; these cover the odd ones.

afterEach(() => vi.unstubAllGlobals());

const storage = (impl: Partial<Storage>) => vi.stubGlobal('window', { localStorage: impl });

describe('the stored light-picture choice', () => {
  it('is the key the docs name, and the offer comes after 8 seconds', () => {
    expect(TIER_KEY).toBe('vm.tier');
    expect(OFFER_AFTER_MS).toBe(8000);
  });
  it('reads "light" and nothing else as a choice', () => {
    for (const [value, expected] of [['light', true], [null, false], ['3d', false], ['LIGHT', false], ['', false]] as const) {
      storage({ getItem: () => value });
      expect(lightChosen()).toBe(expected);
    }
  });
  it('blocked storage is "no choice", and writing to it does not throw', () => {
    const refuse = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    storage({ getItem: refuse, setItem: refuse, removeItem: refuse });
    expect(lightChosen()).toBe(false);
    expect(() => rememberLight(true)).not.toThrow();
    expect(() => rememberLight(false)).not.toThrow();
  });
  it('remembering writes the key; forgetting removes it', () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    storage({ setItem, removeItem });
    rememberLight(true);
    expect(setItem).toHaveBeenCalledWith('vm.tier', 'light');
    rememberLight(false);
    expect(removeItem).toHaveBeenCalledWith('vm.tier');
  });
});

describe('the WebGL 2 probe', () => {
  const canvas = (getContext: () => unknown) => vi.stubGlobal('document', { createElement: () => ({ getContext }) });
  it('is true when a WebGL 2 context can be made, and gives the context back at once', () => {
    const lose = vi.fn();
    canvas(() => ({ getExtension: () => ({ loseContext: lose }) }));
    expect(webglAvailable()).toBe(true);
    expect(lose).toHaveBeenCalledTimes(1);
  });
  it('is true even if the lose-context extension is missing', () => {
    canvas(() => ({ getExtension: () => null }));
    expect(webglAvailable()).toBe(true);
  });
  it('is false for no context, and for a canvas that throws', () => {
    canvas(() => null);
    expect(webglAvailable()).toBe(false);
    canvas(() => {
      throw new Error('GPU process crashed');
    });
    expect(webglAvailable()).toBe(false);
    vi.stubGlobal('document', undefined);
    expect(webglAvailable()).toBe(false);
  });
});
