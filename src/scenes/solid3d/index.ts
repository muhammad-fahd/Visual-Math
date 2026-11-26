// The renderers of `solid3d@1` (Story 2.4). `Solid3D` is deliberately not exported here: it is a lazy
// chunk, imported with `next/dynamic` by the viewer, so that nothing else can pull three.js into a page.
export { Solid2D } from './Solid2D';
export type { Layers, Solid2DProps } from './Solid2D';
export { OFFER_AFTER_MS, TIER_KEY, lightChosen, rememberLight, webglAvailable } from './tier';
export type { Tier } from './tier';
