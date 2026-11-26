// The solids of `solid3d@1` as pure data and their projection (Story 2.4).
export { DIMS, KINDS, build } from './kinds';
export type { Dimension, Dims, Geometry, Kind, NetPart, Panel, Vec3 } from './kinds';
export { FIT, HALF, WINDOW, drawLayers, drawList, project, rotate } from './project';
export type { DrawEdge, DrawFace, DrawList, Mode, Projected, ViewLike } from './project';
export { basis, clipBelow, enclosedVolume, planeFrom } from './clip';
export type { Plane, Poly } from './clip';
export { crossSection, sectionPlane } from './section';
export type { Measure, Section, SectionSpec, ShapeName } from './section';
export { netPose, netRadius } from './net';
export { compose, layerOfPolys, solidLayer } from './layers';
export type { Composed, Layer, SceneState, Token } from './layers';
