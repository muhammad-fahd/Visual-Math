import { snap, type ParamSpec } from './index';

// What a step does to the scene (FR-4.2, 4.3). The state at a step is rebuilt from the first step to it,
// so Back is exact, and it is applied only to the parameters the visitor has not moved by hand: a value
// they set is theirs and stays across steps. Pure.

export interface StepScene {
  readonly params?: Readonly<Record<string, number>>;
  readonly show?: readonly string[];
  readonly hide?: readonly string[];
  readonly camera?: unknown;
}

export interface StepLike {
  readonly sceneState?: StepScene;
}

export interface SceneAtStep {
  /** Every parameter: what the steps up to here set, else its start value. */
  readonly params: Record<string, number>;
  /** Parts a step has hidden and not shown again. */
  readonly hidden: ReadonlySet<string>;
  /** Parts a step has shown and not hidden again (an element that starts invisible appears this way). */
  readonly shown: ReadonlySet<string>;
  /** The latest camera a step named, or undefined for the topic's own. */
  readonly camera: unknown;
}

export function sceneAtStep(steps: readonly StepLike[], index: number, specs: readonly ParamSpec[]): SceneAtStep {
  const known = new Map(specs.map((s) => [s.id, s]));
  const params: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const s of specs) params[s.id] = s.default;
  const hidden = new Set<string>();
  const shown = new Set<string>();
  let camera: unknown;
  const last = Math.min(Math.max(0, Number.isFinite(index) ? Math.floor(index) : 0), steps.length - 1);
  for (let i = 0; i <= last; i++) {
    const state = steps[i]?.sceneState;
    if (!state) continue;
    for (const [id, value] of Object.entries(state.params ?? {})) {
      const spec = known.get(id);
      if (spec && Number.isFinite(value)) params[id] = snap(spec, value);
    }
    for (const id of state.hide ?? []) {
      hidden.add(id);
      shown.delete(id);
    }
    for (const id of state.show ?? []) {
      hidden.delete(id);
      shown.add(id);
    }
    if (state.camera !== undefined) camera = state.camera;
  }
  return { params, hidden, shown, camera };
}

/** The values after entering a step: untouched parameters take the step's state, touched ones keep theirs. */
export function enterStep(values: Readonly<Record<string, number>>, target: Readonly<Record<string, number>>, touched: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const id of Object.keys(values)) out[id] = touched.has(id) || !Object.hasOwn(target, id) ? values[id]! : target[id]!;
  return out;
}
