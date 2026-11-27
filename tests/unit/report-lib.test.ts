import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NOTE_MAX, checkNote, cleanNote, noteLength } from '../../src/lib/report';
import { reportBody } from '../../src/lib/report/schema';

describe('cleaning a note (FR-2.4, AD-14)', () => {
  it('normalizes to NFC, collapses spaces and trims', () => {
    expect(cleanNote('  The   volume \t is  off  ')).toBe('The volume is off');
    expect(cleanNote('é')).toBe('é');
  });
  it('a line break is a word break, not nothing', () => {
    expect(cleanNote('one\ntwo\r\nthree\tfour')).toBe('one two three four');
  });
  it('removes bidi overrides and isolates, zero-width characters and the byte order mark', () => {
    for (const bad of ['‪', '‫', '‬', '‭', '‮', '⁦', '⁧', '⁨', '⁩', '‎', '‏', '؜', '​', '﻿', '\u0000', '\u0007', '\u007f']) {
      expect(cleanNote(`a${bad}b`), JSON.stringify(bad)).toBe('ab');
    }
  });
  it('NEL (next line, U+0085) is a word break like the other line breaks', () => {
    expect(cleanNote('one\u0085two')).toBe('one two');
  });
  it('a lone half of a surrogate pair is dropped, so the text can always be stored', () => {
    expect(cleanNote('a\ud800b')).toBe('ab');
    expect(cleanNote('a\udc00b')).toBe('ab');
    expect(cleanNote('😀')).toBe('😀');
  });
  it('joiners, spaces and controls alone are not a note', () => {
    for (const s of ['\u200c', '\u200d\u200c', ' \u200c ', '\u202e\u200b ']) expect(cleanNote(s), JSON.stringify(s)).toBe('');
    expect(checkNote('other', cleanNote('\u200c\u200d'))).toBe('required');
  });
  it('keeps the joiners Urdu needs', () => {
    expect(cleanNote('ک‌ا')).toBe('ک‌ا');
    expect(cleanNote('ب‍ا')).toBe('ب‍ا');
  });
  it('keeps Urdu and Latin text and digits of either set', () => {
    expect(cleanNote('حجم ٩٤٫٢ cm³ غلط ہے')).toBe('حجم ٩٤٫٢ cm³ غلط ہے');
  });
  it('anything that is not text is an empty note', () => {
    for (const v of [null, undefined, 5, {}, [], true]) expect(cleanNote(v)).toBe('');
  });
  it('markup stays as text: it is never interpreted here, and the page renders it as text', () => {
    expect(cleanNote('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });
  it('property: the result has no control or format character but the joiners, no double spaces, and cleaning twice changes nothing', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => {
        const once = cleanNote(s);
        expect(once).toBe(cleanNote(once));
        expect(once).not.toMatch(/\s\s/);
        expect(once).toBe(once.trim());
        for (const ch of once.replace(/[‌‍]/g, '')) expect(/[\p{Cc}\p{Cf}]/u.test(ch)).toBe(false);
      }),
      { numRuns: 300 },
    );
  });
  it('property: junk characters never change what the words are', () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 8 }), (words) => {
        const clean = words.join(' ');
        const noisy = words.map((w) => `‮${w}​`).join(' ⁦');
        expect(cleanNote(noisy)).toBe(clean);
      }),
    );
  });
});

describe('counting and checking a note', () => {
  it('counts characters the way a person does, not UTF-16 units', () => {
    expect(noteLength('😀😀')).toBe(2);
    expect(noteLength('ab')).toBe(2);
    expect(noteLength('')).toBe(0);
  });
  it('500 is allowed and 501 is not', () => {
    expect(checkNote('wrong-math', 'a'.repeat(NOTE_MAX))).toBeNull();
    expect(checkNote('wrong-math', 'a'.repeat(NOTE_MAX + 1))).toBe('too-long');
    expect(checkNote('wrong-math', '😀'.repeat(NOTE_MAX))).toBeNull();
    expect(checkNote('wrong-math', '😀'.repeat(NOTE_MAX + 1))).toBe('too-long');
  });
  it('a note is optional for every reason but "something else"', () => {
    for (const r of ['wrong-math', 'unclear', 'urdu', 'scene'] as const) expect(checkNote(r, '')).toBeNull();
    expect(checkNote('other', '')).toBe('required');
    expect(checkNote('other', 'x')).toBeNull();
  });
});

describe('the body of a report', () => {
  const ok = { topicId: 'geo-cone-volume', reason: 'wrong-math', note: 'The volume is off' };
  it('accepts a good body', () => {
    expect(reportBody.safeParse(ok).success).toBe(true);
    expect(reportBody.safeParse({ ...ok, note: '' }).success).toBe(true);
  });
  it('refuses a body with an extra key, a missing key, a wrong type or an unknown reason', () => {
    for (const bad of [{ ...ok, extra: 1 }, { ...ok, email: 'a@b.c' }, { topicId: ok.topicId, reason: ok.reason }, { ...ok, note: 5 }, { ...ok, reason: 'spam' }, { ...ok, reason: '__proto__' }, null, [], 'x', 5]) {
      expect(reportBody.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
  it('refuses a topic id that is not a topic id', () => {
    for (const id of ['', 'ab', 'Geo-Cone', 'geo cone', '../etc', 'a/b', 'geo--cone', '-geo', 'geo-', 'x'.repeat(65), '<b>', 'geo\ncone', '__proto__']) {
      expect(reportBody.safeParse({ ...ok, topicId: id }).success, id).toBe(false);
    }
  });
  it('a raw note over 2000 characters is refused before cleaning', () => {
    expect(reportBody.safeParse({ ...ok, note: 'a'.repeat(2000) }).success).toBe(true);
    expect(reportBody.safeParse({ ...ok, note: 'a'.repeat(2001) }).success).toBe(false);
  });
});

describe('what the browser imports', () => {
  it('the file the sheet uses has no zod in it, so zod stays out of the visitors bundle', () => {
    const text = readFileSync('src/lib/report/index.ts', 'utf8');
    expect(text.split('\n').filter((l) => /^import /.test(l))).toEqual([]);
    expect(readFileSync('src/features/topic/ReportProblem.tsx', 'utf8')).not.toContain('report/schema');
  });
});
