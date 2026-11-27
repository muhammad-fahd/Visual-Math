import { SCENE_META, type SceneMeta } from '../lib/topic-schema/scenes/meta';

// The scene registry of the viewer (AD-2): every `type@v` the topic schema knows has exactly one
// entry here. The schema half lives in lib (the upload service in `server` needs it and may not import
// `scenes`); this half is what the viewer needs, and it imports only `scenes/meta`, which has no
// imports, so zod never reaches a visitor's browser through here. Renderers (`render2D`, `render3D`,
// `static2D`) are added to an entry by the story that builds that scene type;
// `tests/unit/scene-registry.test.ts` fails when the two halves drift apart.

export type Texts = Record<string, string> | undefined;

export interface SceneEntry extends SceneMeta {
  /** Plain-language text of the scene for assistive technology ("More about this picture"). */
  describe(scene: { caption?: Texts; description?: Texts }, locale: string): string;
}

/** The text read for "More about this picture": the description, else the caption, in the visitor's language, else English. */
export function describeScene(scene: { caption?: Texts; description?: Texts }, locale: string): string {
  return scene.description?.[locale] ?? scene.caption?.[locale] ?? scene.description?.['en'] ?? scene.caption?.['en'] ?? '';
}

const entries = new Map<string, SceneEntry>(SCENE_META.map((meta) => [`${meta.type}@${meta.v}`, { ...meta, describe: describeScene }]));

export const sceneRegistry = {
  get: (type: string, v: number): SceneEntry | undefined => entries.get(`${type}@${v}`),
  keys: (): string[] => [...entries.keys()].sort(),
};
