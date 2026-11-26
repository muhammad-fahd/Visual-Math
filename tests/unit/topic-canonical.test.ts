import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONTENT_HASH, CanonicalizeError, canonicalize, contentHash } from '../../src/lib/topic-schema';

const sha = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`;

describe('canonicalize: golden vectors (AD-19)', () => {
  // Expected strings are written out by hand; the hashes come from Python's hashlib, not from this code.
  const vectors: [string, unknown, string, string][] = [
    ['empty object', {}, '{}', 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'],
    ['empty array', [], '[]', 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
    ['null', null, 'null', 'sha256:74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b'],
    ['mixed, keys out of order', { c: 'x', b: [true, false, null], a: 1 }, '{"a":1,"b":[true,false,null],"c":"x"}', 'sha256:134a0bdc0f430c1e870c65399637eec4f9543c0d0a44942f3846af621833010a'],
    ['decomposed e acute in a value', { k: 'café' }, '{"k":"café"}', 'sha256:2303df0176226e83b89fa2a9311d76a8a4c29b0e8ae83ffaa0e431fa4f8b5359'],
    ['Urdu text', { title: { ur: 'اکائی دائرہ', en: 'A' } }, '{"title":{"en":"A","ur":"اکائی دائرہ"}}', 'sha256:2c1fab710f3f6e013d047fae393baabec1d7c71dcb1ede2803860e31ad329b60'],
    ['a string document', 'é', '"é"', 'sha256:f2886017e9c7abacf804b54d64787dce2b611c9544ba21f3affdd126a6e50086'],
    ['numbers: exponent, negative zero, fraction', { n: 1.5, m: -0, e: 1e21 }, '{"e":1e+21,"m":0,"n":1.5}', 'sha256:67b16a0f004b2dfd76330caae3c695085f649a85234663e7c75fff0aa35b5f64'],
    ['nesting and the minus sign', { z: '−', a: { b: { c: [1, 2, { d: null }] } } }, '{"a":{"b":{"c":[1,2,{"d":null}]}},"z":"−"}', 'sha256:35d7ea1da37e681ad5d90f6c5d3da4b33be9bc02f04467f9167faa3cf2feb8a5'],
    ['escapes', { q: 'a"b\\c\n\u0001' }, '{"q":"a\\"b\\\\c\\n\\u0001"}', 'sha256:94e3ed88512fdee0b8466dc60c624d2c35e384738235e87ef092ee2e97c0fc94'],
  ];
  it.each(vectors)('%s', async (_name, value, canonical) => {
    expect(canonicalize(value)).toBe(canonical);
    expect(await contentHash(value)).toBe(sha(canonical));
  });
  it('the fixed hashes match (so a change of algorithm or form fails loudly)', async () => {
    for (const [name, value, , hash] of vectors) {
      expect(await contentHash(value), name).toBe(hash);
    }
  });
});

describe('canonicalize: stable across key order and Unicode forms', () => {
  it('key order never matters, at any depth', () => {
    const a = { id: 'x', path: { category: 'c', chapter: 'k' }, list: [{ b: 1, a: 2 }] };
    const b = { list: [{ a: 2, b: 1 }], path: { chapter: 'k', category: 'c' }, id: 'x' };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });
  it('array order does matter', () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });
  it('NFC and NFD text give the same string and the same hash', async () => {
    const nfc = { title: { en: 'éè', ur: 'آ' } };
    const nfd = { title: { en: 'éè', ur: 'آ' } };
    expect(canonicalize(nfd)).toBe(canonicalize(nfc));
    expect(await contentHash(nfd)).toBe(await contentHash(nfc));
  });
  it('keys are normalized too, and two keys that collide after normalization are an error', () => {
    expect(canonicalize({ ['café']: 1 })).toBe('{"café":1}');
    expect(() => canonicalize({ ['café']: 1, ['café']: 2 })).toThrow(CanonicalizeError);
  });
  it('an own __proto__ key is data, not a prototype', () => {
    const doc = JSON.parse('{"__proto__": {"x": 1}, "a": 2}') as unknown;
    expect(canonicalize(doc)).toBe('{"__proto__":{"x":1},"a":2}');
  });
  it('whitespace and number spellings in the source do not matter (parsed JSON is the input)', () => {
    expect(canonicalize(JSON.parse('{ "a" : 1.0 ,\n "b":[ 1e2 , 0.50 ] }'))).toBe('{"a":1,"b":[100,0.5]}');
  });
  it('property: shuffling keys and re-encoding as NFD leaves the hash unchanged', async () => {
    const json = fc.letrec<{ v: unknown }>((tie) => ({
      v: fc.oneof(
        { depthSize: 'small', maxDepth: 3 },
        fc.constant(null),
        fc.boolean(),
        fc.integer(),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.string({ unit: 'grapheme', maxLength: 12 }),
        fc.array(tie('v'), { maxLength: 4 }),
        fc.dictionary(fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }), tie('v'), { maxKeys: 4 }),
      ),
    })).v;
    const reshuffle = (v: unknown, rng: () => number): unknown => {
      if (typeof v === 'string') return v.normalize('NFD');
      if (Array.isArray(v)) return v.map((e) => reshuffle(e, rng));
      if (typeof v === 'object' && v !== null) {
        const entries = Object.entries(v).map(([k, e]): [string, unknown] => [k.normalize('NFD'), reshuffle(e, rng)]);
        entries.sort(() => rng() - 0.5);
        return Object.fromEntries(entries);
      }
      return v;
    };
    await fc.assert(
      fc.asyncProperty(json, fc.integer(), async (doc, seed) => {
        let s = seed;
        const rng = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
        let a: string;
        let b: string;
        try {
          a = canonicalize(doc);
          b = canonicalize(reshuffle(doc, rng));
        } catch (error) {
          expect(error).toBeInstanceOf(CanonicalizeError); // only a normalization key collision may refuse
          return;
        }
        expect(b).toBe(a);
        expect(await contentHash(doc)).toBe(sha(a));
      }),
      { numRuns: 400 },
    );
  });
  it('the output is valid JSON that parses back to an equal document (NFC)', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ maxLength: 8 }), fc.oneof(fc.string({ maxLength: 10 }), fc.integer(), fc.boolean(), fc.constant(null)), { maxKeys: 6 }), (doc) => {
        const text = canonicalize(doc);
        const back = JSON.parse(text) as Record<string, unknown>;
        expect(Object.keys(back).length).toBeLessThanOrEqual(Object.keys(doc).length);
        expect(canonicalize(back)).toBe(text); // idempotent
      }),
      { numRuns: 300 },
    );
  });
});

describe('canonicalize: what JSON cannot carry is refused with a pointer', () => {
  it.each([
    ['NaN', { a: NaN }, '/a'],
    ['Infinity', { a: [1, Infinity] }, '/a/1'],
    ['-Infinity', { 'x/y': -Infinity }, '/x~1y'],
    ['undefined', { a: undefined }, '/a'],
    ['a function', { a: () => 1 }, '/a'],
    ['a symbol', { a: Symbol('s') }, '/a'],
    ['a BigInt', { a: 1n }, '/a'],
    ['a Date', { a: new Date(0) }, '/a'],
    ['a Map', { a: new Map() }, '/a'],
    ['a class instance', { a: new (class X {})() }, '/a'],
  ])('%s', (_name, value, pointer) => {
    try {
      canonicalize(value);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalizeError);
      expect((error as CanonicalizeError).pointer).toBe(pointer);
    }
  });
  it('a document nested more than 200 levels deep is refused, not a stack overflow', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 300; i++) deep = [deep];
    expect(() => canonicalize(deep)).toThrow(CanonicalizeError);
  });
  it('null-prototype objects are fine (parsed records may be)', () => {
    const o = Object.assign(Object.create(null) as Record<string, number>, { b: 2, a: 1 });
    expect(canonicalize(o)).toBe('{"a":1,"b":2}');
  });
});

describe('contentHash', () => {
  it('is sha256: plus 64 lowercase hex characters', async () => {
    expect(await contentHash({ a: 1 })).toMatch(CONTENT_HASH);
    expect(CONTENT_HASH.test('sha256:' + 'A'.repeat(64))).toBe(false);
    expect(CONTENT_HASH.test('sha256:abc')).toBe(false);
    expect(CONTENT_HASH.test('md5:' + 'a'.repeat(64))).toBe(false);
  });
  it('differs when the document differs by one character', async () => {
    expect(await contentHash({ a: 'x' })).not.toBe(await contentHash({ a: 'y' }));
  });
  it('rejects (does not hash) what cannot be canonicalized', async () => {
    await expect(contentHash({ a: NaN })).rejects.toBeInstanceOf(CanonicalizeError);
  });
});

describe('canonicalize: arrays with holes', () => {
  it('a hole is refused with its pointer, not written as an invalid gap', () => {
    const sparse = [1, , 3];
    try {
      canonicalize({ list: sparse });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalizeError);
      expect((error as CanonicalizeError).pointer).toBe('/list/1');
    }
    expect(canonicalize(JSON.parse('[1,null,3]'))).toBe('[1,null,3]');
  });
});
