import { createHmac } from 'node:crypto';
import { errorResponse } from '../admin/http';

// The one way to limit requests in app code (AD-28, NFR-2.8). The key is an HMAC of the day, the
// route name and the client address, so it rotates daily and cannot be turned back into an address;
// the database only ever sees the key.

export interface RateRule {
  /** Short stable name of the limit, e.g. "sign-in"; part of the key, so each route has its own bucket. */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateStore {
  hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }>;
}

export interface RateDeps {
  /** null when the database is not configured: there is nothing to protect yet, so nothing is limited. */
  store: RateStore | null;
  secret: string | null;
  now?: () => Date;
  /** True on a deployment (Vercel): a missing store or secret then stops the request instead of letting it through. */
  requireStore?: boolean;
}

/** Vercel overwrites these headers with the real client address; a client cannot choose them. */
export function clientAddress(request: Request): string {
  const h = request.headers;
  const first = (v: string | null) => v?.split(',')[0]?.trim() || null;
  return first(h.get('x-vercel-forwarded-for')) ?? first(h.get('x-real-ip')) ?? first(h.get('x-forwarded-for')) ?? 'unknown';
}

export function rateKey(secret: string, day: string, rule: string, address: string): string {
  return createHmac('sha256', secret).update(`${day}|${rule}|${address}`).digest('hex');
}

/** Returns a Response to send back when the call must stop, or null when it may go on. */
export async function applyRateLimit(deps: RateDeps, request: Request, rule: RateRule): Promise<Response | null> {
  if (!deps.store || !deps.secret) {
    return deps.requireStore ? errorResponse(503, 'unavailable', 'Try again shortly.') : null;
  }
  const day = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
  const key = rateKey(deps.secret, day, rule.name, clientAddress(request));
  try {
    const result = await deps.store.hit(key, rule.limit, rule.windowSeconds);
    if (result.allowed) return null;
    const retryAfter = Math.max(1, Math.ceil(result.retryAfter));
    return errorResponse(429, 'rate_limited', 'Too many requests.', { retryAfterSeconds: retryAfter }, { 'Retry-After': String(retryAfter) });
  } catch {
    // The limiter is a safety control: when it cannot answer, the request does not go through.
    return errorResponse(503, 'unavailable', 'Try again shortly.');
  }
}
