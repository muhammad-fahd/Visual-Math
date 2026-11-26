import { createSceneRegistry } from '../scene-registry';
import { solid3d } from './solid3d';
import { unitCircle } from './unit-circle';

/** Every scene type the platform knows. Add one entry here (and its renderer in src/scenes) per new type. */
export const SCENE_DEFINITIONS = [unitCircle, solid3d] as const;

export const defaultSceneRegistry = createSceneRegistry(SCENE_DEFINITIONS);
