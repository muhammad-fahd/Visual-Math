// The canonical JSON of a topic: strings in Unicode NFC, object keys sorted, no whitespace (AD-19).
// Two documents that mean the same thing give the same string, so they get the same hash.

export class CanonicalizeError extends Error {
  constructor(
    message: string,
    readonly pointer: string,
  ) {
    super(message);
    this.name = 'CanonicalizeError';
  }
}

const esc = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');

function walk(value: unknown, pointer: string, depth: number): string {
  if (depth > 200) throw new CanonicalizeError(`nesting is deeper than 200 levels at ${pointer || '/'}`, pointer);
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value.normalize('NFC'));
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalizeError(`${String(value)} cannot be written as JSON at ${pointer || '/'}`, pointer);
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'object':
      break;
    default:
      throw new CanonicalizeError(`a ${typeof value} cannot be written as JSON at ${pointer || '/'}`, pointer);
  }
  if (Array.isArray(value)) {
    // Index by index, so a hole is the undefined it is (refused), never a silent gap in the output.
    const items: string[] = [];
    for (let i = 0; i < value.length; i++) items.push(walk(value[i], `${pointer}/${i}`, depth + 1));
    return `[${items.join(',')}]`;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalizeError(`only plain objects and arrays are allowed at ${pointer || '/'}`, pointer);
  }
  const entries = new Map<string, unknown>();
  for (const key of Object.keys(value)) {
    const normalized = key.normalize('NFC');
    if (entries.has(normalized)) throw new CanonicalizeError(`two keys are the same after Unicode normalization: '${normalized}' at ${pointer || '/'}`, pointer);
    entries.set(normalized, (value as Record<string, unknown>)[key]);
  }
  const keys = [...entries.keys()].sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${walk(entries.get(k), `${pointer}/${esc(k)}`, depth + 1)}`).join(',')}}`;
}

/** Throws CanonicalizeError for anything JSON cannot carry (NaN, Infinity, undefined, functions, BigInt, class instances). */
export function canonicalize(value: unknown): string {
  return walk(value, '', 0);
}
