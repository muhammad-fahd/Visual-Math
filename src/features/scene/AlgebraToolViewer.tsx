'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { buildTool, type Tool } from '../../lib/algebra';
import { plainMath } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { SceneFrame } from '../../scenes/frame';
import { NumberModel } from '../../scenes/numbermodel';
import { MathHtml } from './MathHtml';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';

// The viewer of an `algebra-tool@1` topic (Story 3.4, FR-3.20). The balance scale, the tiles and the function
// machine are pictures (the prims of `lib/algebra`, drawn by the shared pure renderer); the step solver is a list
// of math lines revealed by a parameter, each with its note. Every move is a slider, so everything else (steps,
// address, Reset all, readouts, formulas) comes from `useSceneState` as in the other viewers.

type Loc = Record<string, string>;

export interface AlgebraToolSceneFull {
  tool: Tool;
  caption: Loc;
  description?: Loc;
  readouts?: ReadoutSpec[];
}

export interface AlgebraToolTopic {
  title: Loc;
  scene: AlgebraToolSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface AlgebraToolViewerProps {
  topic: AlgebraToolTopic;
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => React.ReactNode;
}

export function AlgebraToolViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: AlgebraToolViewerProps) {
  const t = useTranslations('algebra');
  const { scene, parameters } = topic;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { program, scope, locale, firstSlider } = shared;
  const built = useMemo(() => buildTool({ tool: scene.tool, program, scope, hidden: step?.hidden }), [scene.tool, program, scope, step?.hidden]);

  const sentences = built.sentences.map((s) => t(`sentence.${s.key}`, s.values));
  const solver = built.solver;
  // The solver's newest move is what a screen reader hears when it changes.
  const newest = solver ? solver.lines[solver.revealed - 1] : undefined;
  const solverSpoken = solver && newest ? [t('solver.move', { n: solver.revealed, total: solver.lines.length, text: plainMath(newest.latex), note: solver.notes ? loc(newest.note, locale) : '' })] : [];
  const announcement = useAnnouncement(spokenOf(shared.readouts, solver ? solverSpoken : sentences));

  const picture = solver ? (
    <figure className="m-0 flex flex-col gap-3" data-algebra-solver="" aria-label={loc(scene.caption, locale)}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {solver.lines.slice(0, solver.revealed).map((line, i) => {
          const current = i === solver.revealed - 1;
          return (
            <li
              key={i}
              data-line={i + 1}
              aria-current={current ? 'step' : undefined}
              className={`flex flex-col gap-1 rounded-lg border-2 p-3 ${current ? 'border-primary bg-surface' : 'border-border'}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-muted" aria-hidden="true">
                  {i + 1}
                </span>
                <span dir="ltr" className="overflow-x-auto">
                  <MathHtml latex={line.latex} inline={false} />
                </span>
              </div>
              {solver.notes ? <p className="m-0 text-muted">{loc(line.note, locale)}</p> : null}
            </li>
          );
        })}
      </ol>
      <figcaption className="text-muted">{loc(scene.caption, locale)}</figcaption>
    </figure>
  ) : (
    <div className="flex flex-col gap-4" data-algebra-viewer="">
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
    !solver && sentences.length > 0 ? (
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
