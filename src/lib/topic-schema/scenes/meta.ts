// What the viewer needs to know about a scene type without its schema: the key and the fixed parts.
// No imports on purpose: src/scenes reads this file, and the schemas (which pull in zod) must not reach
// a visitor's browser through the viewer registry. One entry per scene type; its schema is in the
// type's own file next to this one, and a test keeps the two lists together.

export interface SceneMeta {
  readonly type: string;
  readonly v: number;
  /** Ids a step may `show` or `hide`. */
  readonly partIds: readonly string[];
}

export const UNIT_CIRCLE_META: SceneMeta = {
  type: 'unit-circle',
  v: 1,
  partIds: ['circle', 'point', 'radius', 'arc', 'cosine', 'sine', 'tangent', 'wave', 'quadrants'],
};

export const SOLID3D_META: SceneMeta = {
  type: 'solid3d',
  v: 1,
  partIds: ['solid', 'dimensions', 'section', 'net', 'fill'],
};

export const CANVAS2D_META: SceneMeta = {
  type: 'canvas2d',
  v: 1,
  // The element ids a step may show or hide are the topic's own; these two are fixed parts.
  partIds: ['axes', 'grid'],
};

export const NUMBER_MODEL_META: SceneMeta = {
  type: 'number-model',
  v: 1,
  partIds: ['marks', 'jumps', 'align', 'labels'],
};

export const SCENE_META: readonly SceneMeta[] = [UNIT_CIRCLE_META, SOLID3D_META, CANVAS2D_META, NUMBER_MODEL_META];
