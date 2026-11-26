// The first-time hint (FR-2.8): shown on the first topic opened on a device until the visitor taps
// "Got it". Only the dismissal is remembered, on the device (AD-17 lists it as essential storage).
// Storage can be blocked or full: every call here swallows that and behaves as "not dismissed".

export const HINT_KEY = 'vm.sceneHint';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // access itself can throw when storage is blocked
  }
}

export function hintDismissed(store: KeyValueStore | null = browserStore()): boolean {
  try {
    return store?.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissHint(store: KeyValueStore | null = browserStore()): void {
  try {
    store?.setItem(HINT_KEY, '1');
  } catch {
    // The hint then shows again next time; nothing else is lost.
  }
}
