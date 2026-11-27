import { parseTyped } from '../expr';
import { snap, type ParamSpec } from './index';

// The viewer state that lives in the address (AD-6, FR-2.7): the step and the parameters the visitor
// changed, so a language switch, a shared link or a reload keeps the place. Read only on the client.
// The address is hostile input: nothing is trusted, everything is clamped, and what is not known is dropped.

export interface UrlState {
  /** 0-based step index, or null when the address does not name one. */
  readonly step: number | null;
  /** Only known parameters, each clamped to its range and snapped to its step; no prototype. */
  readonly params: Readonly<Record<string, number>>;
}

/** A longer query is ignored whole: it is not something this page ever writes. */
export const URL_MAX = 2000;
const PREFIX = 'p.';

export function parseUrlState(specs: readonly ParamSpec[], stepCount: number, search: string): UrlState {
  const params: Record<string, number> = Object.create(null) as Record<string, number>;
  const empty: UrlState = { step: null, params };
  if (typeof search !== 'string' || search.length > URL_MAX) return empty;

  const known = new Map(specs.map((s) => [s.id, s]));
  const seen = new Set<string>();
  let step: number | null = null;
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(search);
  } catch {
    return empty;
  }

  for (const [key, raw] of query) {
    if (seen.has(key)) continue; // the first of a repeated key wins
    seen.add(key);
    const typed = parseTyped(raw);
    if (!typed.ok) continue;
    if (key === 'step') {
      if (stepCount > 0 && Number.isInteger(typed.value)) step = Math.min(Math.max(1, typed.value), stepCount) - 1;
    } else if (key.startsWith(PREFIX)) {
      const spec = known.get(key.slice(PREFIX.length));
      if (spec) params[spec.id] = snap(spec, typed.value);
    }
  }
  return { step, params };
}

/** The query for a place: the step when it is not the first, and the parameters that were changed. '' when there is nothing to say. */
export function serializeUrlState(state: { step: number; params: Readonly<Record<string, number>> }): string {
  const parts: string[] = [];
  if (Number.isInteger(state.step) && state.step > 0) parts.push(`step=${state.step + 1}`);
  for (const id of Object.keys(state.params).sort()) {
    const v = state.params[id]!;
    if (Number.isFinite(v)) parts.push(`${PREFIX}${id}=${v}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * The address with this page's own keys replaced and every other key left as it was (a harness or a campaign
 * may carry its own): the step and the parameters it writes are `step` and `p.<id>`, nothing else is touched.
 */
export function mergeUrlState(search: string, state: { step: number; params: Readonly<Record<string, number>> }): string {
  const q = new URLSearchParams(typeof search === 'string' ? search : '');
  for (const key of [...q.keys()]) if (key === 'step' || key.startsWith(PREFIX)) q.delete(key);
  const ours = serializeUrlState(state).slice(1);
  const rest = q.toString();
  const all = [rest, ours].filter(Boolean).join('&');
  return all ? `?${all}` : '';
}
