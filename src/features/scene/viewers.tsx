'use client';

import type { ComponentType } from 'react';
import { AlgebraToolViewer } from './AlgebraToolViewer';
import { Canvas2DViewer } from './Canvas2DViewer';
import { MatrixViewer } from './MatrixViewer';
import { SurfaceViewer } from './SurfaceViewer';
import { NumberModelViewer } from './NumberModelViewer';
import { SolidViewer } from './SolidViewer';
import { SpaceViewer } from './SpaceViewer';
import { StatsViewer } from './StatsViewer';
import { RightTriangleViewer, UnitCircleViewer } from './TrigViewers';
import type { SceneViewerProps } from './viewerProps';

// The viewer of each scene type (Story 3.1): a new scene type is one registry entry in the schema and one
// line here; the topic page, its steps, the address and Reset all do not change. A type with no viewer yet
// (the unit circle until Story 3.5) is shown by the page as its words and steps only.
const VIEWERS: Record<string, ComponentType<SceneViewerProps>> = {
  solid3d: SolidViewer as unknown as ComponentType<SceneViewerProps>,
  canvas2d: Canvas2DViewer as unknown as ComponentType<SceneViewerProps>,
  'number-model': NumberModelViewer as unknown as ComponentType<SceneViewerProps>,
  'algebra-tool': AlgebraToolViewer as unknown as ComponentType<SceneViewerProps>,
  'unit-circle': UnitCircleViewer as unknown as ComponentType<SceneViewerProps>,
  'right-triangle': RightTriangleViewer as unknown as ComponentType<SceneViewerProps>,
  stats: StatsViewer as unknown as ComponentType<SceneViewerProps>,
  space3d: SpaceViewer as unknown as ComponentType<SceneViewerProps>,
  'matrix-transform': MatrixViewer as unknown as ComponentType<SceneViewerProps>,
  surface3d: SurfaceViewer as unknown as ComponentType<SceneViewerProps>,
};

export function viewerFor(type: unknown): ComponentType<SceneViewerProps> | undefined {
  return typeof type === 'string' && Object.hasOwn(VIEWERS, type) ? VIEWERS[type] : undefined;
}
