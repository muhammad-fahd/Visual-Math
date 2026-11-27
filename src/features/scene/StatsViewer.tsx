'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { Label } from '../../lib/numbermodel';
import { buildChart, type Chart } from '../../lib/stats';
import { plainMath } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { SceneFrame } from '../../scenes/frame';
import { NumberModel } from '../../scenes/numbermodel';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';

// The viewer of a `stats@1` topic (Story 3.6, FR-3.26): the chart in its frame, the sliders (bins, mean, standard
// deviation, trials, a value) and a text list of what the chart shows. Chance is a seeded generator, so the picture
// is a pure function of the parameters. Everything else comes from `useSceneState`, as in the other viewers.

type Loc = Record<string, string>;

export interface StatsSceneFull {
  chart: Chart;
  caption: Loc;
  description?: Loc;
  readouts?: ReadoutSpec[];
}

export interface StatsTopic {
  title: Loc;
  scene: StatsSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface StatsViewerProps {
  topic: StatsTopic;
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => React.ReactNode;
}

export function StatsViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: StatsViewerProps) {
  const t = useTranslations('stats');
  const { scene, parameters } = topic;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { program, scope, locale, firstSlider } = shared;
  const built = useMemo(
    () => buildChart({ chart: scene.chart, program, scope, hidden: step?.hidden, text: (l: Label) => ('text' in l ? loc(l.text, locale) : plainMath(l.latex)), words: { heads: t('words.heads'), tails: t('words.tails') } }),
    [scene.chart, program, scope, step?.hidden, locale, t],
  );
  const sentences = built.sentences.map((s) => t(`sentence.${s.key}`, s.values));
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));

  const picture = (
    <div className="flex flex-col gap-4" data-stats-viewer="">
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
            <NumberModel prims={built.prims} />
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
