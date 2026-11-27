// A debounced announcer for the frame's polite live region (EXPERIENCE "Accessibility Floor"): the
// last message wins, said once the visitor has stopped for `delay` ms (500 by default). Camera
// rotation is not announced; a reset or a view change is.

export interface Announcer {
  say(message: string): void;
  cancel(): void;
}

// `setTimeout` must not be called as a method of another object in a browser ("Illegal invocation"),
// so the defaults are wrappers, not the functions themselves.
const DEFAULT_TIMERS = { set: ((fn: () => void, ms: number) => setTimeout(fn, ms)) as typeof setTimeout, clear: ((id: ReturnType<typeof setTimeout>) => clearTimeout(id)) as typeof clearTimeout };

export function createAnnouncer(emit: (message: string) => void, delay = 500, timers: { set: typeof setTimeout; clear: typeof clearTimeout } = DEFAULT_TIMERS): Announcer {
  let pending: ReturnType<typeof setTimeout> | undefined;
  return {
    say(message) {
      if (pending !== undefined) timers.clear(pending);
      pending = timers.set(() => {
        pending = undefined;
        emit(message);
      }, delay);
    },
    cancel() {
      if (pending !== undefined) timers.clear(pending);
      pending = undefined;
    },
  };
}
