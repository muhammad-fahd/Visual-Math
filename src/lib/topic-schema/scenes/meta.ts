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

export const SPACE3D_META: SceneMeta = {
  type: 'space3d',
  v: 1,
  // The element ids a step may show or hide are the topic's own; these three are fixed parts.
  partIds: ['axes', 'grid', 'box'],
};

export const MATRIX_TRANSFORM_META: SceneMeta = {
  type: 'matrix-transform',
  v: 1,
  partIds: ['shape', 'basis', 'determinant', 'eigen', 'grid'],
};

export const CANVAS2D_META: SceneMeta = {
  type: 'canvas2d',
  v: 1,
  // The element ids a step may show or hide are the topic's own; these two are fixed parts.
  partIds: ['axes', 'grid'],
};

export const RIGHT_TRIANGLE_META: SceneMeta = {
  type: 'right-triangle',
  v: 1,
  partIds: ['triangle', 'rightAngle', 'angleArc', 'sideLabels', 'ratios'],
};

export const STATS_META: SceneMeta = {
  type: 'stats',
  v: 1,
  partIds: ['mean', 'median', 'fit', 'residuals', 'shade', 'expected', 'labels'],
};

export const NUMBER_MODEL_META: SceneMeta = {
  type: 'number-model',
  v: 1,
  partIds: ['marks', 'jumps', 'align', 'labels'],
};

export const ALGEBRA_TOOL_META: SceneMeta = {
  type: 'algebra-tool',
  v: 1,
  partIds: ['labels', 'rule', 'notes'],
};

export const SCENE_META: readonly SceneMeta[] = [UNIT_CIRCLE_META, SOLID3D_META, CANVAS2D_META, NUMBER_MODEL_META, ALGEBRA_TOOL_META, RIGHT_TRIANGLE_META, STATS_META, SPACE3D_META, MATRIX_TRANSFORM_META];
