import { LIMITS } from './types';

// What a visitor types next to a slider (FR-3.7). It is not an expression: it must be one finite
// number. Eastern Arabic-Indic digits are accepted so an Urdu keyboard works.

export type Typed = { ok: true; value: number } | { ok: false };

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/; // ASCII digits only: JS \d is ASCII without the u flag

function normalize(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660); // Arabic-Indic digits
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0); // Extended Arabic-Indic digits
    else if (code === 0x066b) out += '.'; // Arabic decimal separator
    else if (code === 0x2212) out += '-'; // minus sign
    else if (code === 0x066c) continue; // Arabic thousands separator
    else if (/\s/.test(ch)) continue;
    else out += ch;
  }
  return out;
}

/** The typed text as a number, or `{ ok: false }` for anything that is not exactly one finite number. */
export function parseTyped(raw: unknown): Typed {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > LIMITS.typedLength) return { ok: false };
  const text = normalize(raw);
  if (!NUMBER.test(text)) return { ok: false };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false };
  return { ok: true, value: value + 0 }; // -0 becomes 0
}
