import { createSceneRegistry } from '../scene-registry';
import { algebra_tool } from './algebra-tool';
import { canvas2d } from './canvas2d';
import { number_model } from './number-model';
import { rightTriangle } from './right-triangle';
import { solid3d } from './solid3d';
import { stats } from './stats';
import { unitCircle } from './unit-circle';

/** Every scene type the platform knows. Add one entry here (and its renderer in src/scenes) per new type. */
export const SCENE_DEFINITIONS = [unitCircle, solid3d, canvas2d, number_model, algebra_tool, rightTriangle, stats] as const;

export const defaultSceneRegistry = createSceneRegistry(SCENE_DEFINITIONS);
