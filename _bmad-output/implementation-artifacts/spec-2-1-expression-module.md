---
title: 'Story 2.1: Expression module'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: 'e02f58b66723edab1c409fb2dc593d7a49737460'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/topic-format.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Topics carry expression strings (formulas, slider ranges, plotted curves). Nothing can read them yet, and an evaluator that executes text, or one that can freeze a phone, would make every later story unsafe.

**Approach:** Build `src/lib/expr/`, pure and dependency-free, exactly as topic-format section 3 defines it: a hand-written parser to a frozen AST, a closure interpreter with a step budget, a typed-input normalizer, a display formatter, and a static cost function for the upload-time scene cost. Prove it with known values, a precedence oracle, grammar and security tests, and property and fuzz tests.

## Boundaries & Constraints

**Always:** Section 3 of `topic-format.md` is the contract (grammar, whitelist, arities, caps, error codes). `lib` imports nothing from the repo and nothing from npm. Nothing in the module ever throws for any input string or scope: parse errors are returned values, runtime problems are NaN. Identifiers resolve only against the given scope names, the constants `pi`, `e`, `tau`, and enclosing loop variables; scope values are read with own-property lookups only. `__proto__`, `constructor` and `prototype` are never identifiers. Every node and builtin call costs steps; `sum` and `prod` cost their iterations times the body; the per-call budget is 20000 and exceeding it returns NaN. The static cost is never below the steps an evaluation can use.

**Never:** No `eval`, `new Function`, dynamic import, regex-built code, `mathjs` or `expr-eval`. No implicit multiplication, no quiz-answer grammar (FR-11.2 is later). No i18n or React here. No wiring into the topic schema (Story 2.2) or sliders (Story 2.4).

**Decisions (mine, recorded):**
- `&&`, `||` and `if` evaluate every operand (no short circuit), so the static cost bounds the real cost. Comparisons do not chain (`1<2<3` is E_EXPR_SYNTAX). `%` means `mod` (the divisor's sign).
- Constants are folded to numbers at parse (`pi` costs one node). Numbers need digits on both sides of a point (`.5` and `5.` are syntax errors in author mode); typed mode is lenient about both.
- `format(value, decimals)` gives fixed decimals with Western digits and a real minus sign (U+2212); NaN and infinities give an em dash; a value that rounds to zero has no sign.
- `normcdf` uses the Abramowitz and Stegun 7.1.26 erf approximation (error below 1.5e-7) with `normcdf(mean) = 0.5` exact.
- Results beyond 1e300 in magnitude, and any non-finite result, are NaN at every node.
- `lo` and `hi` of `sum` and `prod` are rounded to integers by requiring them to be integers: a non-integer bound is NaN. More than 10000 iterations is NaN (and it also exceeds the budget).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Known values | `sin(rad(30))`, `nCr(5,2)`, `normcdf(0,0,1)`, `fact(5)`, `gcd(12,18)`, `-2^2`, `2^3^2` | 0.5, 10, 0.5, 120, 6, -4, 512 | N/A |
| Whitelist | every function of section 3 at its arity | parses and evaluates | N/A |
| Unknown function | `foo(1)`, `eval(1)`, `toString(1)` | `E_EXPR_FN` | no throw |
| Unknown name | `x` not in scope; `__proto__`; `constructor` even when in scope | `E_EXPR_IDENT` | no throw |
| Arity | `sin()`, `sin(1,2)`, `min(1)`, `min(1,..9 args)` | `E_EXPR_ARITY` | no throw |
| Non-ASCII | `2٣`, `x²`, fullwidth digits | `E_EXPR_NONASCII` with position | no throw |
| Syntax | `2x`, `1<2<3`, `.5`, `1 +`, `a.b`, `[1]`, `x=1`, quotes | `E_EXPR_SYNTAX` | no throw |
| Caps | 501 chars; 201 nodes; depth 33; 9 call arguments | `E_EXPR_LIMIT` naming the cap | no throw |
| Domain | `sqrt(-1)`, `ln(0)`, `1/0`, `tan(pi/2)`, `asin(2)`, `fact(171)`, `nCr(1001,2)`, `binompmf(1001,1,.5)` | NaN | never throws |
| Budget | `sum(i,1,10000,i)` (about 30000 steps) | NaN and the hook is told | no throw |
| Loops | `sum(i,1,4,i^2)` = 30; `prod(i,1,5,i)` = 120; nested; empty range (`lo>hi`) = 0 / 1 | as stated | non-integer bound NaN |
| Scope | scope `{r: 2}`; `r` missing at run time; inherited `toString` | uses own values; missing is NaN | no throw |
| Typed | `٣٫١٤`, `۱۲`, `−5`, ` 1٬000 `, `1e3` | 3.14, 12, -5, 1000, 1000 | not one finite number (`abc`, `1+1`, empty, `1 2`, `NaN`, `Infinity`, 41 chars) is `{ok:false}` |
| Format | `format(94.2478,1)`, `format(-3,0)`, `format(-0.001,1)`, `format(NaN,2)` | `94.2`, `−3`, `0.0`, `—` | N/A |
| Static cost | any parsed expression | at least the steps of any evaluation | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/index.ts`, `src/lib/format/index.ts` -- the `lib` pattern: pure modules, barrel, tests in `tests/unit`. `lib/format` is for page text; `expr.format` is for formula results.
- `eslint.config.mjs` -- `lib` may import only `lib`; no-eval and no-new-func rules already apply; `no-restricted-syntax` forbids hex-like string literals and physical CSS strings (avoid such literals in tests).
- `tests/unit/*.test.ts`, `vitest.config.ts` -- test location; fast-check 4.11.0 is a devDependency.
- `topic-format.md` section 3 and section 5 -- the contract and error message patterns.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/expr/types.ts` -- `Ast`, `ExprError`, `Result`, limits and constants
- [x] `src/lib/expr/lex.ts`, `parse.ts` -- lexer and parser with caps, scope resolution, arity and whitelist checks
- [x] `src/lib/expr/functions.ts` -- the whitelist with arities, domain rules and input caps
- [x] `src/lib/expr/compile.ts` -- closure interpreter, step budget, NaN rules; `staticCost`
- [x] `src/lib/expr/typed.ts`, `format.ts`, `index.ts` -- typed input, formatter, public API
- [x] `tests/unit/expr-*.test.ts` -- known values, grammar and rejects, security, typed, format, property and fuzz
- [x] `docs/coding-standard.md`, `deferred-work.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given the grammar and whitelist of topic-format section 3, `parse` and `compile` accept every function listed and reject any other name, `__proto__` and non-ASCII.
- Given fuzz and property tests, no input throws, domain errors return NaN, and the 20000-step budget is enforced.
- Given the typed value beside a slider, typed mode normalizes Eastern Arabic-Indic digits and rejects anything but one finite number.
- Given known values (sin 30 = 0.5, nCr(5,2) = 10, normcdf(0) = 0.5), unit tests pass.


## Review Triage Log

Inline review by the implementer (the owner chose no subagents for this story), over the full diff, plus three deliberate breakages to prove the tests bite: left-associative `^` (caught by 9 tests), a static cost that ignores builtin work (caught by the cost property), an inherited-scope lookup (caught by 2 tests).

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| Interpreter allocated an array per call and used about 45 ns per step | medium | patch: one array per call site; about 20 ns per step; tests unchanged and green |
| 3,000,000 steps per frame (AD-3) is about 60 ms on this desktop at 20 ns per step, above a 33 ms frame | medium | defer: calibrate the scene cost cap with real devices in Story 2.4; the cap is a ceiling, typical scenes use thousands |
| Spec matrix "Arity: min with 9 args is E_EXPR_ARITY" contradicts "Caps: 9 call arguments is E_EXPR_LIMIT" | low | resolved as LIMIT (the cap is checked while reading arguments); recorded here because the frozen block is not edited |
| `fact` accepts 0 to 170 but 167! and above exceed the 1e300 cap, so `fact(167)` is NaN | low | accept: both rules are in section 3; documented in tests |
| The example `sum(i,1,10000,i)` costs about 20003 steps, not 30000 | low | accept: still above the budget, so still NaN |
| The first error wins in left-to-right order: a syntax error before a non-ASCII character is reported as syntax | low | accept |
| `evaluateDetailed` is public although only tests and Story 2.2 use it | low | accept: it is how the scene cost is checked against the real cost |
| Static cost of a loop with a negative-literal bound uses 10000 iterations (a unary minus is not a constant node) | low | accept: conservative, never below the real cost |
| `Object.hasOwn` needs Chrome 93, Safari 15.4, Firefox 92 | low | accept: inside the browserslist (Chrome 111, Safari 16.4, Firefox 128) |
| `typed` mode drops all whitespace, so `1 2` reads as 12 | low | accept: follows topic-format section 3 ("drop whitespace") |

## Implementation Notes
- `src/lib/expr/` (types, functions, parse, compile, typed, format, index): 7 files, about 650 lines. Public API: `parse`, `compile`, `evaluateDetailed`, `staticCost`, `parseTyped`, `format`, `LIMITS`, `FUNCTION_NAMES`.
- Error positions are 1-based. Messages use the wording of topic-format section 5.
- Decisions as in the frozen block; additionally: `sum` and `prod` reject a constant or forbidden name as the loop variable; a nesting guard of 200 stops hostile parenthesis stacks; a number literal above 1e300 is E_EXPR_LIMIT.
- Tests: 757 in the repository now (about 350 new): `expr-values` (known values, whitelist table of 45, loops, budget), `expr-reject` (codes, caps, hostile payloads, the module scanning its own source), `expr-typed-format`, `expr-property` (fuzz, parser oracle, cost bound, determinism, builtins on arbitrary numbers, non-vacuity checks).
- Speed: about 20 ns per step after removing per-call allocation (measured, then deleted: a one-off script).
