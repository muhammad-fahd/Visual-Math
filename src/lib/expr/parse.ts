import { BUILTINS, FUNCTION_NAMES } from './functions';
import { LIMITS, type BinaryOp, type ErrorCode, type Expression, type ExprError, type Node, type ParseOptions, type Result, type UnaryOp } from './types';

// Lexer and recursive-descent parser for the grammar of topic-format section 3. It reads text and
// builds a frozen tree; it executes nothing and never throws to its caller.

const CONSTANTS: ReadonlyMap<string, number> = new Map([
  ['pi', Math.PI],
  ['e', Math.E],
  ['tau', 2 * Math.PI],
]);
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const COMPARE = new Set(['<', '<=', '>', '>=', '==', '!=']);

type Token = { type: 'num'; value: number; pos: number } | { type: 'ident'; name: string; pos: number } | { type: 'op'; op: string; pos: number } | { type: 'end'; pos: number };

/** Thrown inside the parser only; parse() turns it into a returned error. */
class Fail extends Error {
  constructor(readonly error: ExprError) {
    super(error.message);
  }
}

function fail(code: ErrorCode, message: string, pos: number): never {
  throw new Fail({ code, message, pos });
}

const syntax = (src: string, what: string, pos: number): never => fail('E_EXPR_SYNTAX', `Expression '${src}': ${what} at position ${pos}.`, pos);
const limit = (what: string, n: number, cap: number): never => fail('E_EXPR_LIMIT', `Expression is too large: ${what} ${n} exceeds ${cap}.`, 0);

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isIdentStart = (c: string) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_';
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c);

function lex(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const pos = i + 1;
    if (c.charCodeAt(0) > 127) {
      fail('E_EXPR_NONASCII', `Expression '${src}' contains a non-ASCII character at position ${pos}. Use ASCII only.`, pos);
    }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
      continue;
    }
    if (isDigit(c)) {
      let j = i;
      while (isDigit(src[j])) j += 1;
      if (src[j] === '.' && isDigit(src[j + 1])) {
        j += 1;
        while (isDigit(src[j])) j += 1;
      }
      if (src[j] === 'e' || src[j] === 'E') {
        const k = src[j + 1] === '+' || src[j + 1] === '-' ? j + 2 : j + 1;
        if (isDigit(src[k])) {
          j = k;
          while (isDigit(src[j])) j += 1;
        }
      }
      const value = Number(src.slice(i, j));
      if (!Number.isFinite(value) || value > LIMITS.magnitude) limit('number magnitude', Number.isFinite(value) ? value : Infinity, LIMITS.magnitude);
      tokens.push({ type: 'num', value, pos });
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < src.length && isIdentPart(src[j]!)) j += 1;
      tokens.push({ type: 'ident', name: src.slice(i, j), pos });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '&&' || two === '||') {
      tokens.push({ type: 'op', op: two, pos });
      i += 2;
      continue;
    }
    if ('+-*/%^()<>,!'.includes(c)) {
      tokens.push({ type: 'op', op: c, pos });
      i += 1;
      continue;
    }
    syntax(src, `unexpected character '${c}'`, pos);
  }
  tokens.push({ type: 'end', pos: src.length + 1 });
  return tokens;
}

interface Builder {
  nodes: number;
  readonly names: Set<string>;
}

function depthOf(node: Node): number {
  switch (node.kind) {
    case 'num':
    case 'var':
    case 'loopvar':
      return 1;
    case 'un':
      return 1 + depthOf(node.arg);
    case 'bin':
      return 1 + Math.max(depthOf(node.left), depthOf(node.right));
    case 'call':
      return 1 + node.args.reduce((m, a) => Math.max(m, depthOf(a)), 0);
    case 'loop':
      return 1 + Math.max(depthOf(node.lo), depthOf(node.hi), depthOf(node.body));
  }
}

function parseTokens(src: string, tokens: Token[], scope: ReadonlySet<string>): { root: Node; builder: Builder } {
  let at = 0;
  let nest = 0;
  const builder: Builder = { nodes: 0, names: new Set() };
  const loops: { name: string; slot: number }[] = [];

  const peek = (): Token => tokens[at]!;
  const next = (): Token => tokens[at++]!;
  const isOp = (t: Token, ...ops: string[]) => t.type === 'op' && ops.includes(t.op);
  const describe = (t: Token) => (t.type === 'end' ? 'end of expression' : t.type === 'num' ? `number ${t.value}` : t.type === 'ident' ? `name '${t.name}'` : `'${t.op}'`);

  /** Every node goes through here: it counts nodes and checks depth, and freezes the node. */
  function mk<N extends Node>(node: N): N {
    builder.nodes += 1;
    if (builder.nodes > LIMITS.nodes) limit('nodes', builder.nodes, LIMITS.nodes);
    const depth = depthOf(node);
    if (depth > LIMITS.depth) limit('depth', depth, LIMITS.depth);
    return Object.freeze(node);
  }

  function enter(): void {
    nest += 1;
    if (nest > 200) limit('nesting', nest, 200);
  }

  function expect(op: string): Token {
    const t = next();
    if (!isOp(t, op)) syntax(src, `expected '${op}' but found ${describe(t)}`, t.pos);
    return t;
  }

  function parseOr(): Node {
    let left = parseAnd();
    while (isOp(peek(), '||')) {
      next();
      left = mk({ kind: 'bin', op: '||', left, right: parseAnd() });
    }
    return left;
  }

  function parseAnd(): Node {
    let left = parseCompare();
    while (isOp(peek(), '&&')) {
      next();
      left = mk({ kind: 'bin', op: '&&', left, right: parseCompare() });
    }
    return left;
  }

  function parseCompare(): Node {
    const left = parseAdd();
    const t = peek();
    if (t.type === 'op' && COMPARE.has(t.op)) {
      next();
      const node = mk({ kind: 'bin', op: t.op as BinaryOp, left, right: parseAdd() });
      const after = peek();
      if (after.type === 'op' && COMPARE.has(after.op)) syntax(src, 'comparisons cannot be chained; join them with && or ||', after.pos);
      return node;
    }
    return left;
  }

  function parseAdd(): Node {
    let left = parseMul();
    for (let t = peek(); isOp(t, '+', '-'); t = peek()) {
      next();
      left = mk({ kind: 'bin', op: (t as { op: string }).op as BinaryOp, left, right: parseMul() });
    }
    return left;
  }

  function parseMul(): Node {
    let left = parseUnary();
    for (let t = peek(); isOp(t, '*', '/', '%'); t = peek()) {
      next();
      left = mk({ kind: 'bin', op: (t as { op: string }).op as BinaryOp, left, right: parseUnary() });
    }
    return left;
  }

  function parseUnary(): Node {
    const t = peek();
    if (isOp(t, '-', '+', '!')) {
      next();
      enter();
      const arg = parseUnary();
      nest -= 1;
      return mk({ kind: 'un', op: (t as { op: string }).op as UnaryOp, arg });
    }
    return parsePow();
  }

  function parsePow(): Node {
    const base = parseAtom();
    if (isOp(peek(), '^')) {
      next();
      enter();
      const exponent = parseUnary(); // right-associative, and `2^-3` works
      nest -= 1;
      return mk({ kind: 'bin', op: '^', left: base, right: exponent });
    }
    return base;
  }

  function parseArgs(): Node[] {
    const args: Node[] = [];
    if (isOp(peek(), ')')) {
      next();
      return args;
    }
    for (;;) {
      args.push(parseOr());
      if (args.length > LIMITS.args) limit('arguments', args.length, LIMITS.args);
      const t = next();
      if (isOp(t, ')')) return args;
      if (!isOp(t, ',')) syntax(src, `expected ',' or ')' but found ${describe(t)}`, t.pos);
    }
  }

  function parseLoop(op: 'sum' | 'prod', at1: Token): Node {
    expect('(');
    const v = next();
    if (v.type !== 'ident') return syntax(src, `${op} needs a name for its variable first, found ${describe(v)}`, v.pos);
    if (FORBIDDEN.has(v.name) || CONSTANTS.has(v.name)) {
      return fail('E_EXPR_IDENT', `Unknown name '${v.name}' in '${src}'. In scope here: a name that is not a constant.`, v.pos);
    }
    const comma = (): void => {
      const t = peek();
      if (isOp(t, ')')) fail('E_EXPR_ARITY', `${op} takes 4 argument(s), got fewer.`, at1.pos);
      expect(',');
    };
    comma();
    const lo = parseOr();
    comma();
    const hi = parseOr();
    comma();
    const slot = loops.length;
    loops.push({ name: v.name, slot });
    const body = parseOr();
    loops.pop();
    const close = next();
    if (!isOp(close, ')')) {
      if (isOp(close, ',')) return fail('E_EXPR_ARITY', `${op} takes 4 argument(s), got more.`, at1.pos);
      return syntax(src, `expected ')' but found ${describe(close)}`, close.pos);
    }
    return mk({ kind: 'loop', op, slot, lo, hi, body });
  }

  function parseAtom(): Node {
    const t = next();
    if (t.type === 'num') return mk({ kind: 'num', value: t.value });
    if (t.type === 'ident') {
      if (isOp(peek(), '(')) {
        if (t.name === 'sum' || t.name === 'prod') return parseLoop(t.name, t);
        const builtin = BUILTINS.get(t.name);
        if (!builtin) {
          return fail('E_EXPR_FN', `Function '${t.name}' is not allowed. Allowed: ${FUNCTION_NAMES.join(', ')}.`, t.pos);
        }
        next(); // (
        const args = parseArgs();
        if (args.length < builtin.min || args.length > builtin.max) {
          const k = builtin.min === builtin.max ? String(builtin.min) : `${builtin.min} to ${builtin.max}`;
          return fail('E_EXPR_ARITY', `${t.name} takes ${k} argument(s), got ${args.length}.`, t.pos);
        }
        return mk({ kind: 'call', name: t.name, args: Object.freeze(args) });
      }
      if (FORBIDDEN.has(t.name)) {
        return fail('E_EXPR_IDENT', `Unknown name '${t.name}' in '${src}'. In scope here: ${[...scope].join(', ') || '(nothing)'}.`, t.pos);
      }
      for (let i = loops.length - 1; i >= 0; i--) {
        if (loops[i]!.name === t.name) return mk({ kind: 'loopvar', slot: loops[i]!.slot });
      }
      const constant = CONSTANTS.get(t.name);
      if (constant !== undefined) return mk({ kind: 'num', value: constant });
      if (scope.has(t.name)) {
        builder.names.add(t.name);
        return mk({ kind: 'var', name: t.name });
      }
      return fail('E_EXPR_IDENT', `Unknown name '${t.name}' in '${src}'. In scope here: ${[...scope].join(', ') || '(nothing)'}.`, t.pos);
    }
    if (isOp(t, '(')) {
      enter();
      const inner = parseOr();
      nest -= 1;
      expect(')');
      return inner;
    }
    return syntax(src, `unexpected ${describe(t)}`, t.pos);
  }

  const root = parseOr();
  const rest = peek();
  if (rest.type !== 'end') syntax(src, `unexpected ${describe(rest)}`, rest.pos);
  return { root, builder };
}

/**
 * Parses author-mode source (strict, ASCII only). `scope` lists the names the expression may read.
 * Returns an error value, never throws, for every possible input.
 */
export function parse(src: string, options: ParseOptions = {}): Result<Expression> {
  try {
    if (typeof src !== 'string') return syntaxError('Expression must be text.');
    if (src.length > LIMITS.sourceLength) limit('source length', src.length, LIMITS.sourceLength);
    const scope = new Set(options.scope ?? []);
    const tokens = lex(src);
    const { root, builder } = parseTokens(src, tokens, scope);
    return { ok: true, value: Object.freeze({ src, root, nodes: builder.nodes, names: Object.freeze([...builder.names].sort()) }) };
  } catch (error) {
    if (error instanceof Fail) return { ok: false, error: error.error };
    // A bug, not an input problem; still never a throw to the caller.
    return syntaxError('Expression could not be read.');
  }
}

function syntaxError(message: string): Result<Expression> {
  return { ok: false, error: { code: 'E_EXPR_SYNTAX', message, pos: 0 } };
}
