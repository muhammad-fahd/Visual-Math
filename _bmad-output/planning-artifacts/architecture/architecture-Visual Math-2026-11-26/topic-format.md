---
name: Visual Math topic package format
type: topic-format-contract
schemaVersion: 1
status: final
updated: 2026-11-26
governs: AD-1 to AD-5, AD-14, AD-19 of ARCHITECTURE-SPINE.md
source: docs/srs.md section 5.7 (content package), FR-9.2, FR-9.3, FR-9.15, FR-11.1
audience: the per-category topic prompts (Claude authors), the import service, scene renderers
---

# Topic package format v1

One topic is one file, either JSON or MD (SRS 5.7). Both describe the same fields and are read into one internal object, which is validated by one pipeline. Declarative only: no code, no HTML, no URLs, no hex colors. Anything that looks like a program is rejected at upload (FR-9.15). The Zod schema in `src/lib/topic-schema/` is the source of truth; this document is its human contract. Where the two differ, the schema wins and this file is a bug.

This file replaces `lesson-format.md` of the first architecture. Changes: "lesson" is now "topic"; quizzes, answer keys, `authoring` and the quality-bar block are removed (quizzes are later, FR-11.2); `quiz` is a reserved empty field (FR-11.1); the worked example has changeable inputs (FR-4.4); a `summary`, `tags`, `tryThis` and `watchOut` are added (FR-4.1, 4.5, 4.7); an MD layout is defined (section 4); size limit is the SRS 1 MB (NFR-1.4).

Conventions: `Expr` = expression string (section 3). `Num` = JSON number or `Expr`. `LocaleText` = per-locale string map (section 1.3). Every `id` inside a topic is unique across the whole topic (one namespace), matches `^[a-z][a-zA-Z0-9-]{0,31}$` unless stated, and is stable. Part, step and element ids (`eid`, hyphens allowed) are never expression variables; only parameter, derived, example input and loop identifiers (`ident`, no hyphen) are. Every topic-derived DOM id is prefixed by the renderer (AD-2). A topic version is identified by `(id, contentHash)`; `contentHash` is `sha256:` of the canonical JSON from `lib/topic-schema/canonicalize` (strings NFC, keys sorted, no whitespace, whole document).

## 1. Fields

### 1.1 Top level

| Field | Type | Req | Constraint |
| --- | --- | --- | --- |
| `schemaVersion` | integer | yes | currently `1`; a pure `migrate(doc)` chain upgrades older documents at read; a higher value fails with E_SCHEMA_VERSION |
| `id` | string | yes | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3 to 64 chars; globally unique, permanent, used in URLs (SRS 5.7: "ids never change once published") |
| `path` | `{category, subcategory, chapter}` | yes | three slugs; each must exist in the math tree in the database (FR-9.10), nested correctly (E_TAXONOMY) |
| `chapterOrder` | int | yes | 1 to 20; order of the topic inside its chapter |
| `level` | enum | yes | `foundation`, `intermediate`, `advanced` |
| `estimatedMinutes` | int | yes | 5 to 20 (SRS: about 10 to 15) |
| `title` | LocaleText | yes | max 80 chars per locale; no markup |
| `summary` | LocaleText | yes | max 160; shown on cards and in search; no markup |
| `goal` | LocaleText | yes | max 200; starts with an action ("See", "Find", "Explain"); inline markup allowed |
| `tags` | `{en: string[], ur: string[]}` | yes | 1 to 8 per locale, each max 30 chars; search words in both languages (FR-1.4) |
| `prerequisites` | string[] | no | max 5 topic ids; advisory only, never locks (SRS 5.4); an unresolved id is a warning (W_PREREQ_UNRESOLVED) |
| `next` | string[] | no | max 3 topic ids; same rule; if absent the page shows the following topic in the chapter (FR-1.8) |
| `terms` | Term[] | no | max 12; marked math terms used by `{{term:id}}` (FR-2.6, Should) |
| `parameters` | Parameter[] | yes | 1 to 8 |
| `derived` | Derived[] | no | max 20 |
| `scene` | SceneRoot | yes | exactly one; section 2 |
| `steps` | Step[] | yes | 3 to 6 (FR-4.2) |
| `formulas` | Formula[] | yes | 1 to 10 |
| `example` | Example | yes | one worked example (FR-4.4) |
| `tryThis` | LocaleText[] | no | 2 to 3 prompts, each max 200 (FR-4.7, Should) |
| `watchOut` | LocaleText | no | max 240; common mistake (FR-4.5, Should) |
| `quiz` | `[]` | no | reserved and empty in v1 (FR-11.1). A non-empty value is accepted but ignored, with warning W_QUIZ_IGNORED |

Unknown keys anywhere are errors (E_UNKNOWN_KEY), including `__proto__` and `constructor` keys in any record (`params`, `bind`, `at`, `given`); records are passed to the runtime as null-prototype objects. Admin-owned fields (status, published version, content wave) are never authored. Images (FR-9.14, Should) are not in schema v1; adding them is a schema version bump.

### 1.2 Sub-objects

`Term`: `{id, term: LocaleText(max 40), definition: LocaleText(max 200)}`.

`Parameter` (the only values a visitor can change: sliders, typed values, scene drags):

| Field | Type | Constraint |
| --- | --- | --- |
| `id` | identifier | `^[a-z][a-zA-Z0-9]{0,15}$`; not a function name or constant (`pi`, `e`, `tau`); doubles as the expression variable |
| `label` | LocaleText | max 40 |
| `kind` | enum | `number`, `integer`, `toggle`, `choice` |
| `min`, `max` | number | `min < max`; toggle is fixed 0 and 1 |
| `step` | number | `> 0`; `(max-min)/step <= 10000`; integer kind needs integer step |
| `default` | number | within range and on the step grid |
| `unit` | enum | `none`, `deg`, `rad`, `cm`, `m`, `units`, `percent`; the display symbol comes from the app |
| `options` | `{value: number, label: LocaleText}[]` | `choice` only, 2 to 6 |

These are the SRS 5.7 scene parameter fields (name, label, minimum, maximum, step, unit, default). The viewer rejects a typed value outside `[min, max]` with a short message (FR-3.7).

`Derived`: `{id: identifier, expr: Expr}`. Evaluated in array order; may use parameters and earlier derived ids only (E_DERIVED_ORDER). NaN means "undefined".

`Step`: `{id, title: LocaleText(max 60), body: LocaleText(max 400), formulaRefs?: id[] (max 3), sceneState?: SceneState}`.
- `SceneState`: `{params?: {paramId: number}, show?: partId[], hide?: partId[], camera?: Camera}`. Applied on entering the step. This is how "a step can change parameters, move the camera or highlight part of the scene" (FR-4.2). `params` are suggestions: they apply only to parameters the visitor has not changed yet, so Next and Back never discard a slider value. `show` and `hide` ids must exist as scene parts (E_REF). Param values must be in range and on the grid (E_STEP_PARAM).

`Formula`: `{id, latex: string(max 200), caption?: LocaleText(max 120), bind?: {name: {expr: Expr, decimals: 0..6}}, checks?: Check[] (max 6), identity?: {lhs: Expr, rhs: Expr}}`.
- `latex` is KaTeX source with no Urdu characters. `{{name}}` placeholders are replaced by the formatted value of `bind[name]`, in Western digits, using U+2212 for negatives. A formula with `bind` is live (FR-3.8: "V = (1/3) x pi x r^2 x h = 94.2 cm^3"); without it, static.
- `Check`: `{at: {paramId: number}, expect: {name: number | "undefined"}}`. The validator evaluates `bind` at `at` (other parameters at default) and passes if `|value - expect| <= 0.5 * 10^-decimals`. `"undefined"` passes only when the value is NaN. These checks implement "formulas tested against known values" (NFR-6.2) for every uploaded topic.
- `identity`: validator checks `lhs == rhs` (relative 1e-9) at 24 deterministic samples over the parameter ranges, skipping NaN samples; fewer than 8 valid samples is E_IDENTITY.

`Example` (worked example with real numbers the visitor can change, FR-4.4): `{title: LocaleText(max 80), problem: LocaleText(max 300), inputs: Input[] (1 to 4), lines: Line[] (2 to 8), answer: {text: LocaleText(max 200), math?: string(max 200)}}`.
- `Input`: `{id: identifier, label: LocaleText(max 30), min, max, step, default, unit}` with the same range rules as `Parameter`. Inputs are separate from scene parameters; changing one never moves the scene.
- `Line`: `{text: LocaleText(max 240), math?: string(max 200), calc?: {name: identifier, expr: Expr, decimals: 0..6, expect: number}}`.
- `calc.expr` evaluates with the example inputs and earlier `calc.name` values in scope (no scene parameters). `{{name}}` placeholders in `text`, `math` and `answer` show the live value of an input or a `calc.name`, formatted like formula values. The validator evaluates every `calc` at the input defaults and passes if `|value - expect| <= 0.5 * 10^-decimals` (E_RECOMPUTE_EXAMPLE). Every number a visitor is meant to trust is produced by a `calc` or is an input; a literal number in `math` that is not a placeholder is allowed only for constants.

### 1.3 Text, locales and inline markup

`LocaleText` = `{en: string, ur: string}`, keys exactly the locales in `src/i18n/locales.ts` (`en`, `ur` in v1). The Zod `LocaleText` is generated from `LOCALES`, so a new language needs no schema edit (FR-6.7, L). Every `LocaleText` in this document is required in both locales except `caption` of a formula, scene `description`, `terms`, `tryThis` and `watchOut`, which are Should: a missing locale there is a warning (W_LOCALE_MISSING). A Must string missing in `ur` rejects the package (E_LOCALE_MISSING): FR-6.4 forbids publishing without both languages and FR-9.3 requires a missing Urdu text to be reported as an upload problem, so an incomplete package is never saved.

Max lengths are per locale. Strings are plain text plus three inline markups, nothing else (HTML, links, Markdown links and images are literal text only; `<` and `&` render escaped):
- `$latex$` inline math. KaTeX source, ASCII only inside, rendered `dir="ltr"` in an isolate. No nested `$`; escape a literal dollar as `\$`. Even in `ur` text, math inside `$...$` has no Urdu characters (E_URDU_IN_MATH), and Urdu words never go inside `\text{}`.
- `**bold**`, no nesting, max 3 per string.
- `{{term:id}}` marked term reference (E_REF if the id is not in `terms`).

`{{...}}` has three contexts with separate allowed sets: `{{term:id}}` in step, goal, tryThis and watchOut text; `{{name}}` formula value placeholders only inside `Formula.latex`; `{{name}}` example placeholders only inside `Example` strings. A placeholder outside its context is E_MARKUP.

At S0 every string is normalized to NFC; bidi control characters U+202A to U+202E and U+2066 to U+2069 are rejected (E_BIDI_CONTROL); ZWNJ, ZWJ, LRM and RLM are allowed only in `ur` strings. The renderer returns React nodes, never HTML strings (AD-14).

Digits in authored strings are Western (0-9); Eastern Arabic-Indic digits are rejected (E_NONWESTERN_DIGIT). The renderer converts display digits for Urdu pages where the visitor chose them, never inside math. Numbers and units follow the visitor's format (NFR-7.2).

`Label` (scene labels): `{latex: string(max 80)} | {text: LocaleText(max 40)}`.

### 1.4 Zod sketch (Zod 4)

```ts
const LOCALES = ['en', 'ur'] as const;
// Every locale is required in the shape; Should strings use locText(max, false) which makes non-en optional.
const locText = (max: number, must = true) =>
  z.strictObject(Object.fromEntries(LOCALES.map(l => [l, must || l === 'en'
    ? z.string().min(1).max(max) : z.string().min(1).max(max).optional()])));
// A test adds a fake locale to LOCALES and asserts the schema accepts it.
const ident = z.string().regex(/^[a-z][a-zA-Z0-9]{0,15}$/);
const eid = z.string().regex(/^[a-z][a-zA-Z0-9-]{0,31}$/);
const expr = z.string().min(1).max(500);                 // grammar checked in S3
const num = z.union([z.number().finite(), expr]);

const Parameter = z.strictObject({
  id: ident, label: locText(40),
  kind: z.enum(['number', 'integer', 'toggle', 'choice']),
  min: z.number(), max: z.number(), step: z.number().positive(), default: z.number(),
  unit: z.enum(['none', 'deg', 'rad', 'cm', 'm', 'units', 'percent']),
  options: z.array(z.strictObject({ value: z.number(), label: locText(40) })).min(2).max(6).optional(),
}).refine(p => p.min < p.max, 'min must be below max');

const Step = z.strictObject({
  id: eid, title: locText(60), body: locText(400),
  formulaRefs: z.array(eid).max(3).optional(), sceneState: SceneState.optional(),
});
const Formula = z.strictObject({
  id: eid, latex: z.string().max(200), caption: locText(120, false).optional(),
  bind: z.record(ident, z.strictObject({ expr, decimals: z.int().min(0).max(6) })).optional(),
  checks: z.array(z.strictObject({ at: z.record(ident, z.number()), expect: z.record(ident, z.union([z.number(), z.literal('undefined')])) })).max(6).optional(),
  identity: z.strictObject({ lhs: expr, rhs: expr }).optional(),
});
const Line = z.strictObject({
  text: locText(240), math: z.string().max(200).optional(),
  calc: z.strictObject({ name: ident, expr, decimals: z.int().min(0).max(6), expect: z.number() }).optional(),
});
const Topic = z.strictObject({
  schemaVersion: z.int().min(1).max(CURRENT_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(64),
  path: z.strictObject({ category: slug, subcategory: slug, chapter: slug }),
  chapterOrder: z.int().min(1).max(20),
  level: z.enum(['foundation', 'intermediate', 'advanced']), estimatedMinutes: z.int().min(5).max(20),
  title: locText(80), summary: locText(160), goal: locText(200),
  tags: z.strictObject({ en: z.array(z.string().max(30)).min(1).max(8), ur: z.array(z.string().max(30)).min(1).max(8) }),
  prerequisites: z.array(z.string()).max(5).optional(), next: z.array(z.string()).max(3).optional(),
  terms: z.array(Term).max(12).optional(),
  parameters: z.array(Parameter).min(1).max(8), derived: z.array(Derived).max(20).optional(),
  scene: SceneRoot,                      // union over registered (type, v) pairs
  steps: z.array(Step).min(3).max(6), formulas: z.array(Formula).min(1).max(10),
  example: Example, tryThis: z.array(locText(200, false)).min(2).max(3).optional(),
  watchOut: locText(240, false).optional(), quiz: z.array(z.unknown()).optional(),
});
```

`SceneRoot` is built from the scene registry as a union over registered `(type, v)` pairs, so two versions of one `type` can coexist. A pair not in the registry fails with E_UNKNOWN_SCENE_TYPE; no fallback, no ignore (FR-9.15). A `type@v` used by any stored topic version is never removed from the registry.

## 2. Scenes

### 2.1 Common to every scene type

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `type` | string | yes | registry key, section 2.2 |
| `v` | int | yes | scene type version, 1 in version 1 |
| `caption` | LocaleText(max 120) | yes | visible caption under the scene (FR-3.29) |
| `description` | LocaleText(max 600) | no | "More about this picture"; Should (FR-3.29) |
| `readouts` | `{id, label: LocaleText(max 30), expr: Expr, decimals: 0..6, unit?: enum as Parameter.unit}[]` | no | max 4; shown in the scene and spoken by the live region ("Angle 30 degrees. Sine equals 0.5") |

Rules every renderer obeys:
1. A scene is a pure function of `(scene, params)`; params are `parameters` plus `derived` values. Nothing else changes what is drawn. Visitor interaction can only write a parameter.
2. Draggable things bind to parameters: `drag: {x?: paramId, y?: paramId}` on a point requires the matching position component to be exactly that parameter id (`at: ["px", "py"]`). The renderer clamps and snaps to the parameter's range and step. Violation is E_DRAG_BINDING.
3. Style never uses colors. `style = {color?: ColorToken, width?: 1|2|3, dash?: 'solid'|'dashed'|'dotted', marker?: 'circle'|'square'|'diamond'|'triangle', fill?: 'none'|'light'|'medium'}`. `ColorToken` is one of `axis, grid, curve1, curve2, fill, accent, muted, success, error, hint, selected, edge, section`, mapped to the DESIGN.md scene tokens for light and dark. Two series that carry meaning must differ by `dash` or `marker` too (WCAG, not color alone).
4. Every element has `id` (unique in the topic), optional `when: Expr` (drawn when non-zero, default always), optional `visible: boolean` (initial state, default true; steps flip it via `show`/`hide`).
5. 3D types also take `camera: {azimuth: deg, elevation: deg, distance: number}` or `{preset: 'iso'|'front'|'top'|'side'}`; this is what Reset view returns to.
6. Every 3D type provides a static 2D projection and a light 2D mode from the same data; authors write nothing extra.
7. Caps: at most 60 elements and canvas sample counts as listed per type. Budgets have two levels (section 3): at most 20000 evaluation steps per evaluation call, and an aggregate scene cost per frame of at most 3,000,000 steps, computed at import as the sum over elements of samples times the static step cost of each expression (loop bounds multiplied); above it the import fails with E_SCENE_COST. The cost is stored on the version and the renderer shows the static projection if it is exceeded at runtime. Renderers clamp every emitted coordinate to a finite window and cap path point counts.

### 2.2 Scene types

Priority column follows the SRS FR-3 table: M = Must, S = Should. FR-3.11 (net) and FR-3.27 (matrix transform) are required for launch because wave 1 topics need them (PRD section 14).

| `type` | SRS | Pri | Covers categories |
| --- | --- | --- | --- |
| `canvas2d` | FR-3.17, 3.18, 3.24, 3.25 (limits, tangent, Riemann, area), 2D vectors | M | functions-graphs, coordinate-geometry, geometry (2D), vectors (2D), complex-numbers (Argand), calculus, series-discrete, trigonometry (graphs) |
| `unit-circle` | FR-3.21 | M | trigonometry |
| `right-triangle` | FR-3.21 | M | trigonometry, geometry |
| `number-model` | FR-3.19 | M | arithmetic-numbers, algebra (foundation) |
| `algebra-tool` | FR-3.20 | M | algebra |
| `solid3d` | FR-3.1 to 3.14 common 3D, 3.10 cross-section; 3.11 net and 3.12 fill are S | M (net, fill S) | geometry |
| `space3d` | FR-3.22 | M | vectors, coordinate-geometry, linear-algebra |
| `revolution3d` | FR-3.25 (solids of revolution) | M | calculus |
| `stats` | FR-3.26 | M | statistics-probability, series-discrete (counting) |
| `surface3d` | FR-3.23 | S | functions-graphs, calculus |
| `matrix-transform` | FR-3.27 | S | linear-algebra, vectors |

Gap: the SRS lists no discrete-maths scene (graphs, trees, Pascal's triangle, modular arithmetic). `series-discrete` topics use `canvas2d` (`sequence`, `bars`, `table`) and `stats` counting charts in version 1. Dedicated discrete types are deferred (architecture spine, Deferred list); the `series-discrete` category depends on them for graphs, trees, Pascal's triangle and modular arithmetic, so its version 1 topics are limited to sequences, series and counting charts. Each new type is a new registry entry, not a change to existing ones.

### 2.3 `canvas2d`

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `viewport` | `{xMin, xMax, yMin, yMax}` of Num | yes | width and height positive; may depend on parameters |
| `aspect` | `'equal'` or `'free'` | no | default `equal`; geometry and unit-circle-like content must be `equal` |
| `axes` | `{show: boolean, xLabel?: Label, yLabel?: Label, ticks?: 'auto' or number}` | no | default shown |
| `grid` | boolean | no | default true |
| `pan`, `zoom` | boolean | no | default false, true; zoom is limited to 0.25x to 8x of `viewport` |
| `elements` | Element[] | yes | 1 to 60 |

Elements (`Pt` = `[Num, Num]`). All take the common element fields and `style`; `label?: Label` where noted.

| Element `type` | Fields | Notes |
| --- | --- | --- |
| `function` | `expr` (variable `x`), `domain?: [Num, Num]`, `samples?` (default 400, max 1000), `label?` | Draws y = f(x); NaN breaks the line |
| `parametric` | `x: Expr`, `y: Expr` (variable `t`), `t: [Num, Num]`, `samples?`, `label?` | Sine-wave trace, circles, spirals |
| `point` | `at: Pt`, `drag?: {x?, y?}`, `label?`, `snap?: {step: number}` | |
| `segment`, `ray`, `line` | `from: Pt`, `to: Pt`, `label?` | `line` extends both ways |
| `vector` | `from: Pt`, `to: Pt`, `label?` | arrow head |
| `polygon` | `points: Pt[]` (3 to 12), `closed?: true`, `label?` | |
| `circle` | `center: Pt`, `radius: Num`, `label?` | |
| `arc` | `center: Pt`, `radius: Num`, `from: Num`, `to: Num` (degrees, counter-clockwise) | angle arcs |
| `angleMark` | `vertex: Pt`, `a: Pt`, `b: Pt`, `label?` | shows the angle between rays |
| `region` | `between: [Expr, Expr]` (functions of `x`), `from: Num`, `to: Num` | area between curves; second expr `0` gives area under a curve |
| `riemann` | `fn: Expr`, `from: Num`, `to: Num`, `n: Num` (integer 1 to 200), `method: 'left'\|'right'\|'mid'\|'trapezoid'` | rectangles and a readout of the sum is a `readouts` entry using `sum(...)` |
| `tangent` | `fn: Expr`, `at: Num`, `length?: Num`, `drag?: {x: id}`, `snap?: {step}`, `label?` | slope by central difference, h = 1e-5; none at a corner or jump (marker and text only); the marker slides along the curve when `at` is exactly the `drag.x` parameter (Story 4.3) |
| `derivative` | `fn: Expr`, `domain?`, `samples?`, `at?: Num`, `label?` | the graph of f'; with `at`, a diamond marker at (at, f'(at)) joined by a dotted guide to the point of f (Story 4.3) |
| `secant` | `fn: Expr`, `x1: Num`, `x2: Num`, `label?` | for derivative-as-limit; no line when x1 equals x2 |
| `limitProbe` | `fn: Expr`, `approach: Num`, `h: Num`, `label?` | marks f at approach-h and approach+h, an open circle (`marker: 'open'`) at the limit when both sides agree, also where f is not defined there |
| `complex` | `re: Num`, `im: Num`, `drag?: {x?: id, y?: id}` (same binding rule as `point`), `snap?: {step}`, `label?`, `polar?: boolean` | Story 4.2. An Argand number: an arrow from the origin and a marker (draggable when `re` and `im` are exactly the parameters in `drag`). `polar` adds the argument arc and writes `r` and `theta`. The modulus, the argument in degrees in (-180, 180] and the number as a + bi are in the text list |
| `complexOp` | `op: 'add'\|'mul'\|'conj'\|'power'\|'roots'`, `of: id[]` (two ids for `add` and `mul`, one for the others; ids of `complex` elements or other ops, in any order), `n?: Num` (`power` 2 to 12, `roots` 2 to 16, whole; required for those two), `label?` | Story 4.2. `add`: the parallelogram (dashed copies) and the sum from the origin. `mul`: the product, the argument of the first and the turn by the argument of the second as arcs; the text says the moduli multiply and the arguments add. `conj`: the reflection in the real axis. `power`: z, z squared, to z to the n as marks on the spiral they make. `roots`: the n-th roots as marks, the circle they lie on and the regular polygon they make (the roots of unity are the roots of a fixed `complex` 1). A missing id, a non-finite value, a zero for `roots` or a result past 1e6 leaves the element out and the text names it |
| `sequence` | `expr` (variable `n`), `from: int`, `to: int` (at most 200 terms), `connect?: boolean` | terms as points |
| `bars` | `expr` (variable `n`), `from: int`, `to: int` (at most 60), `cumulative?: boolean` | partial sums and discrete bars |
| `text` | `at: Pt`, `label: Label` | |
| `readout` | `at: Pt`, `label: LocaleText`, `expr: Expr`, `decimals` | live number drawn on the canvas |
| `table` | `at: Pt`, `rows: {label: Label, expr: Expr, decimals}[]` (at most 8) | live value table |

Transformations (FR-3.18) are expressed with elements: a reflected, rotated or translated shape is a `polygon` whose `points` are expressions of the original coordinates and a parameter (for example rotation: `["cos(rad(a))*1 - sin(rad(a))*2", ...]`). A transform helper element is Deferred.

### 2.4 `unit-circle` (Must)

Fixed parts (valid `show`/`hide` ids): `circle`, `point`, `radius`, `arc`, `cosine`, `sine`, `tangent`, `wave`, `quadrants`.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `angle` | paramId | yes | the draggable angle parameter; its `unit` must be `deg` or `rad` |
| `snap` | `{values: number[] (max 24), within: number}` | no | in the parameter unit; the point snaps to special angles within `within` |
| `tangent` | `{when?: Expr}` | no | tangent segment drawn when `when` is non-zero |
| `wave` | `{fn: 'sin'\|'cos'\|'tan', from: Num, to: Num}` | no | second panel that draws the function trace as the point moves; range in the parameter unit |
| `quadrants` | `boolean` | no | quadrant labels I to IV |

### 2.5 `right-triangle` (Must)

Parts: `triangle`, `rightAngle`, `angleArc`, `sideLabels`, `ratios`.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `given` | `{mode: 'sides', adjacent: Num, opposite: Num}` or `{mode: 'angle', angle: Num, hypotenuse: Num}` | yes | angle in degrees, 1 to 89 |
| `labels` | `'abc'` or `'opp-adj-hyp'` | no | default `opp-adj-hyp` |
| `ratios` | `('sin'\|'cos'\|'tan')[]` | no | ratio lines shown in the scene |

### 2.6 `number-model` (Must)

One `model` per scene: `{kind, ...}`.

| `kind` | Fields |
| --- | --- |
| `numberLine` | `min`, `max`, `step` (numbers), `marks: {at: Num, label?: Label}[]` (max 12), `jumps?: {from: Num, to: Num}[]` (max 6) |
| `fractionBars` | `rows: {num: Num, den: Num}[]` (1 to 4; `den` integer 1 to 24), `alignLine?: boolean` |
| `fractionCircle` | `num: Num`, `den: Num` (`den` 1 to 24) |
| `areaModel` | `rows: Num`, `cols: Num` (integers 1 to 20), `splitRows?: Num`, `splitCols?: Num` (distributive law) |
| `tenFrame` | `count: Num` (0 to 20) |
| `placeValue` | `value: Num` (integer 0 to 9999) |
| `percentGrid` | `percent: Num` (0 to 100) |

### 2.7 `algebra-tool` (Must)

All interaction goes through parameters (sliders), so the scene stays pure.

| `tool` | Fields |
| --- | --- |
| `balanceScale` | `left: {xs: Num, ones: Num}`, `right: {xs: Num, ones: Num}`, `x: Num` (the hidden weight of one x); tilts by the sign of left minus right |
| `algebraTiles` | `terms: {x2: Num, x: Num, one: Num}`; `mode: 'expand'\|'factor'` (a rectangle area model) |
| `functionMachine` | `input: Num`, `rule: Expr` (variable `x`), `showRule: boolean` |
| `stepSolver` | `variable: identifier`, `solution: number`, `lines: {latex: string, lhs: Expr, rhs: Expr, note: LocaleText(max 120)}[]` (2 to 8); the solver reveals lines up to a parameter `reveal: paramId` |

`stepSolver` is self-checking: validator evaluates `lhs` and `rhs` at `variable = solution` for every line; each line must satisfy `lhs == rhs` (E_SOLVER_LINE).

### 2.8 `solid3d` (Must; net required for launch, fill Should)

Parts: `solid`, `dimensions`, `section`, `net`, `fill`.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `solid` | `{kind, dims}` | yes | kinds and dims below |
| `labels` | `{dimensions: boolean}` | no | FR-3.5 labelled dimensions |
| `section` | `{enabled: Num, plane: {axis: 'x'\|'y'\|'z', offset: Num}}` or `{enabled: Num, normal: [Num,Num,Num], d: Num}` | no | FR-3.10 cross-section; shows the cut face and its outline |
| `net` | `{progress: Num}` (0 to 1) | no | S, FR-3.11; supported for `cube`, `cuboid`, `prism`, `pyramid`, `cylinder`, `cone` |
| `fill` | `{level: Num}` (0 to 1) | no | S, FR-3.12 fill animation |
| `camera` | Camera | no | default `iso` |

Solid kinds and `dims` (Num each): `cube {side}`, `cuboid {length, width, height}`, `prism {sides (int 3 to 12), side, height}`, `pyramid {sides (int 3 to 12), side, height}`, `cylinder {radius, height}`, `cone {radius, height}`, `sphere {radius}`, `hemisphere {radius}`, `frustum {rTop, rBottom, height}`. Surface area and volume are shown through `readouts`.

### 2.9 `space3d` (Must; built in Story 4.1)

Parts: `axes`, `grid`, `box`, and the id of every element. Editing is by parameters (sliders and typed boxes) only; nothing in the picture is dragged.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `range` | Num | no | half the side of the axes box, 1 to 50; 6 if left out |
| `elements` | Element[] (1 to 24) | yes | drawn in order; ids unique; a derived element names earlier vectors by id |
| `camera` | Camera | no | default `iso` |

Coordinates are math coordinates: x, y, z with z up. Every `[Num,Num,Num]` below is three numbers or expressions of the topic's parameters.

| Element `type` | Fields | Draws |
| --- | --- | --- |
| `point` | `at`, `label?` | a mark with its label |
| `vector` | `from?` (default the origin), `to`, `label?` | an arrow |
| `op` | `op: 'add'\|'scale'\|'cross'`, `of: id[]`, `k?` (scale), `label?` | `add` of two to four vectors: the parts tip to tail (dashed) and the sum from the origin; `scale` of one vector by `k`; `cross` of two vectors from the origin (the zero vector, not drawn, when they are parallel) |
| `dot` | `a`, `b` (vector ids), `label?` | the part of `a` along `b` (dashed arrow with a dotted drop line); the value and the angle are in the text |
| `line` | `point`, `direction`, `label?` | the line clipped to the axes box; a zero direction is left out |
| `plane` | `normal`, `d` (the plane is `normal . p = d`), `label?` | a see-through patch where the plane meets the box, with its normal; a zero normal is left out |

Each element's look (color and dash) comes from its order, so two never differ by color alone. A value that is not a finite number leaves its element out, and the text says so. The numbers (components, lengths, dot, angle, cross) are in the text list and the live announcement. Not built: `segment3`, `polygon3`, `box3`, `text3` and dragging a point (`drag`); each can be added as a new element type without changing these.

### 2.10 `revolution3d` (Must)

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `fn` | Expr (variable `x`) | yes | curve being revolved |
| `from`, `to` | Num | yes | interval |
| `axis` | `'x'` or `'y'` | yes | axis of revolution |
| `method` | `'disk'` or `'shell'` | no | which slicing is shown |
| `sweep` | Num (degrees 0 to 360) | no | how much of the solid is drawn |
| `slice` | Num | no | position of the highlighted disk or shell |
| `plot2d` | boolean | no | default true; small 2D profile beside the solid |

Parts: `curve`, `solid`, `slice`, `profile`. Sampling: at most 96 rings by 64 segments.

### 2.11 `stats` (Must)

One `chart` per scene: `{kind, ...}`.

| `kind` | Fields |
| --- | --- |
| `histogram` | `data: number[]` (max 500) or `{gen: {n, dist: 'normal'\|'uniform', mean?, sd?, seed: int}}` (generated deterministically), `bins: Num` (integer 2 to 40), `showMean?`, `showMedian?` |
| `boxplot` | `data: number[]` or `gen`, `showOutliers?` |
| `scatter` | `points: [Num, Num][]` (max 100), `fit?: 'linear'`, `showResiduals?`, `drag?: {index, x?, y?}[]` (drag binds as for points) |
| `bar` | `categories: Label[]` (max 12), `values: Num[]` |
| `distribution` | `dist: 'normal' \| 'binomial' \| 'uniform'`, `params: {name: Num}`, `shade?: {from: Num, to: Num}`; the shaded probability is a `readouts` entry using `normcdf`/`binompmf` |
| `probabilityTree` | `branches: {label: Label, p: Num, children?: (same)[]}[]` (depth 3, max 12 leaves) |
| `simulation` | `kind: 'coin'\|'die'\|'spinner'`, `trials: Num` (integer 1 to 1000, a parameter), `seed: int`; deterministic PRNG so the scene stays pure |

### 2.12 `surface3d` (Should)

`z: Expr` (variables `x`, `y`), `x: [Num, Num]`, `y: [Num, Num]`, `resolution: int` (8 to 64, default 40), `contours?: boolean`, `marker?: {x: paramId, y: paramId}` (point on the surface), `camera?`. Parts: `surface`, `marker`, `contours`.

### 2.13 `matrix-transform` (Should; required for launch; built in Story 4.4)

Parts: `shape`, `basis`, `determinant`, `eigen`, `grid`. Editing is by parameters (sliders and typed boxes) only: every matrix entry is a Num.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `dim` | 2 or 3 | yes | the matrix is `dim` by `dim` |
| `matrix` | Num[][] | yes | rows; 2x2 or 3x3, matching `dim` |
| `shape` | one of `unitSquare`, `unitGrid`, `triangle`, `letterF`, `unitCube` | yes | `unitCube` needs `dim: 3`; `triangle`, `letterF`, `unitSquare` need `dim: 2`; `unitGrid` is a grid in 2D and the three coordinate planes in 3D |
| `showBasis` | boolean | no | the images of e1, e2 (e3) as arrows |
| `showDeterminant` | boolean | no | the area (2D) or volume (3D) readout, and the image of the unit square filled |
| `progress` | Num | no | 0 is the identity, 1 the matrix (default 1); the picture is I + progress (M - I), clamped to 0..1 |
| `showEigen` | boolean | no | 2D only: lines along the real eigenvectors with their eigenvalues in the text; a sentence when they are complex |
| `range` | Num | no | half the side of the window, 1 to 50; 4 if left out |
| `camera` | Camera | no | 3D only; default `iso` |

The original shape stays as a dashed ghost; the transformed one is solid. The determinant is signed: its absolute value scales area (volume), a negative sign says the shape is flipped, and 0 says it is flattened. A 3D scene is drawn by the `space3d` renderers. An entry that is not a finite number leaves the scene out, and the text says so.

### 2.14 Scene-to-category cover

| Category | Scene types |
| --- | --- |
| arithmetic-numbers | `number-model` |
| algebra | `algebra-tool`, `number-model` (foundation), `canvas2d` |
| geometry | `canvas2d`, `right-triangle`, `solid3d` |
| trigonometry | `unit-circle`, `right-triangle`, `canvas2d` (graphs) |
| coordinate-geometry | `canvas2d`, `space3d` |
| functions-graphs | `canvas2d`, `surface3d` (S) |
| vectors | `canvas2d`, `space3d`, `matrix-transform` (S) |
| complex-numbers | `canvas2d` (`complex`) |
| calculus | `canvas2d` (`tangent`, `secant`, `limitProbe`, `riemann`, `region`), `revolution3d`, `surface3d` (S) |
| series-discrete | `canvas2d` (`sequence`, `bars`, `table`), `stats` |
| statistics-probability | `stats` |
| linear-algebra | `space3d`, `matrix-transform` (S) |

## 3. Expression grammar and functions

One implementation serves upload validation and runtime evaluation. Two modes: `author` (strict, used for everything in the topic file) and `typed` (the value a visitor types next to a slider, FR-3.7; adds digit normalization).

```
expr   := or
or     := and ( "||" and )*
and    := cmp ( "&&" cmp )*
cmp    := add ( ("<" | "<=" | ">" | ">=" | "==" | "!=") add )?
add    := mul ( ("+" | "-") mul )*
mul    := unary ( ("*" | "/" | "%") unary )*
unary  := ("-" | "+" | "!") unary | pow
pow    := atom ( "^" unary )?            // right-associative; -2^2 = -4
atom   := NUMBER | IDENT | IDENT "(" [ expr ("," expr)* ] ")" | "(" expr ")"
NUMBER := digits [ "." digits ] [ ("e" | "E") ["+" | "-"] digits ]
IDENT  := [A-Za-z_][A-Za-z0-9_]*
```

Rules:
- Booleans are numbers: true is 1, false is 0; any non-zero is true. `&&`, `||`, `!` yield 0 or 1.
- Author mode: ASCII only (E_EXPR_NONASCII), no implicit multiplication (`2x` is E_EXPR_SYNTAX), no whitespace significance. No `.`, `[`, `]`, `{`, `}`, `;`, `=` (single), quotes, backticks. Identifiers resolve only against the scope (parameters, derived ids, example inputs and `calc` names, loop variables, and the constants `pi`, `e`, `tau`); lookups use a null-prototype map, and `__proto__`, `constructor`, `prototype` are rejected as identifiers.
- Typed mode, applied to the raw input before lexing: map Eastern Arabic-Indic digits U+0660 to U+0669 and U+06F0 to U+06F9 to 0 to 9, U+066B to `.`, U+2212 to `-`, drop U+066C and whitespace. The result must parse as a single finite number; anything else is "not a number" and the typed value is rejected with the range message. The wider quiz-answer grammar (implicit multiplication, expression equivalence) is not built; it belongs to the later quiz release (FR-11.2).
- Division by zero and domain errors (`sqrt(-1)`, `ln(0)`) yield NaN, never throw. `tan(x)` yields NaN when `|cos(x)| < 1e-12`. All trig is in radians. NaN means "undefined" in displays and "not drawn" in plots. Infinity is treated as NaN.

Functions (name, arity), the complete whitelist:

| Group | Functions |
| --- | --- |
| Trig | `sin(1)`, `cos(1)`, `tan(1)`, `sec(1)`, `csc(1)`, `cot(1)`, `asin(1)`, `acos(1)`, `atan(1)`, `atan2(2)` |
| Hyperbolic | `sinh(1)`, `cosh(1)`, `tanh(1)` |
| Angle | `rad(1)` degrees to radians, `deg(1)` radians to degrees |
| Powers, logs | `sqrt(1)`, `cbrt(1)`, `pow(2)`, `exp(1)`, `ln(1)`, `log10(1)`, `log2(1)`, `log(2)` (value, base), `hypot(2)` |
| Rounding, sign | `abs(1)`, `sign(1)`, `floor(1)`, `ceil(1)`, `round(1)` (half away from zero), `trunc(1)` |
| Comparison | `min(2..8)`, `max(2..8)`, `clamp(3)` (value, lo, hi), `mod(2)` (result takes the divisor's sign) |
| Logic | `if(3)` (condition, then, else; all arguments are evaluated, so it counts toward the step budget) |
| Discrete | `fact(1)` (integer 0 to 170), `nCr(2)` and `nPr(2)` (integers, n at most 1000, 0 <= k <= n, else NaN), `gcd(2)`, `lcm(2)` (integers within 2^53, bounded Euclid, overflow is NaN) |
| Statistics | `normpdf(3)` (x, mean, sd), `normcdf(3)` (closed-form approximation, O(1)), `binompmf(3)` (n, k, p; n integer at most 1000, else NaN) |
| Special forms | `sum(i, lo, hi, body)`, `prod(i, lo, hi, body)`: `i` is a bare identifier bound inside `body`, `lo` and `hi` integers, at most 10000 iterations, each iteration counted against the step budget |

Constants: `pi`, `e`, `tau`.

Caps (module constants, enforced at parse and at evaluation): source length 500 chars; 200 AST nodes; depth 32; 8 call arguments; at most 10000 loop iterations in `sum`/`prod` (nested loops multiply and every iteration costs steps); numeric results clamp to NaN beyond 1e300. Each node and builtin call costs one step, `sum`/`prod` cost their iterations times the body cost, and the builtins above that loop charge steps by their input size within their input caps.

Budget, one definition at two levels: (1) 20000 evaluation steps per single evaluation call of one expression; (2) an aggregate per-frame scene cost, the sum over scene elements of samples times the static step cost of the element's expressions, at most 3,000,000 steps (section 2.1 rule 7). Exceeding a parse cap is E_EXPR_LIMIT at upload and exceeding the scene cost is E_SCENE_COST; exceeding a per-call budget at runtime returns NaN and logs `expr.budget_exceeded` (a validator miss).

Typed input is capped at 40 characters.

Module API (`src/lib/expr/`, pure, isomorphic, no dependencies): `parse(src, {mode, scope, limits}) -> Result<Ast, ExprError>`, `compile(ast) -> (scope) => number` (a closure interpreter over a frozen AST; no `eval`, no `Function`), `format(value, decimals)`.

## 4. MD layout

SRS 5.7 leaves the exact MD layout to the architecture. The rule is simple: **an MD file is the same object as the JSON file, split so the text can be read by a person.** `parseMd(src)` in `lib/topic-schema` turns it into the JSON object, which then enters the same pipeline from S1; error pointers always name the JSON path.

- **Front matter** (YAML between `---` lines, YAML 1.2 core schema, no tags, no anchors, no merge keys) holds every field that is not a `LocaleText`: `schemaVersion`, `id`, `path`, `chapterOrder`, `level`, `estimatedMinutes`, `prerequisites`, `next`, the whole `parameters` (without `label`), `derived`, `scene` (without `caption` and `description`), `steps` (id, `formulaRefs`, `sceneState` only), `formulas` (id, `latex`, `bind`, `checks`, `identity`), and `example` structure (`inputs` without labels, `lines` with `math` and `calc` only).
- **Language sections.** One `## en` and one `## ur` heading. Under each, every text leaf is an `###` heading whose text is the leaf's path, followed by the text until the next heading. Paths use ids, not positions, except where a list has none (1-based):

| Heading | Fills |
| --- | --- |
| `### title`, `### summary`, `### goal`, `### watchOut` | the top-level LocaleText |
| `### tags` | a comma-separated list |
| `### parameters.angle.label` | `parameters[id=angle].label` |
| `### steps.s1.title`, `### steps.s1.body` | `steps[id=s1].title` and `.body` |
| `### formulas.f1.caption` | `formulas[id=f1].caption` |
| `### scene.caption`, `### scene.description` | scene texts |
| `### example.title`, `### example.problem`, `### example.answer.text` | example texts |
| `### example.inputs.n.label` | `example.inputs[id=n].label` |
| `### example.lines.2.text` | `example.lines[2].text` (1-based) |
| `### tryThis.1`, `### tryThis.2` | `tryThis[0]`, `tryThis[1]` |
| `### terms.unit-circle.term`, `### terms.unit-circle.definition` | term texts |

- A text leaf may instead be written in front matter as `{en: ..., ur: ...}`. A leaf given in both places is E_MD_DUPLICATE; a heading path that matches nothing is E_MD_PATH; a malformed file is E_MD_PARSE. The same inline markup rules apply (1.3). A heading may not be repeated.
- The two language sections need not list leaves in the same order. A leaf present in `en` and absent in `ur` is E_LOCALE_MISSING, as in JSON.

A short example (full JSON equivalent in section 6):

```
---
schemaVersion: 1
id: trig-unit-circle
path: { category: trigonometry, subcategory: unit-circle-radians, chapter: unit-circle }
chapterOrder: 1
level: intermediate
estimatedMinutes: 12
parameters:
  - { id: angle, kind: number, min: 0, max: 360, step: 1, default: 30, unit: deg }
scene: { type: unit-circle, v: 1, angle: angle }
---
## en
### title
The Unit Circle and the Sine Wave
### steps.s1.title
Drag the point
### steps.s1.body
Drag the point round the circle. Its height is the sine.
## ur
### title
اکائی دائرہ اور سائن کی موج
```

## 5. Validation rules and messages

Upload runs stages in order, collects all errors of a stage, and stops after the first failed stage (FR-9.3). S0 reads the body as a stream and enforces the size limit while reading; at most 12 files per request (FR-9.2: several files at once); each stage has a 20 s wall-clock limit. Each file is judged alone: a failed file saves nothing and never affects another file or any published content (NFR-5.3). Content whose hash already exists returns the existing version. Output per problem: `<file>#<JSON pointer> [CODE] <message>`, with file, field and message as FR-9.3 requires. `error` blocks saving; `warning` saves the topic as a draft with the warning recorded.

| Stage | Code | Sev | Message template |
| --- | --- | --- | --- |
| S0 parse | E_JSON_PARSE | error | `Not valid JSON: {parser message} at line {l}, column {c}.` |
| S0 | E_MD_PARSE | error | `Not valid MD: {reason} at line {l}.` |
| S0 | E_MD_PATH | error | `Heading '{path}' does not match any text field.` |
| S0 | E_MD_DUPLICATE | error | `'{path}' is given in the front matter and in a section.` |
| S0 | E_FILE_SIZE | error | `File is {n} KiB; the limit is 1024 KiB.` |
| S0 | E_DEPTH | error | `Nesting deeper than 12 levels at {pointer}.` |
| S0 | E_BIDI_CONTROL | error | `Bidirectional control character U+{hex} at {pointer} is not allowed.` |
| S0 | E_VALIDATION_TIMEOUT | error | `Stage {stage} exceeded 20 s.` |
| S1 schema | E_SCHEMA_VERSION | error | `schemaVersion {v} is not supported; this importer reads 1.` |
| S1 | E_SCHEMA | error | `{zod message} (expected {type}, got {type}).` |
| S1 | E_UNKNOWN_KEY | error | `Unknown key '{key}'. Allowed: {list}.` |
| S1 | E_UNKNOWN_SCENE_TYPE | error | `Scene type '{type}' v{v} is not registered. Registered: {list}.` |
| S1 | W_QUIZ_IGNORED | warning | `The quiz field is reserved and is ignored in version 1.` |
| S2 refs | E_ID_FORMAT | error | `'{id}' is not a valid id; use lowercase letters, digits and hyphens.` |
| S2 | E_TAXONOMY | error | `'{value}' is not a known {field} under '{parent}' in the math tree.` |
| S2 | E_DUP_ID | error | `Id '{id}' is used more than once in this topic ({pointer1}, {pointer2}).` |
| S2 | E_REF | error | `'{ref}' does not exist ({kind}); valid: {list}.` |
| S2 | E_STEP_PARAM | error | `Step '{id}' sets {param} to {v}; allowed {min} to {max} in steps of {step}.` |
| S2 | E_DRAG_BINDING | error | `Point '{id}' is draggable on {axis} but its position there is not exactly the parameter '{param}'.` |
| S2 | E_RANGE | error | `Parameter '{id}': {reason}` (min, max, step, default rules of 1.2) |
| S2 | W_PREREQ_UNRESOLVED | warning | `Prerequisite '{id}' is not in the library yet.` |
| S3 expressions | E_EXPR_SYNTAX | error | `Expression '{src}': {parser message} at position {n}.` |
| S3 | E_EXPR_NONASCII | error | `Expression '{src}' contains a non-ASCII character at position {n}. Use ASCII only.` |
| S3 | E_EXPR_IDENT | error | `Unknown name '{name}' in '{src}'. In scope here: {list}.` |
| S3 | E_EXPR_FN | error | `Function '{name}' is not allowed. Allowed: {list}.` |
| S3 | E_EXPR_ARITY | error | `{name} takes {k} argument(s), got {n}.` |
| S3 | E_EXPR_LIMIT | error | `Expression is too large: {what} {n} exceeds {cap}.` |
| S3 | E_DERIVED_ORDER | error | `Derived '{id}' uses '{name}', which is not defined above it.` |
| S4 text and LaTeX | E_LATEX_PARSE | error | `LaTeX does not parse: {KaTeX message}.` |
| S4 | E_LATEX_COMMAND | error | `Command {cmd} is not allowed (links, macros, raw HTML and file access are forbidden).` |
| S4 | E_URDU_IN_MATH | error | `Urdu characters inside math at {pointer}. Keep Urdu text outside $...$ and never inside \text{}.` |
| S4 | E_NONWESTERN_DIGIT | error | `Use digits 0-9; found '{ch}'.` |
| S4 | E_MARKUP | error | `Unbalanced '$' or unknown {{...}} reference in the string at {pointer}.` |
| S5 recompute | E_RECOMPUTE_FORMULA | error | `Formula '{id}' check at {at}: '{name}' is {actual}, you wrote {expected}.` |
| S5 | E_IDENTITY | error | `Formula '{id}' identity fails at {at}: left {a}, right {b}.` |
| S5 | E_RECOMPUTE_EXAMPLE | error | `Example line {i}: '{expr}' = {actual}, you wrote {expected}.` |
| S5 | E_SOLVER_LINE | error | `stepSolver line {i} is not true at {variable} = {solution}.` |
| S5 | E_SCENE_COST | error | `Scene cost {n} steps per frame exceeds 3000000 ({element} is the largest).` |
| S6 locales | E_LOCALE_MISSING | error | `'{locale}' text is missing at {pointer} (required).` |
| S6 | W_LOCALE_MISSING | warning | `'{locale}' text is missing at {pointer} (optional string).` |
| S6 | E_LOCALE_EXTRA | error | `Locale '{locale}' is not configured.` |

Upload problems named in FR-9.3 map to codes: unknown chapter = E_TAXONOMY; missing Urdu text = E_LOCALE_MISSING; scene parameter out of range = E_RANGE or E_STEP_PARAM; broken formula = E_LATEX_PARSE or E_RECOMPUTE_FORMULA.

S5 notes: validation runs on the same `lib/expr` module as the viewer (AD-3); there is no second implementation. A valid topic gets its aggregate scene cost stored on the version; the renderer shows the static projection if it is exceeded at runtime.

KaTeX: upload checks, server rendering and the client all call the one `lib/text/renderMath(latex, {inline})` with one frozen options object `{throwOnError: true, strict: 'error', trust: false, maxSize: 20, maxExpand: 200, output: 'htmlAndMathml'}` (AD-14). The command policy is an allowlist (`lib/text/latex-allowlist`: fractions, roots, sub and superscripts, Greek letters, operators, `\left`/`\right`, `\text`, `\quad`, `\circ`, `\approx`, `\dfrac`, `\tfrac` and what the 48 launch topics need), checked on the token stream before rendering; any other command is E_LATEX_COMMAND. These must never be added: `\href`, `\url`, `\includegraphics`, `\html*`, `\def`, `\gdef`, `\edef`, `\xdef`, `\newcommand`, `\renewcommand`, `\providecommand`, `\let`, `\input`, `\include`, `\write`, `\read`, `\verb`, `\color`, `\textcolor`, `\char`, `\csname`, `\expandafter`, `\futurelet`, `\global`, `\rule`, `\kern`, `\hspace`, `\raisebox`, `\tag`, `\label`, `\ref`. `\text{}` takes ASCII letters, digits and basic punctuation only. Formula and example `{{name}}` placeholders are replaced only by text matching `^-?\d+(\.\d+)?$` (U+2212 for the minus is inserted by code) or the code-inserted `\text{undefined}`; anything else renders as a dash.

## 6. Worked example: Unit Circle (Trigonometry, Intermediate)

Validates against the schema above: 2 parameters, 4 derived, 3 steps, 3 formulas, one example with 2 inputs. Numbers: sin 30 = 0.5, cos 30 = 0.8660, sin 150 = 0.5, tan 45 = 1. The Urdu text is an AI draft; the admin checks it before publishing (NFR-6.4).

```json
{
  "schemaVersion": 1,
  "id": "trig-unit-circle",
  "path": { "category": "trigonometry", "subcategory": "unit-circle-radians", "chapter": "unit-circle" },
  "chapterOrder": 1,
  "level": "intermediate",
  "estimatedMinutes": 12,
  "title": { "en": "The Unit Circle and the Sine Wave", "ur": "اکائی دائرہ اور سائن کی موج" },
  "summary": {
    "en": "Drag a point round a circle and watch sine and cosine appear.",
    "ur": "دائرے پر نقطہ گھمائیں اور سائن اور کوسائن بنتے دیکھیں۔"
  },
  "goal": {
    "en": "See how a point moving round the unit circle gives sine and cosine, and how sine draws a wave.",
    "ur": "دیکھیں کہ اکائی دائرے پر گھومتا ہوا نقطہ سائن اور کوسائن کیسے دیتا ہے، اور سائن کیسے ایک موج بناتا ہے۔"
  },
  "tags": { "en": ["sine", "cosine", "unit circle", "angle"], "ur": ["سائن", "کوسائن", "اکائی دائرہ", "زاویہ"] },
  "prerequisites": ["trig-right-triangle-ratios"],
  "next": ["trig-radians-arc-length"],
  "terms": [
    {
      "id": "unit-circle",
      "term": { "en": "unit circle", "ur": "اکائی دائرہ" },
      "definition": { "en": "A circle with radius 1 and its centre at the origin.", "ur": "ایسا دائرہ جس کا رداس 1 ہو اور مرکز مبدا پر ہو۔" }
    }
  ],
  "parameters": [
    { "id": "angle", "label": { "en": "Angle", "ur": "زاویہ" }, "kind": "number", "min": 0, "max": 360, "step": 1, "default": 30, "unit": "deg" },
    { "id": "showTangent", "label": { "en": "Show tangent", "ur": "ٹینجنٹ دکھائیں" }, "kind": "toggle", "min": 0, "max": 1, "step": 1, "default": 0, "unit": "none" }
  ],
  "derived": [
    { "id": "theta", "expr": "rad(angle)" },
    { "id": "s", "expr": "sin(theta)" },
    { "id": "c", "expr": "cos(theta)" },
    { "id": "t", "expr": "tan(theta)" }
  ],
  "scene": {
    "type": "unit-circle",
    "v": 1,
    "caption": {
      "en": "A point on the unit circle. Its height is the sine, its width is the cosine.",
      "ur": "اکائی دائرے پر ایک نقطہ۔ اس کی اونچائی سائن اور چوڑائی کوسائن ہے۔"
    },
    "description": {
      "en": "A circle of radius 1 with a point you can drag. A vertical line shows the sine and a horizontal line shows the cosine. A second panel draws the sine wave as the point moves.",
      "ur": "رداس 1 کا ایک دائرہ جس پر ایک نقطہ گھمایا جا سکتا ہے۔ عمودی لکیر سائن اور افقی لکیر کوسائن دکھاتی ہے۔ دوسرا خانہ نقطہ چلنے پر سائن کی موج بناتا ہے۔"
    },
    "angle": "angle",
    "snap": { "values": [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360], "within": 3 },
    "tangent": { "when": "showTangent" },
    "wave": { "fn": "sin", "from": 0, "to": 360 },
    "quadrants": true,
    "readouts": [
      { "id": "rs", "label": { "en": "Sine", "ur": "سائن" }, "expr": "s", "decimals": 4 },
      { "id": "rc", "label": { "en": "Cosine", "ur": "کوسائن" }, "expr": "c", "decimals": 4 }
    ]
  },
  "steps": [
    {
      "id": "s1",
      "title": { "en": "Drag the point", "ur": "نقطہ گھمائیں" },
      "body": { "en": "Drag the point round the circle. The circle has radius 1.", "ur": "نقطے کو دائرے پر گھمائیں۔ دائرے کا رداس 1 ہے۔" },
      "sceneState": { "params": { "angle": 30 }, "show": ["circle", "point"] }
    },
    {
      "id": "s2",
      "title": { "en": "Sine is the height", "ur": "سائن اونچائی ہے" },
      "body": { "en": "The height of the point is the **sine**. At 30 degrees it is 0.5.", "ur": "نقطے کی اونچائی **سائن** ہے۔ 30 ڈگری پر یہ 0.5 ہے۔" },
      "formulaRefs": ["f1"],
      "sceneState": { "show": ["sine", "wave"] }
    },
    {
      "id": "s3",
      "title": { "en": "Cosine is the width", "ur": "کوسائن چوڑائی ہے" },
      "body": { "en": "The width of the point is the **cosine**. It is 0.866 at 30 degrees.", "ur": "نقطے کی چوڑائی **کوسائن** ہے۔ 30 ڈگری پر یہ 0.866 ہے۔" },
      "formulaRefs": ["f2"],
      "sceneState": { "show": ["cosine"] }
    }
  ],
  "formulas": [
    {
      "id": "f1", "latex": "\\sin\\theta = {{s}}",
      "caption": { "en": "Sine of the angle", "ur": "زاویے کا سائن" },
      "bind": { "s": { "expr": "sin(rad(angle))", "decimals": 4 } },
      "checks": [{ "at": { "angle": 30 }, "expect": { "s": 0.5 } }, { "at": { "angle": 150 }, "expect": { "s": 0.5 } }]
    },
    {
      "id": "f2", "latex": "\\cos\\theta = {{c}}",
      "caption": { "en": "Cosine of the angle", "ur": "زاویے کا کوسائن" },
      "bind": { "c": { "expr": "cos(rad(angle))", "decimals": 4 } },
      "checks": [{ "at": { "angle": 60 }, "expect": { "c": 0.5 } }]
    },
    {
      "id": "f3", "latex": "\\sin^2\\theta + \\cos^2\\theta = 1",
      "identity": { "lhs": "sin(rad(angle))^2 + cos(rad(angle))^2", "rhs": "1" }
    }
  ],
  "example": {
    "title": { "en": "Find sine and cosine at an angle", "ur": "کسی زاویے پر سائن اور کوسائن معلوم کریں" },
    "problem": { "en": "A point sits at {{a}} degrees on the unit circle. Find its height and width.", "ur": "اکائی دائرے پر ایک نقطہ {{a}} ڈگری پر ہے۔ اس کی اونچائی اور چوڑائی معلوم کریں۔" },
    "inputs": [
      { "id": "a", "label": { "en": "Angle", "ur": "زاویہ" }, "min": 0, "max": 360, "step": 1, "default": 30, "unit": "deg" }
    ],
    "lines": [
      {
        "text": { "en": "The height is the sine of the angle.", "ur": "اونچائی زاویے کا سائن ہے۔" },
        "math": "\\sin {{a}}^\\circ = {{h}}",
        "calc": { "name": "h", "expr": "sin(rad(a))", "decimals": 4, "expect": 0.5 }
      },
      {
        "text": { "en": "The width is the cosine of the angle.", "ur": "چوڑائی زاویے کا کوسائن ہے۔" },
        "math": "\\cos {{a}}^\\circ = {{w}}",
        "calc": { "name": "w", "expr": "cos(rad(a))", "decimals": 4, "expect": 0.866 }
      }
    ],
    "answer": { "text": { "en": "Height {{h}}, width {{w}}.", "ur": "اونچائی {{h}}، چوڑائی {{w}}۔" } }
  },
  "tryThis": [
    { "en": "Drag the point to 90 degrees. What is the width?", "ur": "نقطے کو 90 ڈگری پر لے جائیں۔ چوڑائی کیا ہے؟" },
    { "en": "Find two angles where the sine is 0.5.", "ur": "دو ایسے زاویے تلاش کریں جن کا سائن 0.5 ہو۔" }
  ],
  "watchOut": { "en": "Sine is the height, not the distance along the circle.", "ur": "سائن اونچائی ہے، دائرے کے ساتھ فاصلہ نہیں۔" },
  "quiz": []
}
```

Note on the example: `calc.expect` for `w` is 0.866 with `decimals: 4`; the true value 0.8660254 differs by 2.5e-5, inside the allowed 0.5e-4.
