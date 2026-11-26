// Sign-in lockout policy (NFR-2.8). The counting itself is atomic in Postgres (login_failure);
// these constants are the numbers passed to it, and the helpers turn a lock end into text inputs.

export const LOCKOUT = { maxFailures: 5, windowSeconds: 15 * 60, lockSeconds: 15 * 60 } as const;

/** Whole seconds left until `lockedUntil`, never negative. */
export function secondsUntil(lockedUntil: Date | string, now: Date = new Date()): number {
  const end = lockedUntil instanceof Date ? lockedUntil : new Date(lockedUntil);
  const ms = end.getTime() - now.getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
}

/** Whole minutes to show the admin, at least 1 while any time is left. */
export function minutesToWait(seconds: number): number {
  return seconds <= 0 ? 0 : Math.max(1, Math.ceil(seconds / 60));
}

/** One address, one counter: case and surrounding spaces do not create a second counter. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
