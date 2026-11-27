'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { SPECIAL_DEGREES, buildTriangle, fromDegrees, unitCircleAt, type Given, type Unit } from '../../lib/trig';
import type { Topic } from '../../lib/topic-schema';
import { SceneFrame } from '../../scenes/frame';
import { NumberModel } from '../../scenes/numbermodel';
import { AngleHandle } from './AngleHandle';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';

// The viewers of `unit-circle@1` and `right-triangle@1` (Story 3.5, FR-3.21). Both share parameters, steps,
// address, Reset all, readouts and formulas through `useSceneState`; the pictures are the prims of `lib/trig` drawn
// by the shared pure renderer. The unit circle's point is dragged by `AngleHandle`; the triangle's sides are sliders.

type Loc = Record<string, string>;
type Num = number | string;

interface Common {
  caption: Loc;
  description?: Loc;
  readouts?: ReadoutSpec[];
}
export interface UnitCircleSceneFull extends Common {
  angle: string;
  snap?: { values: number[]; within: number };
  tangent?: { when?: string };
  wave?: { fn: 'sin' | 'cos' | 'tan'; from: Num; to: Num };
  quadrants?: boolean;
}
export interface RightTriangleSceneFull extends Common {
  given: Given;
  labels?: 'abc' | 'opp-adj-hyp';
  ratios?: ('sin' | 'cos' | 'tan')[];
}

interface TopicOf<S> {
  title: Loc;
  scene: S;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}
export type UnitCircleTopic = TopicOf<UnitCircleSceneFull>;
export type RightTriangleTopic = TopicOf<RightTriangleSceneFull>;

interface ViewerProps<T> {
  topic: T;
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => React.ReactNode;
}

const finite = (n: number) => Number.isFinite(n);

export function UnitCircleViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: ViewerProps<UnitCircleTopic>) {
  const t = useTranslations('trig');
  const { scene, parameters } = topic;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { fields, program, scope, locale, firstSlider } = shared;
  const spec = useMemo<Topic['parameters'][number] | undefined>(() => parameters.find((p) => p.id === scene.angle), [parameters, scene.angle]);
  // The angle's unit is deg or rad (stage S2 checks it); anything else is read as degrees.
  const unit: Unit = spec?.unit === 'rad' ? 'rad' : 'deg';
  const value = scope[scene.angle] ?? NaN;

  const built = useMemo(() => unitCircleAt({ scene, program, scope, unit, hidden: step?.hidden }), [scene, program, scope, unit, step?.hidden]);

  const sentences = built.sentences.map((s) => t(`sentence.${s.key}`, s.values));
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));
  const snapValues = scene.snap?.values ?? SPECIAL_DEGREES.map((d) => fromDegrees(d, unit));
  const within = scene.snap?.within ?? 0;

  const picture = (
    <div className="flex flex-col gap-4" data-trig-viewer="">
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
            <NumberModel
              prims={built.prims}
              overlay={built.circle && spec && finite(value) && !step?.hidden.has('point') ? <AngleHandle circle={built.circle} spec={spec} unit={unit} value={value} snapValues={snapValues} within={within} fields={fields} /> : null}
            />
          </div>
        )}
      </SceneFrame>
    </div>
  );
  return finish({ picture, sentences, parameters, shared, announcement, t, children });
}

export function RightTriangleViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: ViewerProps<RightTriangleTopic>) {
  const t = useTranslations('trig');
  const { scene, parameters } = topic;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { program, scope, locale, firstSlider } = shared;
  const words = useMemo(() => ({ opposite: t('words.opposite'), adjacent: t('words.adjacent'), hypotenuse: t('words.hypotenuse') }), [t]);
  const built = useMemo(
    () => buildTriangle({ given: scene.given, labels: scene.labels, ratios: scene.ratios, program, scope, words, hidden: step?.hidden }),
    [scene.given, scene.labels, scene.ratios, program, scope, words, step?.hidden],
  );
  const sentences = built.sentences.map((s) => t(`sentence.${s.key}`, s.values));
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));

  const picture = (
    <div className="flex flex-col gap-4" data-trig-viewer="">
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
  return finish({ picture, sentences, parameters, shared, announcement, t, children });
}

function finish({
  picture,
  sentences,
  parameters,
  shared,
  announcement,
  t,
  children,
}: {
  picture: React.ReactNode;
  sentences: string[];
  parameters: Topic['parameters'];
  shared: ReturnType<typeof useSceneState>;
  announcement: string;
  t: (key: string) => string;
  children?: (parts: ViewerParts) => React.ReactNode;
}) {
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
