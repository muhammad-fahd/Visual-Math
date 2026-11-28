'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { format } from '../../lib/expr';
import { buildSpace, type Fact, type Label, type SpaceModel, type SpaceSceneLike } from '../../lib/space';
import { plainMath } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { FrameToggle, SceneFrame, type Camera, type View } from '../../scenes/frame';
import { Space2D } from '../../scenes/space3d';
import { Boundary } from './Boundary';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';
import { TierNotices, useTier } from './useTier';

// The viewer of a `space3d@1` topic (Story 4.1, FR-3.22): the axes with their vectors, lines and planes in the frame, the
// sliders and typed boxes that edit them, the live numbers and a text list of everything shown. It shares parameters,
// steps, the address, Reset all, readouts and formulas with the other viewers through `useSceneState`, and the three
// tiers with the solid viewer through `useTier`. Nothing here listens to the pointer: the frame turns the view, and the
// elements are edited only through parameters.

type Loc = Record<string, string>;

export interface SpaceSceneFull extends SpaceSceneLike {
  caption: Loc;
  description?: Loc;
  camera?: Camera;
  readouts?: ReadoutSpec[];
}

export interface SpaceTopic {
  title: Loc;
  scene: SpaceSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface SpaceViewerProps {
  topic: SpaceTopic;
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => ReactNode;
}

function Loading() {
  const t = useTranslations('solid');
  return <p className="m-0 p-4 text-muted">{t('loading')}</p>;
}

// The 3D chunk: three.js and react-three-fiber come in only through this import.
const Space3D = dynamic(() => import('../../scenes/space3d/Space3D'), { ssr: false, loading: () => <Loading /> });

const trim = (n: number, d = 2) => format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** The sentence a fact says, in the visitor's language (every number in it is the live one). */
export function factSentence(t: ReturnType<typeof useTranslations>, f: Fact): string {
  const v = (a: readonly [number, number, number]) => ({ x: trim(a[0]), y: trim(a[1]), z: trim(a[2]) });
  switch (f.kind) {
    case 'point':
      return t('fact.point', { name: f.label, ...v(f.at) });
    case 'vector':
      return t('fact.vector', { name: f.label, ...v(f.v), length: trim(f.length) });
    case 'add':
      return t('fact.add', { name: f.label, parts: f.parts.join(' + '), ...v(f.v), length: trim(f.length) });
    case 'scale':
      return t('fact.scale', { name: f.label, k: trim(f.k), of: f.of, ...v(f.v), length: trim(f.length) });
    case 'cross':
      return f.parallel ? t('fact.crossParallel', { name: f.label, a: f.of[0], b: f.of[1] }) : t('fact.cross', { name: f.label, a: f.of[0], b: f.of[1], ...v(f.v), length: trim(f.length) });
    case 'dot':
      return f.angle === null ? t('fact.dotNoAngle', { a: f.of[0], b: f.of[1], value: trim(f.value) }) : t('fact.dot', { a: f.of[0], b: f.of[1], value: trim(f.value), angle: trim(f.angle, 1) });
    case 'line':
      return t(f.inside ? 'fact.line' : 'fact.lineOutside', { name: f.label, px: trim(f.point[0]), py: trim(f.point[1]), pz: trim(f.point[2]), dx: trim(f.direction[0]), dy: trim(f.direction[1]), dz: trim(f.direction[2]) });
    case 'plane':
      return t(f.inside ? 'fact.plane' : 'fact.planeOutside', { name: f.label, nx: trim(f.normal[0]), ny: trim(f.normal[1]), nz: trim(f.normal[2]), d: trim(f.d) });
    case 'skipped':
      return t(`fact.skipped${f.reason === 'missing' ? 'Missing' : f.reason === 'zero' ? 'Zero' : 'NotFinite'}`, { name: f.label });
  }
}

export function SpaceViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: SpaceViewerProps) {
  const t = useTranslations('space');
  const solid = useTranslations('solid');
  const { scene, parameters } = topic;
  const [parts, setParts] = useState({ axes: true, grid: true, box: true });
  const tierState = useTier();
  const { tier, canvas, onReady, onFail } = tierState;

  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged, onReset: () => setParts({ axes: true, grid: true, box: true }) });
  const { program, scope, locale, firstSlider } = shared;

  const labelOf = useCallback((label: Label | undefined, id: string) => (label ? ('text' in label ? loc(label.text, locale) : plainMath(label.latex)) : id), [locale]);
  const hidden = useMemo(() => {
    const out = new Set(step?.hidden ?? []);
    for (const [name, on] of Object.entries(parts)) if (!on) out.add(name);
    return out;
  }, [step?.hidden, parts]);
  const model = useMemo(() => buildSpace({ scene, program, scope, hidden, labelOf }), [scene, program, scope, hidden, labelOf]);

  const sentences = model.facts.map((f) => factSentence(t, f));
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));

  const title = loc(topic.title, locale);
  const toggles = (
    <>
      <FrameToggle pressed={parts.axes} onToggle={(on) => setParts((p) => ({ ...p, axes: on }))}>
        {solid('axes')}
      </FrameToggle>
      <FrameToggle pressed={parts.grid} onToggle={(on) => setParts((p) => ({ ...p, grid: on }))}>
        {t('grid')}
      </FrameToggle>
      <FrameToggle pressed={parts.box} onToggle={(on) => setParts((p) => ({ ...p, box: on }))}>
        {t('box')}
      </FrameToggle>
    </>
  );

  const picture = (
    <div className="flex flex-col gap-4" data-space-viewer="" data-tier={tier ?? 'pending'} data-ready={canvas ? 'true' : 'false'}>
      <TierNotices state={tierState} />
      <SceneFrame
        title={title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        camera={step?.camera ?? scene.camera}
        extraControls={toggles}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
        resetSeq={resetSeq}
      >
        {(view: View) => <Picture tier={tier} model={model} view={view} onReady={onReady} onFail={onFail} />}
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

  const viewerParts: ViewerParts = {
    picture,
    extras,
    controls: <ParameterControls parameters={parameters} state={shared} />,
    results: <ReadoutList readouts={shared.readouts} />,
    formulas: <FormulaList formulas={shared.formulas} />,
    live: <LiveRegion text={announcement} />,
  };
  if (children) return <>{children(viewerParts)}</>;
  return (
    <section className="flex flex-col gap-6">
      {viewerParts.picture}
      {viewerParts.controls}
      {viewerParts.extras}
      {viewerParts.results}
      {viewerParts.formulas}
      {viewerParts.live}
    </section>
  );
}

function Picture({ tier, model, view, onReady, onFail }: { tier: ReturnType<typeof useTier>['tier']; model: SpaceModel; view: View; onReady: (canvas: HTMLCanvasElement) => void; onFail: () => void }) {
  if (tier === null) return <Loading />;
  return (
    // The picture, its axes and its labels are never mirrored in Urdu (AD-12).
    <div dir="ltr" className="absolute inset-0">
      {tier === 'A' ? (
        <Boundary onError={onFail}>
          <Space3D model={model} view={view} onReady={onReady} />
        </Boundary>
      ) : null}
      <Space2D model={model} view={view} geometry={tier !== 'A'} labels />
    </div>
  );
}
