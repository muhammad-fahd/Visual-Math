// Trigonometry as pure data (Story 3.5): ratios and exact values, snapping, and the layouts of the unit circle and
// the right triangle as the prims of the shared SVG renderer.
export { POLE, SPECIAL_DEGREES, angleFromPointer, exactValue, fromDegrees, nextSpecial, normalize, quadrant, radText, snapAngle, toDegrees, trigValues, trim } from './values';
export type { PointerAngle, Ratios, Unit } from './values';
export { buildUnitCircle } from './unit-circle';
export type { Built as UnitCircleBuilt, UnitCircleOptions } from './unit-circle';
export { buildTriangle, solveTriangle } from './triangle';
export type { Built as TriangleBuilt, Given, Triangle, TriangleOptions } from './triangle';
