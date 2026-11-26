import { BUILTINS } from './functions';
import { LIMITS, type BinaryOp, type Expression, type Node } from './types';

// The interpreter: the tree is turned into nested closures, one per node, and run with a step
// counter. There is no eval, no new Function and no dynamic code: a closure only ever does the
// arithmetic of its own node. Anything undefined is NaN; a runaway evaluation is cut at the budget.

export type Scope = Readonly<Record<string, number>>;

export interface CompileOptions {
  /** Called when an evaluation hit the step budget (a validator miss, worth logging as `expr.budget_exceeded`). */
  onBudgetExceeded?: (expression: Expression) => void;
}

export type Evaluate = (scope?: Scope) => number;

interface Env {
  readonly scope: Scope;
  readonly slots: number[];
  steps: number;
}

type Fn = (env: Env) => number;

/** Thrown inside an evaluation only, and always caught in the same call. */
const BUDGET = Symbol('budget');

/** Any non-finite or huge result is "undefined", at every node. */
const fin = (x: number): number => (Number.isFinite(x) && Math.abs(x) <= LIMITS.magnitude ? x : NaN);

const ownNumber = (scope: Scope, name: string): number => {
  if (scope === null || typeof scope !== 'object' || !Object.hasOwn(scope, name)) return NaN;
  const v: unknown = scope[name];
  return typeof v === 'number' ? fin(v) : NaN;
};

const MAX_STEPS = LIMITS.steps;

function step(env: Env, n = 1): void {
  if ((env.steps += n) > MAX_STEPS) throw BUDGET;
}

const bool = (b: boolean): number => (b ? 1 : 0);

function binary(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case '+':
      return fin(a + b);
    case '-':
      return fin(a - b);
    case '*':
      return fin(a * b);
    case '/':
      return b === 0 ? NaN : fin(a / b);
    case '%': {
      if (b === 0) return NaN;
      const r = a % b;
      return fin(r !== 0 && r < 0 !== b < 0 ? r + b : r);
    }
    case '^':
      return fin(Math.pow(a, b));
    case '<':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a < b);
    case '<=':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a <= b);
    case '>':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a > b);
    case '>=':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a >= b);
    case '==':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a === b);
    case '!=':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a !== b);
    case '&&':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a !== 0 && b !== 0);
    case '||':
      return Number.isNaN(a) || Number.isNaN(b) ? NaN : bool(a !== 0 || b !== 0);
  }
}

function build(node: Node): Fn {
  switch (node.kind) {
    case 'num': {
      const value = node.value;
      return (env) => {
        step(env);
        return value;
      };
    }
    case 'var': {
      const name = node.name;
      return (env) => {
        step(env);
        return ownNumber(env.scope, name);
      };
    }
    case 'loopvar': {
      const slot = node.slot;
      return (env) => {
        step(env);
        return env.slots[slot] ?? NaN;
      };
    }
    case 'un': {
      const arg = build(node.arg);
      const op = node.op;
      return (env) => {
        step(env);
        const v = arg(env);
        if (op === '!') return Number.isNaN(v) ? NaN : bool(v === 0);
        return op === '-' ? fin(-v) : v;
      };
    }
    case 'bin': {
      const left = build(node.left);
      const right = build(node.right);
      const op = node.op;
      // Both sides always run (no short circuit), so the static cost bounds the real cost.
      return (env) => {
        step(env);
        const a = left(env);
        const b = right(env);
        return binary(op, a, b);
      };
    }
    case 'call': {
      const builtin = BUILTINS.get(node.name);
      if (!builtin) return () => NaN; // unreachable for a parsed tree; defensive
      const args = node.args.map(build);
      // One array per call site, refilled on every evaluation: nothing is allocated per call. Safe
      // because a node never runs inside itself (there is no recursion), and the builtins do not keep it.
      const values: number[] = new Array<number>(args.length).fill(0);
      return (env) => {
        step(env);
        for (let i = 0; i < args.length; i++) values[i] = args[i]!(env);
        if (builtin.steps) step(env, builtin.steps(values));
        return fin(builtin.run(values));
      };
    }
    case 'loop': {
      const lo = build(node.lo);
      const hi = build(node.hi);
      const body = build(node.body);
      const slot = node.slot;
      const isSum = node.op === 'sum';
      return (env) => {
        step(env);
        const from = lo(env);
        const to = hi(env);
        if (!Number.isInteger(from) || !Number.isInteger(to)) return NaN;
        if (to < from) return isSum ? 0 : 1; // an empty range
        if (to - from + 1 > LIMITS.loopIterations) return NaN;
        let acc = isSum ? 0 : 1;
        for (let i = from; i <= to; i++) {
          step(env);
          env.slots[slot] = i;
          const v = body(env);
          if (Number.isNaN(v)) return NaN;
          acc = fin(isSum ? acc + v : acc * v);
          if (Number.isNaN(acc)) return NaN;
        }
        return acc;
      };
    }
  }
}

export interface Detailed {
  value: number;
  /** Steps used (up to the budget). */
  steps: number;
  budgetExceeded: boolean;
}

/** Compiles a parsed expression to a closure over its frozen tree. */
export function compile(expression: Expression, options: CompileOptions = {}): Evaluate {
  const run = build(expression.root);
  return (scope = {}) => {
    const env: Env = { scope, slots: [], steps: 0 };
    try {
      return fin(run(env));
    } catch (error) {
      if (error === BUDGET) {
        options.onBudgetExceeded?.(expression);
        return NaN;
      }
      return NaN; // never a throw: an unexpected fault is "undefined"
    }
  };
}

/** Like compile, and also reports the steps used. For tests and for checking the static cost. */
export function evaluateDetailed(expression: Expression, scope: Scope = {}): Detailed {
  const env: Env = { scope, slots: [], steps: 0 };
  try {
    return { value: fin(build(expression.root)(env)), steps: env.steps, budgetExceeded: false };
  } catch (error) {
    return { value: NaN, steps: Math.min(env.steps, LIMITS.steps + 1), budgetExceeded: error === BUDGET };
  }
}

const CAP = Number.MAX_SAFE_INTEGER;

/**
 * The most steps one evaluation can use, worst case over every scope: nodes, the extra work of
 * looping builtins, and loop iterations (the constant range when both bounds are numbers, else the
 * 10000 limit). Used at upload for the scene cost (E_SCENE_COST). Capped at 2^53 - 1.
 */
export function staticCost(expression: Expression): number {
  const cost = (node: Node): number => {
    switch (node.kind) {
      case 'num':
      case 'var':
      case 'loopvar':
        return 1;
      case 'un':
        return Math.min(CAP, 1 + cost(node.arg));
      case 'bin':
        return Math.min(CAP, 1 + cost(node.left) + cost(node.right));
      case 'call':
        return Math.min(CAP, 1 + node.args.reduce((s, a) => s + cost(a), 0) + (BUILTINS.get(node.name)?.maxSteps ?? 0));
      case 'loop': {
        const range =
          node.lo.kind === 'num' && node.hi.kind === 'num' && Number.isInteger(node.lo.value) && Number.isInteger(node.hi.value)
            ? Math.min(LIMITS.loopIterations, Math.max(0, node.hi.value - node.lo.value + 1))
            : LIMITS.loopIterations;
        return Math.min(CAP, 1 + cost(node.lo) + cost(node.hi) + range * (1 + cost(node.body)));
      }
    }
  };
  return cost(expression.root);
}
