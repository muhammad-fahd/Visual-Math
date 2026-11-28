import { compile, parse, type Evaluate } from '../expr';

// The numbers a scene is drawn from (topic-format 2.1 rule 1): the parameters, then each `derived`
// value in order. A scope has no prototype; a value that cannot be computed is NaN and is shown as a dash.

export interface DerivedSpec {
  readonly id: string;
  readonly expr: string;
}

export type Scope = Readonly<Record<string, number>>;

export interface Program {
  /** Every parameter and derived value for these parameter values. */
  scope(params: Scope): Scope;
  /** One expression (a dimension, a readout, a formula placeholder) against that scope; NaN if it does not compile. */
  evaluate(source: string | number, scope: Scope): number;
  /** An expression of one more variable (`x` of a graph, `t` of a path) as a function of it, the rest from `scope`; always returns NaN if it does not compile. */
  fn(source: string, variable: string, scope: Scope): (value: number) => number;
  /** An expression of two more variables (`x` and `y` of a surface) as a function of them (Story 4.5); NaN if it does not compile. */
  fn2(source: string, variables: readonly [string, string], scope: Scope): (a: number, b: number) => number;
}

/** `parameterIds` are the names an expression may read besides the derived ids. */
export function createProgram(parameterIds: readonly string[], derived: readonly DerivedSpec[] = []): Program {
  const names = [...parameterIds, ...derived.map((d) => d.id)];
  const cache = new Map<string, Evaluate | null>();
  const functions = new Map<string, Evaluate | null>();
  const get = (source: string): Evaluate | null => {
    if (cache.has(source)) return cache.get(source)!;
    const r = parse(source, { scope: names });
    const fn = r.ok ? compile(r.value) : null;
    cache.set(source, fn);
    return fn;
  };
  return {
    scope(params) {
      const out: Record<string, number> = Object.assign(Object.create(null) as Record<string, number>, params);
      for (const d of derived) {
        const fn = get(d.expr);
        out[d.id] = fn ? fn(out) : NaN;
      }
      return out;
    },
    fn(source, variable, scope) {
      const key = `${variable}|${source}`;
      let run = functions.get(key);
      if (run === undefined) {
        const r = parse(source, { scope: [...names, variable] });
        run = r.ok ? compile(r.value) : null;
        functions.set(key, run);
      }
      if (!run) return () => NaN;
      const env: Record<string, number> = Object.assign(Object.create(null) as Record<string, number>, scope);
      return (value) => {
        env[variable] = value;
        return run!(env);
      };
    },
    fn2(source, variables, scope) {
      const [va, vb] = variables;
      const key = `${va},${vb}|${source}`;
      let run = functions.get(key);
      if (run === undefined) {
        const r = parse(source, { scope: [...names, va, vb] });
        run = r.ok ? compile(r.value) : null;
        functions.set(key, run);
      }
      if (!run) return () => NaN;
      const env: Record<string, number> = Object.assign(Object.create(null) as Record<string, number>, scope);
      return (a, b) => {
        env[va] = a;
        env[vb] = b;
        return run!(env);
      };
    },
    evaluate(source, scope) {
      if (typeof source === 'number') return Number.isFinite(source) ? source : NaN;
      const fn = get(source);
      return fn ? fn(scope) : NaN;
    },
  };
}
