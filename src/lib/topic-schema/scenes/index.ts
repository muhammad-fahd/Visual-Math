import { createSceneRegistry } from '../scene-registry';
import { unitCircle } from './unit-circle';

/** Every scene type the platform knows. Add one entry here (and its renderer in src/scenes) per new type. */
export const SCENE_DEFINITIONS = [unitCircle] as const;

export const defaultSceneRegistry = createSceneRegistry(SCENE_DEFINITIONS);
