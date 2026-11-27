// The classes of the scene color tokens (DESIGN.md), written out in full so Tailwind finds them. Shared by the
// renderers of the 2D scene types; a token is a name, never a color value.
import type { Token } from '../lib/graph';

export const STROKE: Record<Token, string> = {
  axis: 'stroke-axis',
  grid: 'stroke-grid',
  curve1: 'stroke-curve-1',
  curve2: 'stroke-curve-2',
  fill: 'stroke-fill',
  accent: 'stroke-accent',
  muted: 'stroke-muted',
  success: 'stroke-success',
  error: 'stroke-error',
  hint: 'stroke-hint',
  selected: 'stroke-selected',
  edge: 'stroke-edge',
  section: 'stroke-section',
};
export const FILL: Record<Token, string> = {
  axis: 'fill-axis',
  grid: 'fill-grid',
  curve1: 'fill-curve-1',
  curve2: 'fill-curve-2',
  fill: 'fill-fill',
  accent: 'fill-accent',
  muted: 'fill-muted',
  success: 'fill-success',
  error: 'fill-error',
  hint: 'fill-hint',
  selected: 'fill-selected',
  edge: 'fill-edge',
  section: 'fill-section',
};
