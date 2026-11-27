---
title: 'Story 2.2: Topic schema, MD parser and scene registry'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '70c1c23b2f1ef972eba939920732b297b3f44682'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-1-expression-module.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/topic-format.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The topic format exists only as a document. Nothing can say whether a topic file is well formed, turn the human-readable MD form into the JSON form, tell which scene types exist, or give a version of a topic a stable identity.

**Approach:** Put the format in code in `src/lib/topic-schema/` (pure, server and browser): a strict Zod schema for stage S1 of the upload pipeline with the problem codes of topic-format section 5, a scene registry from which the schema takes its scene union, `parseMd`, and `canonicalize` with a `sha256:` content hash. Add the worked example as the single fixture in both forms, and CI checks: the MD twin equals the JSON, and a field table generated from the schema is diffed against `topic-format.md`.

## Boundaries & Constraints

**Always:** `topic-format.md` is the contract; where code and document disagree the schema wins and the document is a bug (and the diff check says so). `lib` imports nothing from the repo layers (`locales` are passed in, never imported). Unknown keys are errors everywhere, with the allowed keys listed. Problems are values: `{code, severity, pointer, message}` with the message templates of section 5; nothing throws for any input. The scene union comes only from the registry: a registered `type@v` needs no change to the schema or to the topic page. Records keyed by author ids reject `__proto__`, `constructor`, `prototype`, function names and constants as keys. `canonicalize` is stable across key order and across Unicode normalization forms (NFC), and rejects values JSON cannot carry. The hash is `sha256:` plus 64 lowercase hex characters.

**Never:** No stages S2 to S6 (references, taxonomy, expression and LaTeX checks, recompute, scene cost, locale warnings beyond the ones listed) and no S0 size, depth and bidi checks: those are Story 7.1, which also adds the fixture per error code. No scene type other than `unit-circle@1` (the others arrive in Epic 3 and Story 2.4), no renderer, no topic page. No upload endpoint, no database writes, no admin UI. No quiz fields beyond the reserved empty one. No images.

**Decisions (mine, recorded):**
- Scene schemas live in `src/lib/topic-schema/scenes/` (not in `src/scenes/`) because the upload service is in `server`, which may import `lib` but not `scenes` (AD-1). `src/scenes/registry.ts` maps the same `type@v` keys to renderer slots and is checked against the lib registry by a test.
- `contentHash` is asynchronous (Web Crypto `subtle.digest`, present in Node 24 and every browser in the browserslist); `canonicalize` is synchronous.
- Key order is by UTF-16 code unit after NFC (the JavaScript default sort); two keys that collide after NFC are an error.
- In MD, a leaf given in front matter (even one locale of it) and also under a heading is E_MD_DUPLICATE; `tags` use commas, ASCII or Arabic (U+060C); scene readout labels and option labels have heading paths too (`scene.readouts.<id>.label`, `parameters.<id>.options.<n>.label`).
- A leaf present under only some locales is not a parse error in MD (it is E_LOCALE_MISSING from the schema), as in JSON.
- `yaml` moves from `devDependencies` to `dependencies`; front matter is parsed with the YAML 1.2 core schema, no aliases, no anchors, no explicit tags, no merge keys, unique keys.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Worked example | section 6 JSON, registry with `unit-circle@1` | valid; no problems; `quiz: []` gives no warning | N/A |
| MD twin | the MD form of the example | `parseMd` gives an object deeply equal to the JSON file | N/A |
| Unknown key | `"extra": 1` at top level, in a step, in the scene | `E_UNKNOWN_KEY` at that pointer, `Allowed: ...` listed | one problem per key |
| Unknown scene | `scene.type` not registered, or `v` not registered | `E_UNKNOWN_SCENE_TYPE` naming `type`, `v` and the registered list | no fallback |
| Registered fake type | a test registers `fake@1` | topics with it validate with no schema change | N/A |
| Version | `schemaVersion: 2` | `E_SCHEMA_VERSION` only | `0`, `1.5`, missing: `E_SCHEMA` |
| Quiz | `quiz: [1]` | valid with warning `W_QUIZ_IGNORED` | N/A |
| Locale missing | no `ur` in `title`, in `tags`, in a step body | `E_LOCALE_MISSING` at that pointer | optional strings: `W_LOCALE_MISSING` warning |
| Extra locale | `fr` key in a LocaleText | `E_LOCALE_EXTRA` | N/A |
| Reserved ids | a parameter named `sin`, `pi`, `constructor`; record key `__proto__` | rejected | N/A |
| Types and limits | string for `chapterOrder`, 81-char title, 9 parameters | `E_SCHEMA` with pointer and what was expected | N/A |
| MD errors | no front matter; unterminated front matter; YAML error; `## fr`; `### nope`; heading repeated; leaf in both places | `E_MD_PARSE`, `E_LOCALE_EXTRA`, `E_MD_PATH`, `E_MD_DUPLICATE` as named | all problems of the file listed, with line numbers where known |
| MD front matter | alias, anchor, tag, merge key, duplicate key, `__proto__` | rejected, no prototype pollution | N/A |
| Canonical form | same document with other key order or NFD text | identical canonical string and hash | `NaN`, `Infinity`, `undefined`, functions, BigInt: error value |
| Golden vectors | fixed documents | fixed canonical strings and `sha256:` hashes | N/A |
| Field table | schema vs `topic-format.md` | generated table matches the document's tables | a missing, extra or differently required field fails the test naming it |
| Registry | `unit-circle@1` | same key set in `lib` and in `src/scenes/registry.ts` | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/expr/` -- Story 2.1: `parse`, `FUNCTION_NAMES` (reserved identifier names), `LIMITS`; the schema checks expression fields only for size here (grammar is S3, Story 7.1).
- `src/i18n/locales.ts` -- `LOCALES`; wired into the schema by callers, not imported by `lib`.
- `eslint.config.mjs` -- `lib` may import only `lib`; check that npm imports (`zod`, `yaml`) pass.
- `package.json` -- `yaml` 2.9.1 (devDependency today), `zod` 4.6.7.
- `topic-format.md` sections 1, 2.1, 2.4, 4, 5, 6 -- the contract, the unit-circle scene, the MD layout, messages, the worked example.
- `content/` -- does not exist yet; `content/fixtures/` holds the fixture.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/topic-schema/{canonicalize,hash,types}.ts` -- canonical JSON, content hash, problem type and pointer helper
- [x] `src/lib/topic-schema/{kit,schema,scene-registry,migrate}.ts`, `scenes/{unit-circle,index}.ts` -- shared field builders, the topic schema built from locales and registry, `unit-circle@1`, `migrate`
- [x] `src/lib/topic-schema/validate.ts` -- issue mapping to the section 5 codes, warnings, `formatProblem`
- [x] `src/lib/topic-schema/md.ts` -- `parseMd`
- [x] `src/lib/topic-schema/field-table.ts`, `index.ts` -- generated field table, barrel
- [x] `src/scenes/registry.ts` -- registry entry per `type@v` (renderers later)
- [x] `content/fixtures/trig-unit-circle.{json,md}` -- the worked example, both forms
- [x] `tests/unit/topic-*.test.ts` -- matrix rows, golden vectors, MD twin, document diff, registry parity
- [x] `package.json` (`yaml` to dependencies), `docs/coding-standard.md`, `deferred-work.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given topic-format.md, `lib/topic-schema` validates the worked example and a CI check diffs the generated field table against the document.
- Given the MD twin of the example, `parseMd` produces a JSON object equal to the JSON file; duplicate and unmatched headings give E_MD_DUPLICATE and E_MD_PATH.
- Given an unregistered `type@v`, validation fails with E_UNKNOWN_SCENE_TYPE; a registered type needs no change to the topic page.
- Given `canonicalize`, golden vectors give stable `sha256` hashes across key order and Unicode forms.


## Review Triage Log

Inline review by the implementer (the owner chose no subagents for this story), over the full diff and the hostile-input paths, with three deliberate breakages (see the notes).

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| The heading regex `^## +(\S.*?)\s*$` took 62 seconds on one line of 300,000 spaces: a denial of service from a 1 MiB file | high | patch: trim first, then a regex with no lazy quantifier; a timing test (fails on the old regex, passes in milliseconds) |
| Zod silently drops an own `__proto__` key in a record, so `bind: {"__proto__": ...}` validated | high | patch: every own `__proto__` key anywhere is a problem (E_ID_FORMAT, or E_UNKNOWN_KEY where the schema already says so); tests |
| `canonicalize` wrote a sparse array's hole as an empty slot (invalid JSON) | medium | patch: index by index, a hole is refused with its pointer; test |
| The viewer registry imported the barrel, which would bring zod and yaml into the visitor's bundle | medium | patch: `scenes/meta.ts` has no imports; `src/scenes/registry.ts` imports only it; a test asserts both |
| Terms' texts were required in every language although topic-format 1.3 calls them Should | medium | patch: optional beyond the first language; a missing one is `W_LOCALE_MISSING` |
| The document's Parameter table lists `min`, `max` in one row, which the diff parser did not split | low | patch in the test parser; the diff found no real disagreement |
| `invalid_union` gave Zod's bare "Invalid input" | low | patch: "None of the allowed forms matches this value." |
| `contentHash` throws an unhelpful TypeError where Web Crypto is missing | low | patch: a clear message |
| `contentHash` and the parsed document disagree on Unicode form until S0 normalizes to NFC | low | accept: canonicalize applies NFC itself, so the hash is right; S0 (Story 7.1) normalizes what is stored |
| Duplicate keys in a JSON file (last one wins in `JSON.parse`) | medium | defer: S0 in Story 7.1 must parse with duplicate detection |
| S0 size, depth and bidi checks, S2 to S6, one fixture per code | medium | defer: Story 7.1, as the story text says |
| `fieldTables` skips Derived/Term texts' markup rules and scene-specific object sub-fields | low | accept: it diffs fields and required flags, which is what AD-27 asks |
| MD: a path to a text inside a scene type's own fields (labels in canvas2d) has no heading | low | defer: each scene type story adds its text paths to the MD layout |

## Implementation Notes
- Files: `src/lib/topic-schema/` (types, canonicalize, hash, migrate, kit, schema, scene-registry, scenes/{meta,common,unit-circle,index}, validate, md, field-table, index), `src/scenes/registry.ts`, `content/fixtures/trig-unit-circle.{json,md}`.
- The worked example validates with no change to its text. The field table matched the document (one parser fix in the test, no real disagreement). The only code-vs-document difference found: topic-format 1.4 shows `Term` texts as required, 1.3 says Should; the schema follows 1.3.
- `yaml` 2.9.1 moved to dependencies (it parses front matter at run time on the server). `package-lock.json` updated.
- Three deliberate breakages checked in review: the old heading regex (62 s), an import from lib into scenes (caught by the layer test and the boundaries lint), and the `__proto__` record case (found by a test, fixed).
- Tests: 949 in the repository (about 190 new): `topic-canonical`, `topic-schema`, `topic-md`, `topic-format-doc`, `scene-registry`.
