import type { ReactNode } from 'react';
import type { Topic } from '../../lib/topic-schema';
import type { ViewerParts } from './SceneParts';
import type { ViewerStep } from './useSceneState';

// What every scene viewer takes from the topic page (Story 3.1): the topic's own scene object, the step,
// the formulas a step uses, values from the address, the Reset all counter, and what to do when the visitor
// changes a parameter. The page lays out the parts it gets back.
export interface SceneViewerProps {
  topic: {
    title: Record<string, string>;
    scene: unknown;
    parameters: Topic['parameters'];
    derived?: Topic['derived'];
    formulas: Topic['formulas'];
  };
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => ReactNode;
}
