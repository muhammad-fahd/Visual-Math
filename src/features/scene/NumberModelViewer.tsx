'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { buildModel, type Model } from '../../lib/numbermodel';
import type { ParamSpec } from '../../lib/params';
import { plainMath } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { NumberModel } from '../../scenes/numbermodel';
import { SceneFrame } from '../../scenes/frame';
import { ModelHandles } from './ModelHandles';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';

// The viewer of a `number-model@1` topic (Story 3.3, FR-3.19): the model in its frame, the sliders and typed
// boxes, and a text list of what the picture shows. It shares parameters, steps, address, Reset all, readouts
// and formulas with the other viewers through `useSceneState`. Drag and drop is in `ModelHandles`.

type Loc = Record<string, string>;

export interface NumberModelSceneFull {
  model: Model;
  caption: Loc;
  description?: Loc;
  readouts?: ReadoutSpec[];
}

export interface NumberModelTopic {
  title: Loc;
  scene: NumberModelSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface NumberModelViewerProps {
  topic: NumberModelTopic;
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => React.ReactNode;
}

export function NumberModelViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: NumberModelViewerProps) {
  const t = useTranslations('models');
  const { scene, parameters } = topic;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { fields, program, scope, locale, firstSlider } = shared;
  const specs = useMemo(() => new Map<string, ParamSpec>(parameters.map((p) => [p.id, p])), [parameters]);
  const ids = useMemo(() => new Set(parameters.map((p) => p.id)), [parameters]);

  const built = useMemo(
    () => buildModel({ model: scene.model, program, scope, params: ids, hidden: step?.hidden, text: (l) => ('text' in l ? loc(l.text, locale) : plainMath(l.latex)) }),
    [scene.model, program, scope, ids, step?.hidden, locale],
  );

  const sentences = built.sentences.map((s) => t(`sentence.${s.key}`, s.values));
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));

  const picture = (
    <div className="flex flex-col gap-4" data-number-model-viewer="">
      <SceneFrame
        title={shared.title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        capabilities={{ rotate: false, zoom: false, pan: false }}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
        resetSeq={resetSeq}
      >
        {() => (
          <div dir="ltr" className="absolute inset-0">
            <NumberModel prims={built.prims} overlay={<ModelHandles controls={built.controls} specs={specs} fields={fields} />} />
          </div>
        )}
      </SceneFrame>
    </div>
  );

  const extras =
    sentences.length > 0 ? (
      <div data-testid="features">
        <h2 className="mb-2 text-xl font-semibold">{t('shows')}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1 ps-6">
          {sentences.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    ) : null;

  const parts: ViewerParts = {
    picture,
    extras,
    controls: <ParameterControls parameters={parameters} state={shared} />,
    results: <ReadoutList readouts={shared.readouts} />,
    formulas: <FormulaList formulas={shared.formulas} />,
    live: <LiveRegion text={announcement} />,
  };
  if (children) return <>{children(parts)}</>;
  return (
    <section className="flex flex-col gap-6">
      {parts.picture}
      {parts.controls}
      {parts.extras}
      {parts.results}
      {parts.formulas}
      {parts.live}
    </section>
  );
}
