import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FUNCTION_NAMES, LIMITS, compile, evaluateDetailed, format, parse, parseTyped, staticCost, type Scope } from '../../src/lib/expr';

// Property-based and fuzz tests (AD-27, Story 2.1): no input throws, results are never Infinity,
// the parser agrees with an independent oracle, the static cost bounds the real cost.

const NAMES = ['a', 'b', 'x', 'y', 'n'];

const scopeArb: fc.Arbitrary<Scope> = fc.record(
  { a: fc.double(), b: fc.double(), x: fc.double({ noNaN: false }), y: fc.integer(), n: fc.integer({ min: -5, max: 60 }) },
  { requiredKeys: [] },
) as fc.Arbitrary<Scope>;

function finiteOrNaN(v: number): boolean {
  return Number.isNaN(v) || (Number.isFinite(v) && Math.abs(v) <= LIMITS.magnitude);
}

describe('fuzz: no input throws', () => {
  it('any string, any scope', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 700 }), scopeArb, (src, scope) => {
        const p = parse(src, { scope: NAMES });
        if (p.ok) expect(finiteOrNaN(compile(p.value)(scope))).toBe(true);
        else {
          expect(p.error.message.length).toBeGreaterThan(0);
          expect(p.error.pos).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 1500 },
    );
  });

  it('any unicode string (grapheme, full range)', () => {
    fc.assert(fc.property(fc.string({ unit: 'grapheme', maxLength: 120 }), (src) => void parse(src, { scope: NAMES })), { numRuns: 800 });
    fc.assert(fc.property(fc.string({ unit: 'binary-ascii', maxLength: 200 }), (src) => void parse(src, { scope: NAMES })), { numRuns: 800 });
  });

  const vocabulary = [
    ...FUNCTION_NAMES, ...NAMES, 'pi', 'e', 'tau', '0', '1', '2', '3.5', '1e3', '10000', '(', ')', ',', '+', '-', '*', '/', '%', '^', '<', '<=', '>', '>=', '==', '!=', '&&', '||', '!',
    '__proto__', 'constructor', '.', '=', ' ', '٣', '1e999',
  ];
  it('token soup built from the real vocabulary (the nastiest near-valid input)', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...vocabulary), { maxLength: 60 }), scopeArb, (tokens, scope) => {
        const src = tokens.join(fc.sample(fc.constantFrom('', ' '), 1)[0]!);
        const p = parse(src, { scope: NAMES });
        if (p.ok) {
          const r = evaluateDetailed(p.value, scope);
          expect(finiteOrNaN(r.value)).toBe(true);
          expect(r.steps).toBeLessThanOrEqual(LIMITS.steps + 1);
        }
      }),
      { numRuns: 3000 },
    );
  });

  it('typed input: any string, and ok means one finite number', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary', maxLength: 60 }), fc.string({ unit: 'grapheme', maxLength: 60 })), (raw) => {
        const r = parseTyped(raw);
        if (r.ok) expect(Number.isFinite(r.value)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it('format: any double, any decimals', () => {
    fc.assert(
      fc.property(fc.double(), fc.integer({ min: -5, max: 40 }), (v, d) => {
        const s = format(v, d);
        expect(typeof s).toBe('string');
        expect(s).toMatch(/^(—|−?[0-9]+(\.[0-9]+)?(e\+[0-9]+)?)$/);
      }),
      { numRuns: 1500 },
    );
  });
});

// ---- A random tree of valid expressions, with an oracle computed straight from the tree ----

type T =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: T }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: T; b: T };

const tree: fc.Arbitrary<T> = fc.letrec<{ t: T }>((tie) => ({
  t: fc.oneof(
    { depthSize: 'small', maxDepth: 4 },
    fc.integer({ min: 0, max: 9 }).map((v): T => ({ k: 'num', v })),
    fc.constantFrom('a', 'b', 'x').map((name): T => ({ k: 'var', name })),
    tie('t').map((a): T => ({ k: 'neg', a })),
    fc.tuple(fc.constantFrom('+', '-', '*', '/', '^'), tie('t'), tie('t')).map(([op, a, b]): T => ({ k: 'bin', op, a, b })),
  ),
})).t;

const fin = (x: number) => (Number.isFinite(x) && Math.abs(x) <= LIMITS.magnitude ? x : NaN);
function oracle(t: T, scope: Record<string, number>): number {
  switch (t.k) {
    case 'num':
      return t.v;
    case 'var':
      return scope[t.name] ?? NaN;
    case 'neg':
      return fin(-oracle(t.a, scope));
    case 'bin': {
      const a = oracle(t.a, scope);
      const b = oracle(t.b, scope);
      switch (t.op) {
        case '+':
          return fin(a + b);
        case '-':
          return fin(a - b);
        case '*':
          return fin(a * b);
        case '/':
          return b === 0 ? NaN : fin(a / b);
        case '^':
          return fin(Math.pow(a, b));
      }
    }
  }
}

// Precedence levels: add 1, mul 2, unary 3, pow 4, atom 5. `min` is the lowest level the position accepts.
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 } as const;
function minimal(t: T, min: number): string {
  let text: string;
  let prec: number;
  switch (t.k) {
    case 'num':
      return String(t.v);
    case 'var':
      return t.name;
    case 'neg':
      prec = 3;
      text = `-${minimal(t.a, 3)}`;
      break;
    case 'bin':
      if (t.op === '^') {
        prec = 4;
        text = `${minimal(t.a, 5)}^${minimal(t.b, 3)}`; // the base must be an atom; the exponent may be unary or a power (right-associative)
      } else {
        prec = PREC[t.op];
        text = `${minimal(t.a, prec)}${t.op}${minimal(t.b, prec + 1)}`; // left-associative
      }
      break;
  }
  return prec < min ? `(${text})` : text;
}
function full(t: T): string {
  switch (t.k) {
    case 'num':
      return String(t.v);
    case 'var':
      return t.name;
    case 'neg':
      return `(-${full(t.a)})`;
    case 'bin':
      return `(${full(t.a)}${t.op}${full(t.b)})`;
  }
}

describe('the parser agrees with an independent oracle', () => {
  const run = (src: string, scope: Scope) => {
    const p = parse(src, { scope: ['a', 'b', 'x'] });
    if (!p.ok) throw new Error(`did not parse: ${src}: ${p.error.message}`);
    return compile(p.value)(scope);
  };
  const same = (x: number, y: number) => (Number.isNaN(x) ? Number.isNaN(y) : Object.is(x, y) || x === y);
  const sc = fc.record({ a: fc.integer({ min: -9, max: 9 }), b: fc.integer({ min: -9, max: 9 }), x: fc.double({ min: -9, max: 9, noNaN: true }) });

  it('the value of a minimally parenthesized rendering equals the oracle on the tree', () => {
    fc.assert(
      fc.property(tree, sc, (t, scope) => {
        expect(same(run(minimal(t, 0), scope), oracle(t, scope)), minimal(t, 0)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
  it('minimal and fully parenthesized renderings agree (precedence and associativity)', () => {
    fc.assert(
      fc.property(tree, sc, (t, scope) => {
        expect(same(run(minimal(t, 0), scope), run(full(t), scope)), `${minimal(t, 0)}  vs  ${full(t)}`).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
  it('known precedence traps, rendered both ways', () => {
    const t: T = { k: 'bin', op: '^', a: { k: 'bin', op: '^', a: { k: 'num', v: 2 }, b: { k: 'num', v: 3 } }, b: { k: 'num', v: 2 } };
    expect(minimal(t, 0)).toBe('(2^3)^2'); // 64, not 512
    expect(run(minimal(t, 0), {})).toBe(64);
    const u: T = { k: 'bin', op: '^', a: { k: 'neg', a: { k: 'num', v: 2 } }, b: { k: 'num', v: 2 } };
    expect(minimal(u, 0)).toBe('(-2)^2');
    expect(run(minimal(u, 0), {})).toBe(4);
  });
});

// ---- Valid expressions with calls and loops, for the cost property ----

const unaryFns = ['sin', 'cos', 'sqrt', 'abs', 'floor', 'ln', 'exp', 'fact', 'cbrt', 'round'];
const binaryFns = ['pow', 'mod', 'atan2', 'hypot', 'gcd', 'lcm', 'nCr', 'nPr', 'min', 'max', 'log'];
const numLit = fc.integer({ min: 0, max: 20 }).map(String);

const exprText: fc.Arbitrary<string> = fc.letrec<{ e: string; loop: string }>((tie) => ({
  e: fc.oneof(
    { depthSize: 'small', maxDepth: 3 },
    numLit,
    fc.constantFrom('a', 'b', 'x', 'y', 'n', 'pi'),
    tie('e').map((s) => `(${s})`),
    fc.tuple(fc.constantFrom('+', '-', '*', '/', '%', '^', '<', '==', '&&', '||'), tie('e'), tie('e')).map(([op, l, r]) => `(${l}${op}${r})`),
    fc.tuple(fc.constantFrom(...unaryFns), tie('e')).map(([f, s]) => `${f}(${s})`),
    fc.tuple(fc.constantFrom(...binaryFns), tie('e'), tie('e')).map(([f, l, r]) => `${f}(${l},${r})`),
    fc.tuple(tie('e'), tie('e'), tie('e')).map(([c, t, f]) => `if(${c},${t},${f})`),
    fc.tuple(fc.constantFrom('normcdf', 'normpdf', 'binompmf'), tie('e'), tie('e'), tie('e')).map(([f, a, b, c]) => `${f}(${a},${b},${c})`),
    tie('loop'),
  ),
  loop: fc
    .tuple(fc.constantFrom('sum', 'prod'), fc.constantFrom('i', 'j'), fc.oneof(numLit, fc.constant('n')), fc.oneof(numLit, fc.constant('n'), fc.constant('y')), tie('e'))
    .map(([op, v, lo, hi, body]) => `${op}(${v},${lo},${hi},${body}+${v})`),
})).e;

describe('cost and determinism', () => {
  const sc = scopeArb;
  it('the static cost is never below the steps an evaluation uses', () => {
    fc.assert(
      fc.property(exprText, sc, (src, scope) => {
        const p = parse(src, { scope: NAMES });
        if (!p.ok) return; // too large or deep: refused, which is fine
        const r = evaluateDetailed(p.value, scope);
        const cost = staticCost(p.value);
        if (!r.budgetExceeded) expect(r.steps, src).toBeLessThanOrEqual(cost);
        else expect(cost, src).toBeGreaterThan(LIMITS.steps - 1);
      }),
      { numRuns: 3000 },
    );
  });
  it('the same expression and scope always give the same answer, through either entry point', () => {
    fc.assert(
      fc.property(exprText, sc, (src, scope) => {
        const p = parse(src, { scope: NAMES });
        if (!p.ok) return;
        const f = compile(p.value);
        const one = f(scope);
        const two = f(scope);
        const three = evaluateDetailed(p.value, scope).value;
        expect(Object.is(one, two) && Object.is(two, three)).toBe(true);
      }),
      { numRuns: 1500 },
    );
  });
  it('parsing is deterministic and repeatable', () => {
    fc.assert(
      fc.property(exprText, (src) => {
        const a = parse(src, { scope: NAMES });
        const b = parse(src, { scope: NAMES });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }),
      { numRuns: 800 },
    );
  });
  it('every result is NaN or a finite number within the cap, whatever the scope', () => {
    fc.assert(
      fc.property(exprText, sc, (src, scope) => {
        const p = parse(src, { scope: NAMES });
        if (p.ok) expect(finiteOrNaN(compile(p.value)(scope)), src).toBe(true);
      }),
      { numRuns: 3000 },
    );
  });
  it('a loop whose body is constant costs exactly its iterations times the body, plus its bounds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (k) => {
        const p = parse(`sum(i,1,${k},1)`);
        if (!p.ok) throw new Error('parse');
        const r = evaluateDetailed(p.value);
        expect(r.value).toBe(k);
        expect(r.steps).toBe(1 + 1 + 1 + k * 2); // the loop, two bounds, then a step and a body node per iteration
        expect(staticCost(p.value)).toBe(r.steps);
      }),
      { numRuns: 100 },
    );
  });
});

describe('builtins on arbitrary numbers', () => {
  const finiteArg = fc.oneof(fc.double({ noNaN: false }), fc.integer({ min: -3, max: 1200 }), fc.constantFrom(0, -0, 1, -1, 0.5, 1e-13, 1e300, -1e300, Infinity, NaN));
  const calls: [string, number][] = [
    ...['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'rad', 'deg', 'sqrt', 'cbrt', 'exp', 'ln', 'log10', 'log2', 'abs', 'sign', 'floor', 'ceil', 'round', 'trunc', 'fact'].map((n): [string, number] => [n, 1]),
    ...['atan2', 'pow', 'log', 'hypot', 'mod', 'gcd', 'lcm', 'nCr', 'nPr', 'min', 'max'].map((n): [string, number] => [n, 2]),
    ...['clamp', 'if', 'normpdf', 'normcdf', 'binompmf'].map((n): [string, number] => [n, 3]),
  ];
  it.each(calls)('%s with any numbers is NaN or finite, and never throws', (name, arity) => {
    const names = ['p', 'q', 'r'].slice(0, arity);
    const p = parse(`${name}(${names.join(',')})`, { scope: names });
    if (!p.ok) throw new Error(p.error.message);
    const f = compile(p.value);
    fc.assert(
      fc.property(fc.tuple(finiteArg, finiteArg, finiteArg), ([x, y, z]) => {
        const out = f({ p: x, q: y, r: z });
        expect(finiteOrNaN(out)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe('typed and format round trip', () => {
  it('what format shows is read back as the same rounded number', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e12, max: 1e12, noNaN: true }), fc.integer({ min: 0, max: 8 }), (v, d) => {
        const shown = format(v, d);
        const back = parseTyped(shown);
        expect(back.ok, shown).toBe(true);
        if (back.ok) expect(back.value).toBeCloseTo(Number(v.toFixed(d)), 6);
      }),
      { numRuns: 1500 },
    );
  });
  it('Eastern Arabic-Indic digits read as the same number as Western digits', () => {
    const east = (s: string) => s.replace(/[0-9]/g, (c) => String.fromCodePoint(0x0660 + Number(c))).replace('.', '٫');
    const ext = (s: string) => s.replace(/[0-9]/g, (c) => String.fromCodePoint(0x06f0 + Number(c)));
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 999 }), (whole, frac) => {
        const text = `${whole}.${String(frac).padStart(3, '0')}`;
        const west = parseTyped(text);
        expect(west.ok).toBe(true);
        expect(parseTyped(east(text))).toEqual(west);
        expect(parseTyped(ext(`${whole}`))).toEqual(parseTyped(`${whole}`));
      }),
      { numRuns: 500 },
    );
  });
});

describe('the generators are not vacuous', () => {
  it('most generated expressions parse, many use loops, and some are expensive', () => {
    const samples = fc.sample(exprText, { numRuns: 600, seed: 7 });
    const parsed = samples.map((s) => parse(s, { scope: NAMES })).filter((p) => p.ok);
    expect(parsed.length).toBeGreaterThan(300);
    expect(samples.filter((s) => /\b(sum|prod)\(/.test(s)).length).toBeGreaterThan(60);
    const costs = parsed.map((p) => (p.ok ? staticCost(p.value) : 0));
    expect(Math.max(...costs)).toBeGreaterThan(1000);
    const values = parsed.map((p) => (p.ok ? compile(p.value)({ a: 3, b: 4, x: 5, y: 6, n: 7 }) : NaN));
    expect(values.filter((v) => Number.isFinite(v)).length).toBeGreaterThan(150);
  });
  it('the tree generator covers every operator and negation', () => {
    const texts = fc.sample(tree, { numRuns: 400, seed: 3 }).map((t) => minimal(t, 0));
    for (const op of ['+', '-', '*', '/', '^']) expect(texts.some((s) => s.includes(op)), op).toBe(true);
    expect(texts.some((s) => s.startsWith('-'))).toBe(true);
    expect(texts.some((s) => s.includes('('))).toBe(true);
  });
  it('token soup sometimes parses (so the evaluation branch runs)', () => {
    const soups = fc.sample(fc.array(fc.constantFrom('1', '2', '+', '*', 'a', '(', ')'), { maxLength: 8 }), { numRuns: 400, seed: 5 }).map((t) => t.join(''));
    expect(soups.filter((s) => parse(s, { scope: NAMES }).ok).length).toBeGreaterThan(20);
  });
});
