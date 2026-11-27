import { z } from 'zod';
import { LOCALE_OBJECT, createKit } from './kit';
import { migrate } from './migrate';
import type { SceneRegistry } from './scene-registry';
import { createTopicSchema, type SchemaOptions, type Topic } from './schema';
import { err, toPointer, warn, type Outcome, type Problem } from './types';

// Turns Zod's issues into the problems of topic-format section 5 (stage S1 and the locale codes), and
// adds the warnings. Nothing here throws for any input.

type Issue = { code: string; path: PropertyKey[]; message: string; keys?: string[]; expected?: string; params?: { vm?: string }; key?: unknown; origin?: string };

interface Def {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  valueType?: z.ZodType;
  innerType?: z.ZodType;
}
const defOf = (s: z.ZodType): Def => (s as unknown as { def: Def }).def;

/** Looks through optional, nullable and default wrappers (refinements do not change the schema object). */
function unwrap(s: z.ZodType): z.ZodType {
  let current = s;
  for (let i = 0; i < 8; i++) {
    const def = defOf(current);
    if ((def.type === 'optional' || def.type === 'nullable' || def.type === 'default') && def.innerType) current = def.innerType;
    else break;
  }
  return current;
}

/** The schema at a path, following objects, arrays and records. The scene is looked up in the registry. */
function schemaAt(root: z.ZodType, path: readonly PropertyKey[], doc: unknown, scenes: ReadonlyMap<string, z.ZodType>): z.ZodType | undefined {
  let node: z.ZodType | undefined = root;
  for (let i = 0; i < path.length && node; i++) {
    const seg = path[i]!;
    node = unwrap(node);
    const def = defOf(node);
    if (def.type === 'object' && def.shape) {
      if (seg === 'scene' && i === 0) {
        const scene = (doc as { scene?: { type?: unknown; v?: unknown } } | null)?.scene;
        const found = scenes.get(`${String(scene?.type)}@${String(scene?.v)}`);
        if (found) node = found;
        else node = undefined;
      } else node = def.shape[String(seg)];
    } else if (def.type === 'array' && def.element) node = def.element;
    else if (def.type === 'record' && def.valueType) node = def.valueType;
    else node = undefined;
  }
  return node ? unwrap(node) : undefined;
}

const keysOf = (s: z.ZodType | undefined): string[] | undefined => {
  const shape = s ? defOf(s).shape : undefined;
  return shape ? Object.keys(shape) : undefined;
};

const isLocaleObject = (s: z.ZodType | undefined): boolean => Boolean(s && (s as unknown as Record<symbol, unknown>)[LOCALE_OBJECT]);

function valueAt(doc: unknown, path: readonly PropertyKey[]): unknown {
  let cur: unknown = doc;
  for (const seg of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[String(seg)];
  }
  return cur;
}

const typeName = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/**
 * Pointers of every own `__proto__` key in the document. Zod silently drops that key from a record, so
 * without this a record such as `bind` could carry it past validation; the format says it is an error
 * in any record (topic-format 1.1).
 */
function protoKeyPointers(value: unknown, path: (string | number)[] = [], out: string[] = [], depth = 0): string[] {
  if (depth > 64 || typeof value !== 'object' || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => protoKeyPointers(v, [...path, i], out, depth + 1));
    return out;
  }
  for (const key of Object.keys(value)) {
    if (key === '__proto__') out.push(toPointer([...path, key]));
    protoKeyPointers((value as Record<string, unknown>)[key], [...path, key], out, depth + 1);
  }
  return out;
}

/** Optional LocaleText positions (topic-format 1.3): a missing language there is a warning, not an error. */
function localeWarnings(topic: Topic, locales: readonly string[]): Problem[] {
  const out: Problem[] = [];
  const check = (value: unknown, path: (string | number)[]) => {
    if (typeof value !== 'object' || value === null) return;
    for (const l of locales) {
      if (!(l in value)) {
        const pointer = toPointer([...path, l]);
        out.push(warn('W_LOCALE_MISSING', pointer, `'${l}' text is missing at ${pointer} (optional string).`));
      }
    }
  };
  topic.formulas.forEach((f, i) => check(f.caption, ['formulas', i, 'caption']));
  check((topic.scene as { description?: unknown }).description, ['scene', 'description']);
  topic.terms?.forEach((t, i) => {
    check(t.term, ['terms', i, 'term']);
    check(t.definition, ['terms', i, 'definition']);
  });
  topic.tryThis?.forEach((t, i) => check(t, ['tryThis', i]));
  check(topic.watchOut, ['watchOut']);
  return out;
}

export interface TopicValidator {
  validate(doc: unknown): Outcome<Topic>;
  readonly schema: ReturnType<typeof createTopicSchema>;
  readonly registry: SceneRegistry;
  readonly locales: readonly string[];
}

export function createTopicValidator(options: SchemaOptions): TopicValidator {
  const schema = createTopicSchema(options);
  const { locales, registry } = options;
  // Scene schemas, keyed `type@v`, for finding the allowed keys inside a scene (the same ones the schema built).
  const kit = createKit(locales);
  const sceneSchemas = new Map<string, z.ZodType>(registry.definitions.map((d) => [`${d.type}@${d.v}`, d.schema(kit)]));

  function mapIssue(issue: Issue, doc: unknown): Problem[] {
    const path = issue.path;
    const pointer = toPointer(path);
    const parentPath = path.slice(0, -1);
    const last = path[path.length - 1];

    switch (issue.code) {
      case 'unrecognized_keys': {
        const target = schemaAt(schema, path, doc, sceneSchemas);
        const allowed = keysOf(target);
        const localeParent = isLocaleObject(target);
        return (issue.keys ?? []).map((key) =>
          localeParent
            ? err('E_LOCALE_EXTRA', toPointer([...path, key]), `Locale '${key}' is not configured.`)
            : err('E_UNKNOWN_KEY', toPointer([...path, key]), `Unknown key '${key}'.${allowed ? ` Allowed: ${allowed.join(', ')}.` : ''}`),
        );
      }
      case 'invalid_type': {
        const missing = valueAt(doc, path) === undefined;
        const parent = schemaAt(schema, parentPath, doc, sceneSchemas);
        if (missing && typeof last === 'string' && locales.includes(last) && isLocaleObject(parent)) {
          return [err('E_LOCALE_MISSING', pointer, `'${last}' text is missing at ${pointer} (required).`)];
        }
        const got = typeName(valueAt(doc, path));
        return [err('E_SCHEMA', pointer, `${issue.message} (expected ${issue.expected ?? 'another type'}, got ${got}).`)];
      }
      case 'invalid_format': {
        if (last === 'id') {
          return [err('E_ID_FORMAT', pointer, `'${String(valueAt(doc, path))}' is not a valid id; use lowercase letters, digits and hyphens.`)];
        }
        return [err('E_SCHEMA', pointer, `${issue.message}.`)];
      }
      case 'invalid_key': {
        const key = String(issue.key);
        return [err('E_ID_FORMAT', pointer, `'${key}' is not a valid id; use a lowercase name that is not a function, a constant or a prototype name.`)];
      }
      case 'custom': {
        const code = issue.params?.vm;
        if (code === 'E_UNKNOWN_SCENE_TYPE') return [err(code, pointer, issue.message)];
        if (code === 'E_ID_FORMAT') return [err(code, pointer, `'${String(valueAt(doc, path))}' ${issue.message}`)];
        if (code === 'E_RANGE') {
          const kind = path.includes('inputs') ? 'Input' : 'Parameter';
          const id = (valueAt(doc, path) as { id?: unknown } | undefined)?.id;
          return [err(code, pointer, `${kind} '${String(id)}': ${issue.message}`)];
        }
        return [err('E_SCHEMA', pointer, `${issue.message}.`)];
      }
      case 'invalid_union':
        return [err('E_SCHEMA', pointer, 'None of the allowed forms matches this value.')];
      default:
        return [err('E_SCHEMA', pointer, `${issue.message}.`)];
    }
  }

  function validate(input: unknown): Outcome<Topic> {
    try {
      const migrated = migrate(input);
      if (!migrated.ok) return { ok: false, problems: migrated.problems };
      const doc = migrated.value;
      if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
        return { ok: false, problems: [err('E_SCHEMA', '', `Invalid input: expected object (expected object, got ${typeName(doc)}).`)] };
      }
      const result = schema.safeParse(doc);
      const protoPointers = protoKeyPointers(doc);
      if (!result.success || protoPointers.length > 0) {
        const seen = new Set<string>();
        const problems: Problem[] = [];
        const add = (p: Problem) => {
          const key = `${p.code}|${p.pointer}|${p.message}`;
          if (!seen.has(key)) {
            seen.add(key);
            problems.push(p);
          }
        };
        if (!result.success) for (const issue of result.error.issues as unknown as Issue[]) mapIssue(issue, doc).forEach(add);
        for (const pointer of protoPointers) {
          if (!problems.some((p) => p.pointer === pointer)) {
            add(err('E_ID_FORMAT', pointer, "'__proto__' is not a valid id; use a lowercase name that is not a function, a constant or a prototype name."));
          }
        }
        return { ok: false, problems };
      }
      const topic = result.data;
      const problems = localeWarnings(topic, locales);
      // Stage S5: what the scene type itself can recompute. An error here is as final as a schema error.
      const scene = (topic as { scene?: { type?: unknown; v?: unknown } }).scene;
      const checked = registry.get(scene?.type, scene?.v)?.check?.(scene) ?? [];
      problems.push(...checked);
      if (checked.some((p) => p.severity === 'error')) return { ok: false, problems };
      if (Array.isArray(topic.quiz) && topic.quiz.length > 0) {
        problems.push(warn('W_QUIZ_IGNORED', '/quiz', 'The quiz field is reserved and is ignored in version 1.'));
      }
      return { ok: true, value: topic, problems };
    } catch {
      // A bug in a refinement is still not a throw to the caller.
      return { ok: false, problems: [err('E_SCHEMA', '', 'The topic could not be checked.')] };
    }
  }

  return { validate, schema, registry, locales };
}
