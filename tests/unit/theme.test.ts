import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PREPAINT_SCRIPT } from '../../src/lib/theme/prepaint';
import { parseChoice, resolveTheme, THEME_KEY } from '../../src/lib/theme/resolve';
import { PREPAINT_SCRIPT_SHA256 } from '../../src/server/csp-hashes';

type Listener = () => void;

/** Runs the real pre-paint script in a sandbox with a fake document, storage and media query. */
function run(opts: { stored?: unknown; osDark: boolean; storageThrows?: boolean; noMatchMedia?: boolean; legacyListener?: boolean }) {
  const attrs: Record<string, string> = {};
  const listeners: Listener[] = [];
  let osDark = opts.osDark;
  let stored = opts.stored;
  const mq: Record<string, unknown> = {
    get matches() {
      return osDark;
    },
  };
  if (opts.legacyListener) mq.addListener = (f: Listener) => listeners.push(f);
  else mq.addEventListener = (_: string, f: Listener) => listeners.push(f);
  const storageListeners: ((e: { key: string | null }) => void)[] = [];
  const window: Record<string, unknown> = {
    addEventListener: (type: string, f: (e: { key: string | null }) => void) => {
      if (type === 'storage') storageListeners.push(f);
    },
    localStorage: {
      getItem: () => {
        if (opts.storageThrows) throw new Error('blocked');
        return stored ?? null;
      },
    },
  };
  if (!opts.noMatchMedia) window.matchMedia = () => mq;
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), getAttribute: (k: string) => attrs[k] ?? null } };
  runInNewContext(PREPAINT_SCRIPT, { window, document });
  return {
    attrs,
    setOs(dark: boolean) {
      osDark = dark;
      listeners.forEach((f) => f());
    },
    setStored(v: unknown) {
      stored = v;
    },
    /** Another tab saved a value: storage changes, then the storage event fires here. */
    otherTabSaves(v: unknown) {
      stored = v;
      storageListeners.forEach((f) => f({ key: 'vm.theme' }));
    },
  };
}

describe('resolveTheme / parseChoice', () => {
  it('maps choices', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('treats anything unknown as system', () => {
    for (const v of ['banana', '', null, undefined, 3, {}]) expect(parseChoice(v)).toBe('system');
  });
  it('uses the key from the spec', () => expect(THEME_KEY).toBe('vm.theme'));
});

describe('pre-paint script (I/O matrix of Story 1.2)', () => {
  it('first visit, OS dark -> dark before paint', () => {
    expect(run({ osDark: true }).attrs).toMatchObject({ 'data-theme': 'dark', 'data-theme-choice': 'system' });
  });
  it('first visit, OS light -> light', () => {
    expect(run({ osDark: false }).attrs['data-theme']).toBe('light');
  });
  it('saved light beats OS dark', () => {
    expect(run({ stored: 'light', osDark: true }).attrs).toMatchObject({ 'data-theme': 'light', 'data-theme-choice': 'light' });
  });
  it('saved dark beats OS light', () => {
    expect(run({ stored: 'dark', osDark: false }).attrs['data-theme']).toBe('dark');
  });
  it('system follows the OS live, without reload', () => {
    const r = run({ stored: 'system', osDark: false });
    expect(r.attrs['data-theme']).toBe('light');
    r.setOs(true);
    expect(r.attrs['data-theme']).toBe('dark');
  });
  it('an explicit choice ignores OS changes', () => {
    const r = run({ stored: 'light', osDark: false });
    r.setOs(true);
    expect(r.attrs['data-theme']).toBe('light');
  });
  it('a choice saved by another tab is applied without waiting for an OS change', () => {
    const r = run({ stored: 'system', osDark: false });
    r.otherTabSaves('dark');
    expect(r.attrs).toMatchObject({ 'data-theme': 'dark', 'data-theme-choice': 'dark' });
  });
  it('an explicit choice survives an OS change even when storage is blocked', () => {
    const r = run({ storageThrows: true, osDark: false });
    r.attrs['data-theme-choice'] = 'light'; // what the toggle sets
    r.setOs(true);
    expect(r.attrs['data-theme']).toBe('light');
  });
  it('works with the legacy addListener API', () => {
    const r = run({ stored: 'system', osDark: false, legacyListener: true });
    r.setOs(true);
    expect(r.attrs['data-theme']).toBe('dark');
  });
  it('corrupt stored value falls back to system', () => {
    expect(run({ stored: 'banana', osDark: true }).attrs).toMatchObject({ 'data-theme': 'dark', 'data-theme-choice': 'system' });
  });
  it('blocked storage does not throw and follows the OS', () => {
    expect(run({ storageThrows: true, osDark: true }).attrs['data-theme']).toBe('dark');
  });
  it('no matchMedia -> light, no throw', () => {
    expect(run({ noMatchMedia: true, osDark: true }).attrs['data-theme']).toBe('light');
  });
  it('agrees with resolveTheme for every combination', () => {
    for (const stored of ['light', 'dark', 'system', undefined]) {
      for (const osDark of [true, false]) {
        const want = resolveTheme(parseChoice(stored), osDark);
        expect(run({ stored, osDark }).attrs['data-theme'], `${stored} ${osDark}`).toBe(want);
      }
    }
  });
});

describe('CSP hash export', () => {
  it('is the sha256 of the exact script text', () => {
    const b64 = createHash('sha256').update(PREPAINT_SCRIPT).digest('base64');
    expect(PREPAINT_SCRIPT_SHA256).toBe(`'sha256-${b64}'`);
  });
  it('script is a constant with no template placeholders', () => {
    expect(PREPAINT_SCRIPT).not.toMatch(/\$\{/);
  });
});
