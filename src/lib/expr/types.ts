// The expression module's types and limits (topic-format section 3, AD-3).

export const LIMITS = {
  /** Source length of one expression, in characters. */
  sourceLength: 500,
  /** AST nodes in one expression. */
  nodes: 200,
  /** AST depth. */
  depth: 32,
  /** Arguments of one call. */
  args: 8,
  /** Iterations of one `sum` or `prod`. */
  loopIterations: 10_000,
  /** Evaluation steps in one call of a compiled expression. */
  steps: 20_000,
  /** Numeric results beyond this magnitude are NaN. */
  magnitude: 1e300,
  /** Characters of what a visitor types next to a slider. */
  typedLength: 40,
} as const;

export type ErrorCode = 'E_EXPR_SYNTAX' | 'E_EXPR_NONASCII' | 'E_EXPR_IDENT' | 'E_EXPR_FN' | 'E_EXPR_ARITY' | 'E_EXPR_LIMIT';

export interface ExprError {
  code: ErrorCode;
  /** Ready to show: the wording of topic-format section 5. */
  message: string;
  /** 1-based character position, 0 when the error is about the whole expression. */
  pos: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ExprError };

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^' | '<' | '<=' | '>' | '>=' | '==' | '!=' | '&&' | '||';
export type UnaryOp = '-' | '+' | '!';

/** Nodes are deeply frozen. A name is only ever looked up in the scope (never a function value). */
export type Node =
  | { readonly kind: 'num'; readonly value: number }
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'loopvar'; readonly slot: number }
  | { readonly kind: 'un'; readonly op: UnaryOp; readonly arg: Node }
  | { readonly kind: 'bin'; readonly op: BinaryOp; readonly left: Node; readonly right: Node }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly Node[] }
  | { readonly kind: 'loop'; readonly op: 'sum' | 'prod'; readonly slot: number; readonly lo: Node; readonly hi: Node; readonly body: Node };

export interface Expression {
  readonly src: string;
  readonly root: Node;
  /** Number of AST nodes. */
  readonly nodes: number;
  /** Scope names the expression reads, sorted. */
  readonly names: readonly string[];
}

export interface ParseOptions {
  /** The names the expression may read: parameters, derived ids, example inputs, loop variables. */
  scope?: Iterable<string>;
}
