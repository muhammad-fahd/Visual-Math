import { z } from 'zod';
import { createKit, type Kit } from './kit';
import { CURRENT_SCHEMA_VERSION } from './migrate';
import type { SceneRegistry } from './scene-registry';

// The topic schema: stage S1 of the upload pipeline (topic-format sections 1 and 5). Structure,
// types, sizes and unknown keys only. References, expressions, LaTeX, recompute and cost are later
// stages (Story 7.1) and are not here.

export interface SchemaOptions {
  /** The languages (src/i18n/locales.ts LOCALES); passed in because lib imports no other layer. */
  locales: readonly string[];
  registry: SceneRegistry;
}

const LEVELS = ['foundation', 'intermediate', 'advanced'] as const;
const TOPIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CAMERA_PRESETS = ['iso', 'front', 'top', 'side'] as const;

/** Marker for the one issue that stands for "this scene type is not registered". */
export const UNKNOWN_SCENE = 'E_UNKNOWN_SCENE_TYPE';

function buildSchema(kit: Kit, registry: SceneRegistry) {
  const { locText, ident, eid, expr } = kit;

  const Camera = z.union([
    z.strictObject({ azimuth: z.number().finite(), elevation: z.number().finite(), distance: z.number().finite().positive() }),
    z.strictObject({ preset: z.enum(CAMERA_PRESETS) }),
  ]);

  const SceneState = z.strictObject({
    params: kit.record(z.number().finite()).optional(),
    show: z.array(eid).max(20).optional(),
    hide: z.array(eid).max(20).optional(),
    camera: Camera.optional(),
  });

  // Terms are a Should field: a missing language in them is a warning (topic-format 1.3).
  const Term = z.strictObject({ id: eid, term: locText(40, false), definition: locText(200, false) });

  const Parameter = z
    .strictObject({
      id: ident,
      label: locText(40),
      kind: z.enum(['number', 'integer', 'toggle', 'choice']),
      min: z.number().finite(),
      max: z.number().finite(),
      step: z.number().finite().positive(),
      default: z.number().finite(),
      unit: kit.unit,
      options: z.array(z.strictObject({ value: z.number().finite(), label: locText(40) })).min(2).max(6).optional(),
    })
    .superRefine((p, ctx) => {
      if (!(p.min < p.max)) ctx.addIssue({ code: 'custom', message: 'min must be below max', params: { vm: 'E_RANGE' } });
    });

  const Derived = z.strictObject({ id: ident, expr });

  const Step = z.strictObject({
    id: eid,
    title: locText(60),
    body: locText(400),
    formulaRefs: z.array(eid).max(3).optional(),
    sceneState: SceneState.optional(),
  });

  const Formula = z.strictObject({
    id: eid,
    latex: z.string().min(1).max(200),
    caption: locText(120, false).optional(),
    bind: kit.record(z.strictObject({ expr, decimals: z.int().min(0).max(6) })).optional(),
    checks: z
      .array(
        z.strictObject({
          at: kit.record(z.number().finite()),
          expect: kit.record(z.union([z.number().finite(), z.literal('undefined')])),
        }),
      )
      .max(6)
      .optional(),
    identity: z.strictObject({ lhs: expr, rhs: expr }).optional(),
  });

  const Input = z
    .strictObject({
      id: ident,
      label: locText(30),
      min: z.number().finite(),
      max: z.number().finite(),
      step: z.number().finite().positive(),
      default: z.number().finite(),
      unit: kit.unit,
    })
    .superRefine((p, ctx) => {
      if (!(p.min < p.max)) ctx.addIssue({ code: 'custom', message: 'min must be below max', params: { vm: 'E_RANGE' } });
    });

  const Line = z.strictObject({
    text: locText(240),
    math: z.string().max(200).optional(),
    calc: z.strictObject({ name: ident, expr, decimals: z.int().min(0).max(6), expect: z.number().finite() }).optional(),
  });

  const Example = z.strictObject({
    title: locText(80),
    problem: locText(300),
    inputs: z.array(Input).min(1).max(4),
    lines: z.array(Line).min(2).max(8),
    answer: z.strictObject({ text: locText(200), math: z.string().max(200).optional() }),
  });

  // The scene: found in the registry by (type, v), then parsed by that entry's schema. An entry that
  // does not exist is one clear problem, never a fallback (FR-9.15). Schemas are built once per entry.
  const sceneSchemas = new Map(registry.definitions.map((d) => [`${d.type}@${d.v}`, d.schema(kit)]));
  const Scene = z.unknown().superRefine((value, ctx) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      ctx.addIssue({ code: 'invalid_type', expected: 'object', input: value, message: 'Invalid input: expected object' });
      return;
    }
    const { type, v } = value as { type?: unknown; v?: unknown };
    const definition = registry.get(type, v);
    if (!definition) {
      ctx.addIssue({
        code: 'custom',
        message: `Scene type '${String(type)}' v${String(v)} is not registered. Registered: ${registry.keys().join(', ') || '(none)'}.`,
        params: { vm: UNKNOWN_SCENE },
      });
      return;
    }
    const result = sceneSchemas.get(`${definition.type}@${definition.v}`)!.safeParse(value);
    if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: issue.path } as never);
  });

  return z.strictObject({
    schemaVersion: z.int().min(1).max(CURRENT_SCHEMA_VERSION),
    id: z.string().regex(TOPIC_ID, 'use lowercase letters, digits and hyphens').min(3).max(64),
    path: z.strictObject({ category: kit.slug, subcategory: kit.slug, chapter: kit.slug }),
    chapterOrder: z.int().min(1).max(20),
    level: z.enum(LEVELS),
    estimatedMinutes: z.int().min(5).max(20),
    title: locText(80),
    summary: locText(160),
    goal: locText(200),
    tags: kit.locList(1, 8, 30),
    prerequisites: z.array(z.string().regex(TOPIC_ID).min(3).max(64)).max(5).optional(),
    next: z.array(z.string().regex(TOPIC_ID).min(3).max(64)).max(3).optional(),
    terms: z.array(Term).max(12).optional(),
    parameters: z.array(Parameter).min(1).max(8),
    derived: z.array(Derived).max(20).optional(),
    scene: Scene,
    steps: z.array(Step).min(3).max(6),
    formulas: z.array(Formula).min(1).max(10),
    example: Example,
    tryThis: z.array(locText(200, false)).min(2).max(3).optional(),
    watchOut: locText(240, false).optional(),
    quiz: z.array(z.unknown()).optional(),
  });
}

export type TopicSchema = ReturnType<typeof buildSchema>;
export type Topic = z.infer<TopicSchema>;

export function createTopicSchema(options: SchemaOptions): TopicSchema {
  return buildSchema(createKit(options.locales), options.registry);
}
