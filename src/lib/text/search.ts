// The one search normalization (AD-21, Story 5.3), used to build the catalog's search words and to read what a
// visitor types, so the two always agree. Pure.
//
// What it does, in order: split accented Latin letters and Arabic presentation forms (NFKD); fold the Arabic yeh
// (U+064A) and alef maksura (U+0649) into the Persian yeh (U+06CC) and the Arabic kaf (U+0643) into the Persian kaf
// (U+06A9), the forms Urdu keyboards mix; drop Latin accents, Arabic diacritics, tatweel and the zero-width joiners
// (ZWNJ is how Urdu text is spaced inside a word); map Eastern digits to Western; lower-case; collapse spaces.

const DROP = /[\u0300-\u036F\u064B-\u065F\u0670\u0640\u200C\u200D\u200E\u200F]/g;

export function normalizeSearch(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u064A\u0649]/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .replace(DROP, '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
