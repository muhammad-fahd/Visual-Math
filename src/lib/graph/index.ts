// 2D graphs as pure data (Story 3.1): the window, sampling with breaks, and the features worth marking.
export { H, W, effectiveViewport, fromX, fromY, niceTicks, sane, tickDecimals, toX, toY } from './viewport';
export type { GraphView, Viewport } from './viewport';
export { MAX_SAMPLES, MIN_SAMPLES, sampleFunction, sampleParametric } from './sample';
export type { Pt, Segment } from './sample';
export { analyze } from './analyze';
export type { AnalyzeOptions, Features, Fn, Turning } from './analyze';
export { CURVE_SEQUENCE, buildDrawables, measureLabel, resolveViewport } from './build';
export { angleAt, circleArea, circumference, clipLine, distance, perimeter, polygonArea, reflectLine, reflectX, reflectY, rotate, scaleAbout, translate } from './geometry';
export type { P } from './geometry';
export type { BuildOptions, DrawMeasure, DrawShape, ShapeStyle, Transform, Canvas2DScene, CurveStyle, Dash, Drawables, DrawCurve, DrawPoint, DrawReadout, DrawRegion, DrawText, Element, Label, Marker, Style, Token } from './build';
