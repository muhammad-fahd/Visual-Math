import { z } from 'zod';
import { FUNCTION_NAMES } from '../expr';

// The building blocks of the topic schema (topic-format section 1). `createKit(locales)` is the only
// place a language list enters: a new language needs no schema edit (FR-6.7, NFR-7.4).

/** Names an author id may never take: they would shadow a function or constant, or reach the prototype. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([...FUNCTION_NAMES, 'pi', 'e', 'tau', '__proto__', 'constructor', 'prototype']);

/** Marks object schemas that hold one value per language, so error mapping can tell them apart. */
export const LOCALE_OBJECT = Symbol.for('vm.localeObject');

export const UNITS = ['none', 'deg', 'rad', 'cm', 'm', 'units', 'percent'] as const;
export type Unit = (typeof UNITS)[number];

export interface Kit {
  readonly locales: readonly string[];
  /** Text per language. `must`: every language required; otherwise only the first (`en`). */
  locText(max: number, must?: boolean): z.ZodType<Record<string, string>>;
  /** A list of strings per language (tags). */
  locList(minItems: number, maxItems: number, maxLen: number): z.ZodType<Record<string, string[]>>;
  /** Expression variable: a parameter, derived or input id. */
  ident: z.ZodType<string>;
  /** Id of a part, step, formula, term or element: hyphens allowed, never an expression variable. */
  eid: z.ZodType<string>;
  /** A topic, category, subcategory or chapter slug. */
  slug: z.ZodType<string>;
  /** An expression string: its grammar is checked in stage S3, here only its size. */
  expr: z.ZodType<string>;
  /** A number or an expression. */
  num: z.ZodType<number | string>;
  /** A record keyed by author ids (`params`, `bind`, `at`, `given`). */
  record<V extends z.ZodType>(value: V): z.ZodType<Record<string, z.infer<V>>>;
  label: z.ZodType<{ latex: string } | { text: Record<string, string> }>;
  unit: z.ZodType<Unit>;
}

const IDENT = /^[a-z][a-zA-Z0-9]{0,15}$/;
const EID = /^[a-z][a-zA-Z0-9-]{0,31}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function markLocale<T extends z.ZodType>(schema: T): T {
  (schema as unknown as Record<symbol, boolean>)[LOCALE_OBJECT] = true;
  return schema;
}

export function createKit(locales: readonly string[]): Kit {
  const first = locales[0];
  if (!first || new Set(locales).size !== locales.length) throw new Error('locales must be a non-empty list of distinct codes');

  const ident = z
    .string()
    .regex(IDENT, 'must start with a lowercase letter and use letters and digits only (at most 16)')
    .refine((s) => !RESERVED_NAMES.has(s), { message: 'is reserved (a function name, a constant, or a name that reaches the prototype)', params: { vm: 'E_ID_FORMAT' } });
  const eid = z.string().regex(EID, 'must start with a lowercase letter and use letters, digits and hyphens only (at most 32)');
  const slug = z.string().regex(SLUG, 'use lowercase letters, digits and hyphens').max(64);
  const expr = z.string().min(1).max(500);
  const num = z.union([z.number().finite(), expr]);

  const locText = (max: number, must = true): z.ZodType<Record<string, string>> => {
    const shape: Record<string, z.ZodType> = {};
    for (const l of locales) {
      const s = z.string().min(1).max(max);
      shape[l] = must || l === first ? s : s.optional();
    }
    return markLocale(z.strictObject(shape)) as unknown as z.ZodType<Record<string, string>>;
  };

  const locList = (minItems: number, maxItems: number, maxLen: number): z.ZodType<Record<string, string[]>> => {
    const shape: Record<string, z.ZodType> = {};
    for (const l of locales) shape[l] = z.array(z.string().min(1).max(maxLen)).min(minItems).max(maxItems);
    return markLocale(z.strictObject(shape)) as unknown as z.ZodType<Record<string, string[]>>;
  };

  const record = <V extends z.ZodType>(value: V) => z.record(ident, value) as unknown as z.ZodType<Record<string, z.infer<V>>>;

  const label = z.union([z.strictObject({ latex: z.string().min(1).max(80) }), z.strictObject({ text: locText(40) })]);

  return { locales, locText, locList, ident, eid, slug, expr, num, record, label: label as unknown as Kit['label'], unit: z.enum(UNITS) };
}
