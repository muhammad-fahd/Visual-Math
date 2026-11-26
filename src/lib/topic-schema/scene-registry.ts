import type { z } from 'zod';
import type { Kit } from './kit';

// The scene registry (AD-2): which `type@v` pairs exist and what each one's JSON looks like. The topic
// schema takes its scene union from here, so a new scene type is one registry entry and no change to
// the schema, the parser or the topic page. Renderers are in src/scenes/registry.ts.

export interface SceneDefinition {
  readonly type: string;
  readonly v: number;
  /** The scene object's schema, including the fields common to every scene (topic-format 2.1). */
  readonly schema: (kit: Kit) => z.ZodType;
  /** Ids a step may `show` or `hide` (the scene's fixed parts). */
  readonly partIds: readonly string[];
}

export interface SceneRegistry {
  get(type: unknown, v: unknown): SceneDefinition | undefined;
  /** `type@v` for every entry, sorted. */
  keys(): readonly string[];
  readonly definitions: readonly SceneDefinition[];
}

export const sceneKey = (type: string, v: number) => `${type}@${v}`;

export function createSceneRegistry(definitions: readonly SceneDefinition[]): SceneRegistry {
  const map = new Map<string, SceneDefinition>();
  for (const d of definitions) {
    const key = sceneKey(d.type, d.v);
    if (map.has(key)) throw new Error(`scene ${key} is registered twice`);
    map.set(key, Object.freeze({ ...d, partIds: Object.freeze([...d.partIds]) }));
  }
  return {
    get: (type, v) => (typeof type === 'string' && typeof v === 'number' && Number.isInteger(v) ? map.get(sceneKey(type, v)) : undefined),
    keys: () => [...map.keys()].sort(),
    definitions: [...map.values()],
  };
}
