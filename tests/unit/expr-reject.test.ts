import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIMITS, FUNCTION_NAMES, compile, parse, type ErrorCode, type Node } from '../../src/lib/expr';

function err(src: string, scope: string[] = []) {
  const p = parse(src, { scope });
  if (p.ok) throw new Error(`should not parse: ${src}`);
  return p.error;
}
const code = (src: string, scope: string[] = []): ErrorCode => err(src, scope).code;

describe('what is rejected, with the code of topic-format section 5', () => {
  it('unknown functions (E_EXPR_FN), including ones that name JavaScript machinery', () => {
    for (const src of ['foo(1)', 'eval(1)', 'Function(1)', 'toString(1)', 'constructor(1)', '__proto__(1)', 'hasOwnProperty(1)', 'valueOf()', 'SIN(1)', 'Math(1)', 'import(1)', 'require(1)']) {
      expect(code(src), src).toBe('E_EXPR_FN');
    }
    const e = err('foo(1)');
    expect(e.message).toMatch(/^Function 'foo' is not allowed\. Allowed: abs, acos,/);
    expect(e.message).toContain('nCr');
    expect(e.pos).toBe(1);
  });

  it('unknown names (E_EXPR_IDENT), naming what is in scope', () => {
    const e = err('x+1', ['r', 'h']);
    expect(e.code).toBe('E_EXPR_IDENT');
    expect(e.message).toBe("Unknown name 'x' in 'x+1'. In scope here: r, h.");
    expect(e.pos).toBe(1);
    expect(err('y', []).message).toContain('(nothing)');
    for (const src of ['PI', 'Pi', 'E', 'infinity', 'NaN', 'undefined', 'null', 'true', 'false', 'window', 'process', 'globalThis', 'this', 'length']) {
      expect(code(src), src).toBe('E_EXPR_IDENT');
    }
  });

  it('__proto__, constructor and prototype are never identifiers, even when listed in the scope', () => {
    for (const name of ['__proto__', 'constructor', 'prototype']) {
      expect(code(name, [name]), name).toBe('E_EXPR_IDENT');
      expect(code(`1+${name}`, [name]), name).toBe('E_EXPR_IDENT');
      expect(code(`sum(${name},1,2,1)`), name).toBe('E_EXPR_IDENT'); // nor a loop variable
    }
    expect(code('sum(pi,1,2,1)')).toBe('E_EXPR_IDENT'); // nor a constant as a loop variable
  });

  it('wrong number of arguments (E_EXPR_ARITY)', () => {
    expect(err('sin()').message).toBe('sin takes 1 argument(s), got 0.');
    expect(err('sin(1,2)').message).toBe('sin takes 1 argument(s), got 2.');
    expect(err('min(1)').message).toBe('min takes 2 to 8 argument(s), got 1.');
    expect(code('atan2(1)')).toBe('E_EXPR_ARITY');
    expect(code('clamp(1,2)')).toBe('E_EXPR_ARITY');
    expect(code('if(1,2)')).toBe('E_EXPR_ARITY');
    expect(code('binompmf(1,2)')).toBe('E_EXPR_ARITY');
    expect(code('sum(i,1,2)')).toBe('E_EXPR_ARITY');
    expect(code('sum(i,1,2,3,4)')).toBe('E_EXPR_ARITY');
    expect(code('prod(i,1,2)')).toBe('E_EXPR_ARITY');
    expect(code('pi(1)')).toBe('E_EXPR_FN'); // a constant is not a function
  });

  it('non-ASCII text (E_EXPR_NONASCII), with the 1-based position', () => {
    expect(err('2٣')).toMatchObject({ code: 'E_EXPR_NONASCII', pos: 2 });
    expect(err('2٣').message).toBe("Expression '2٣' contains a non-ASCII character at position 2. Use ASCII only.");
    for (const src of ['x²', '１+１', 'é', 'sin(1) ', '1− 2', '1 – 2', 'π', '١', '1​+1', '\u{1F600}']) {
      expect(code(src, ['x']), src).toBe('E_EXPR_NONASCII');
    }
    expect(err('x²', ['x']).pos).toBe(2);
  });

  it('syntax errors (E_EXPR_SYNTAX), each with a position', () => {
    for (const src of [
      '2x', '2(3)', '(1)(2)', 'pi x', '1<2<3', '1==2==3', '1<2>0', '.5', '5.', '1 +', '', '   ', '\n', '+', '*2', '2**3', '1//2', '1 2', '(', ')', '1)', '(1', 'sin(1',
      'sin(,1)', 'sin(1,)', '1,2', ',', '1e', '1e+', '0x10', '1_000', '1,000', '1=1', 'x=1', '=', '&', '|', '1&2', '1|2', ';', '1;2', '"a"', "'a'", '`a`',
      '[1]', '{1}', '1[0]', 'a.b', '1.2.3', '@', '#', '$', '~', '\\', '?', ':', '1?2:3', '<', '1<', '>=1', '!', '1!', '1!2', 'x y', '2 pi',
    ]) {
      const p = parse(src, { scope: ['a', 'x', 'y'] });
      expect(p.ok, src).toBe(false);
      if (!p.ok) {
        expect(p.error.code, src).toBe('E_EXPR_SYNTAX');
        expect(p.error.pos, src).toBeGreaterThan(0);
        expect(p.error.message, src).toMatch(/^Expression '.*': .* at position \d+\.$/s);
      }
    }
    expect(err('1 +').message).toBe("Expression '1 +': unexpected end of expression at position 4.");
    expect(err('2x', ['x']).message).toBe("Expression '2x': unexpected name 'x' at position 2.");
    expect(err('1<2<3').message).toContain('comparisons cannot be chained');
  });

  it('whitespace is allowed anywhere between tokens and never changes the meaning', () => {
    for (const src of [' 1+2 ', '1 + 2', '1\t+\n2', '\r\n1+2\r\n', ' sin ( 1 ) ']) expect(parse(src).ok, src).toBe(true);
    const spaced = parse('1 + 2');
    if (!spaced.ok) throw new Error('parse');
    expect(compile(spaced.value)()).toBe(3);
  });
});

describe('caps (E_EXPR_LIMIT)', () => {
  const limit = (src: string, scope: string[] = []) => {
    const e = err(src, scope);
    expect(e.code, src.slice(0, 40)).toBe('E_EXPR_LIMIT');
    return e.message;
  };
  it('source length 500', () => {
    expect(limit('1'.repeat(501))).toBe('Expression is too large: source length 501 exceeds 500.');
    expect(limit(' '.repeat(501))).toContain('source length');
    expect(parse('1' + ' '.repeat(499)).ok).toBe(true); // exactly 500
    expect(parse('1' + ' '.repeat(500)).ok).toBe(false);
  });
  it('200 AST nodes', () => {
    const leaf = 'min(1,2,3,4,5,6,7,8)'; // 9 nodes
    const wide = (n: number) => Array(n).fill(leaf).join('+'); // n * 9 + (n - 1) nodes, depth about n + 2
    expect(wide(21).length).toBeLessThan(500);
    expect(parse(wide(20)).ok).toBe(true); // 20 * 9 + 19 = 199 nodes
    expect(limit(wide(21))).toBe('Expression is too large: nodes 201 exceeds 200.'); // 209 in all; refused at the 201st
  });
  it('AST depth 32', () => {
    const chain = (k: number) => Array(k).fill('1').join('+'); // a left-deep chain of depth k
    expect(parse(chain(32)).ok).toBe(true);
    expect(limit(chain(33))).toBe('Expression is too large: depth 33 exceeds 32.');
    expect(limit('-'.repeat(40) + '1')).toContain('depth');
    expect(limit('!'.repeat(40) + '1')).toContain('depth');
    expect(limit('2^'.repeat(40) + '2')).toContain('depth');
    expect(parse('-'.repeat(31) + '1').ok).toBe(true);
  });
  it('nesting of parentheses is bounded, so a hostile string cannot exhaust the stack', () => {
    expect(parse('('.repeat(150) + '1' + ')'.repeat(150)).ok).toBe(true);
    expect(limit('('.repeat(201) + '1' + ')'.repeat(201))).toContain('nesting');
    expect(parse('('.repeat(240) + '1').ok).toBe(false); // too long, or unbalanced: either way refused, never a crash
  });
  it('8 call arguments', () => {
    expect(parse('min(1,2,3,4,5,6,7,8)').ok).toBe(true);
    expect(limit('min(1,2,3,4,5,6,7,8,9)')).toBe('Expression is too large: arguments 9 exceeds 8.');
    expect(limit('sin(1,2,3,4,5,6,7,8,9)')).toContain('arguments');
  });
  it('the module limits are the documented ones', () => {
    expect(LIMITS).toMatchObject({ sourceLength: 500, nodes: 200, depth: 32, args: 8, loopIterations: 10000, steps: 20000, magnitude: 1e300, typedLength: 40 });
  });
});

describe('hostile input: text is only ever read, never run', () => {
  const payloads = [
    "constructor.constructor('return process')()",
    "this.constructor.constructor('return 1')()",
    '__proto__.polluted = 1',
    "({}).constructor",
    "[].constructor.constructor('return 1')()",
    'process.exit()',
    'globalThis',
    '(function(){ return 1 })()',
    '(() => 1)()',
    'x => x',
    "import('fs')",
    'require("fs")',
    '`${1+1}`',
    "a['b']",
    'a.b.c',
    '1; process.exit()',
    "eval('1')",
    "Function('return 1')()",
    'new Function("return 1")',
    'while(1){}',
    'for(;;){}',
    '1 /* c */ + 1',
    '1 // c',
    '<script>alert(1)</script>',
    '${1}',
    '{{1}}',
    '%s',
    '\u0000',
    '1\u0000',
    'sin(1)\n; drop',
  ];
  it.each(payloads)('%s', (src) => {
    const p = parse(src, { scope: ['a', 'x'] });
    expect(p.ok).toBe(false);
  });
  it('nothing leaks onto Object.prototype or the global object', () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort().join();
    for (const src of payloads) {
      const p = parse(src, { scope: ['a', 'x'] });
      if (p.ok) compile(p.value)({ a: 1, x: 2 });
    }
    expect(Object.getOwnPropertyNames(Object.prototype).sort().join()).toBe(before);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect((globalThis as Record<string, unknown>)['polluted']).toBeUndefined();
  });
  it('a scope with an own __proto__ key is never read through that name', () => {
    const scope = JSON.parse('{"__proto__": 5, "a": 1}') as Record<string, number>;
    expect(parse('__proto__', { scope: Object.keys(scope) }).ok).toBe(false);
    const p = parse('a', { scope: ['a'] });
    if (!p.ok) throw new Error('parse');
    expect(compile(p.value)(scope)).toBe(1);
  });
  it('non-string input is an error value, not a throw', () => {
    for (const src of [undefined, null, 1, {}, [], () => 1, Symbol('s')]) {
      const p = parse(src as unknown as string);
      expect(p.ok).toBe(false);
    }
  });
  it('the tree is deeply frozen', () => {
    const p = parse('sum(i,1,3,min(i,2)+x*-1)', { scope: ['x'] });
    if (!p.ok) throw new Error('parse');
    const seen = new Set<unknown>();
    const check = (n: unknown): void => {
      if (typeof n !== 'object' || n === null || seen.has(n)) return;
      seen.add(n);
      expect(Object.isFrozen(n)).toBe(true);
      for (const v of Object.values(n)) check(v);
    };
    check(p.value);
    expect(seen.size).toBeGreaterThan(8);
    const root = p.value.root as { op: string };
    expect(() => {
      (root as { op: string }).op = 'prod';
    }).toThrow(TypeError);
    expect(() => {
      (p.value.names as string[]).push('y');
    }).toThrow(TypeError);
  });
  it('error positions point inside the text', () => {
    for (const src of ['2x', '1 +', 'foo(', '2٣', '1<2<3']) {
      const p = parse(src, { scope: ['x'] });
      if (!p.ok) expect(p.error.pos).toBeLessThanOrEqual(src.length + 1);
    }
  });
});

describe('the module never uses what it forbids others to use (AD-3)', () => {
  const dir = new URL('../../src/lib/expr/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  it('has the files we expect', () => {
    expect(files.sort()).toEqual(['compile.ts', 'format.ts', 'functions.ts', 'index.ts', 'parse.ts', 'typed.ts', 'types.ts']);
  });
  it.each(['compile.ts', 'format.ts', 'functions.ts', 'index.ts', 'parse.ts', 'typed.ts', 'types.ts'])('%s has no eval, Function constructor, dynamic import or outside import', (f) => {
    const text = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(text).not.toMatch(/(?<![\w$.])eval\s*\(/);
    expect(text).not.toMatch(/new\s+Function/);
    expect(text).not.toMatch(/(?<![\w$.])Function\s*\(/);
    expect(text).not.toMatch(/\bimport\s*\(/);
    expect(text).not.toMatch(/\brequire\s*\(/);
    expect(text).not.toMatch(/from\s+['"](?!\.\/)/); // only sibling modules: no npm package, no other layer
    expect(text).not.toMatch(/mathjs|expr-eval/);
  });
  it('FUNCTION_NAMES is sorted and has no JavaScript machinery in it', () => {
    expect([...FUNCTION_NAMES]).toEqual([...FUNCTION_NAMES].sort());
    for (const n of ['eval', 'Function', 'constructor', 'toString', '__proto__']) expect(FUNCTION_NAMES).not.toContain(n);
  });
});

describe('a parsed expression is a plain description', () => {
  it('exposes source, node count and names, and a node tree of known kinds only', () => {
    const p = parse('a*2+sum(i,1,3,i)', { scope: ['a'] });
    if (!p.ok) throw new Error('parse');
    expect(p.value.src).toBe('a*2+sum(i,1,3,i)');
    expect(p.value.nodes).toBe(8); // a, 2, *, 1, 3, i, the loop, +
    const kinds = new Set<string>();
    const walk = (n: Node): void => {
      kinds.add(n.kind);
      for (const k of ['arg', 'left', 'right', 'lo', 'hi', 'body'] as const) if (k in n) walk((n as unknown as Record<string, Node>)[k]!);
      if (n.kind === 'call') n.args.forEach(walk);
    };
    walk(p.value.root);
    expect([...kinds].sort()).toEqual(['bin', 'loop', 'loopvar', 'num', 'var']);
  });
});
