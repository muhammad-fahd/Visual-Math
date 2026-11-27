import type { z } from 'zod';
import { createKit } from './kit';
import { commonSceneShape } from './scenes/common';
import { createTopicSchema, type SchemaOptions } from './schema';

// The field table generated from the schema, so CI can diff it against topic-format.md (AD-27): the
// schema is the source of truth, and a field the document lacks, or one only the document has, or one
// the two disagree on being required, is a bug named by the test.

export interface FieldRow {
  readonly name: string;
  readonly required: boolean;
}

interface Def {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  innerType?: z.ZodType;
}
const defOf = (s: z.ZodType): Def => (s as unknown as { def: Def }).def;

function unwrap(s: z.ZodType): z.ZodType {
  let cur = s;
  for (let i = 0; i < 8; i++) {
    const def = defOf(cur);
    if ((def.type === 'optional' || def.type === 'nullable' || def.type === 'default') && def.innerType) cur = def.innerType;
    else break;
  }
  return cur;
}

const isOptional = (s: z.ZodType): boolean => defOf(s).type === 'optional';

function rowsOf(object: z.ZodType): FieldRow[] {
  const shape = defOf(unwrap(object)).shape ?? {};
  return Object.entries(shape).map(([name, s]) => ({ name, required: !isOptional(s) }));
}

const elementOf = (array: z.ZodType): z.ZodType => defOf(unwrap(array)).element!;

/** Every object kind of topic-format sections 1 and 2.1 and its fields, in schema order. */
export function fieldTables(options: SchemaOptions): Record<string, FieldRow[]> {
  const topic = createTopicSchema(options);
  const shape = topic.shape as unknown as Record<string, z.ZodType>;
  const example = unwrap(shape['example']!);
  const exampleShape = defOf(example).shape as Record<string, z.ZodType>;
  const kit = createKit(options.locales);
  const common = commonSceneShape(kit) as unknown as Record<string, z.ZodType>;
  // Each registered scene type: its own fields, without the common ones (those are SceneCommon).
  const skip = new Set(['type', 'v', ...Object.keys(common)]);
  const scenes: Record<string, FieldRow[]> = {};
  for (const d of options.registry.definitions) {
    scenes[`scene:${d.type}@${d.v}`] = rowsOf(d.schema(kit)).filter((r) => !skip.has(r.name));
  }
  return {
    ...scenes,
    Topic: rowsOf(topic),
    Term: rowsOf(elementOf(shape['terms']!)),
    Parameter: rowsOf(elementOf(shape['parameters']!)),
    Derived: rowsOf(elementOf(shape['derived']!)),
    Step: rowsOf(elementOf(shape['steps']!)),
    Formula: rowsOf(elementOf(shape['formulas']!)),
    Example: rowsOf(example),
    Input: rowsOf(elementOf(exampleShape['inputs']!)),
    Line: rowsOf(elementOf(exampleShape['lines']!)),
    // `type` and `v` are required by every scene type; the rest are the shared fields.
    SceneCommon: [{ name: 'type', required: true }, { name: 'v', required: true }, ...Object.entries(common).map(([name, s]) => ({ name, required: !isOptional(s) }))],
  };
}

/** The same table as Markdown, for a reader or a snapshot. */
export function fieldTableMarkdown(options: SchemaOptions): string {
  return Object.entries(fieldTables(options))
    .map(([group, rows]) => `### ${group}\n\n| Field | Required |\n| --- | --- |\n${rows.map((r) => `| \`${r.name}\` | ${r.required ? 'yes' : 'no'} |`).join('\n')}\n`)
    .join('\n');
}
