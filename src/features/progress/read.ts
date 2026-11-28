// The one place the device's progress key is named (AD-14 progress). Story 5.1 only reads it, to show the
// "Viewed" mark on a topic card; Story 6.1 adds writing. The value is checked by hand, not with Zod, so the
// schema library stays out of the browser bundle, and anything that does not match is thrown away whole.

export const PROGRESS_KEY = 'vm.progress.v1';

/** The ids of the topics marked viewed in a raw stored value; empty when the value is missing or not valid. */
export function viewedIds(raw: string | null): ReadonlySet<string> {
  if (!raw) return NONE;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || (value as { v?: unknown }).v !== 1) return NONE;
    const topics = (value as { topics?: unknown }).topics;
    if (typeof topics !== 'object' || topics === null || Array.isArray(topics)) return NONE;
    const ids = new Set<string>();
    for (const [id, entry] of Object.entries(topics)) {
      if (typeof entry !== 'object' || entry === null) return NONE;
      if (typeof (entry as { viewedAt?: unknown }).viewedAt !== 'string' && typeof (entry as { viewedAt?: unknown }).viewedAt !== 'number') return NONE;
      ids.add(id);
    }
    return ids;
  } catch {
    return NONE;
  }
}

const NONE: ReadonlySet<string> = new Set();
