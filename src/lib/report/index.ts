// "Report a problem" (FR-2.4): what a visitor may send, and how the note is made safe. Pure; the browser
// uses it to count, the server uses it to decide (the server never trusts the browser's count). No zod here:
// the browser imports this file, and zod must stay out of the visitor's bundle (the body schema is in ./schema).

export const REASONS = ['wrong-math', 'unclear', 'urdu', 'scene', 'other'] as const;
export type Reason = (typeof REASONS)[number];

export const NOTE_MAX = 500;
/** What the route accepts before cleaning: junk characters may be removed, so the raw text may be longer. */
export const RAW_NOTE_MAX = 2000;

export const TOPIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Control characters and format characters: bidi overrides and isolates, zero-width spaces, the byte order mark.
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;
// The two joiners Urdu needs (ZWNJ U+200C, ZWJ U+200D) are format characters too; they are kept.
const KEEP = new Set([0x200c, 0x200d]);
const BREAKS = /[\t\n\v\f\r\u0085]+/g; // U+0085 (next line) is a control character too
const LONE_SURROGATE = /\p{Cs}/gu;
/** At least one character that is not a space, a control or a joiner. */
const HAS_WORD = /[^\s\p{Cc}\p{Cf}]/u;

/** The note as it is stored: NFC, invisible controls removed, spaces collapsed and trimmed. Not shortened. */
export function cleanNote(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .slice(0, RAW_NOTE_MAX * 2)
    .replace(LONE_SURROGATE, '') // a half of a pair cannot be stored
    .normalize('NFC')
    .replace(BREAKS, ' ') // line breaks are word breaks, not nothing
    .replace(INVISIBLE, (ch) => (KEEP.has(ch.codePointAt(0)!) ? ch : ''))
    .replace(/\s+/g, ' ')
    .trim();
  // Joiners and spaces alone are not words: such a note is an empty one.
  return HAS_WORD.test(cleaned) ? cleaned : '';
}

/** Length in characters (code points), the way a person counts them. */
export const noteLength = (note: string): number => Array.from(note).length;

export type NoteProblem = 'too-long' | 'required' | null;

/** `required` for "Something else" with nothing written; `too-long` past 500 characters. */
export function checkNote(reason: Reason, cleaned: string): NoteProblem {
  if (noteLength(cleaned) > NOTE_MAX) return 'too-long';
  if (reason === 'other' && cleaned.length === 0) return 'required';
  return null;
}
