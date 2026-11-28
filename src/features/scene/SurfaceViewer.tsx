'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';
import { format } from '../../lib/expr';
import type { SpaceModel } from '../../lib/space';
import { buildSurface, type SurfaceModel, type SurfaceSceneLike } from '../../lib/surface';
import type { Topic } from '../../lib/topic-schema';
import { SceneFrame, type Camera, type View } from '../../scenes/frame';
import { Space2D } from '../../scenes/space3d';
import { Boundary } from './Boundary';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';
import { TierNotices, useTier } from './useTier';

// The viewer of a `surface3d@1` topic (Story 4.5, FR-3.23): the surface z = f(x, y) in the frame, through the `space3d`
// renderers, with the sliders and typed boxes of the parameters in the expression, the live numbers and a text list of the
// window, the heights, the holes and the probe with its slopes. It shares parameters, steps, the address, Reset all, readouts
// and formulas with the other viewers through `useSceneState`.

type Loc = Record<string, string>;

export interface SurfaceSceneFull extends SurfaceSceneLike {
  caption: Loc;
  description?: Loc;
  camera?: Camera;
  readouts?: ReadoutSpec[];
}

export interface SurfaceTopic {
  title: Loc;
  scene: SurfaceSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface SurfaceViewerProps {
  topic: SurfaceTopic;
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

// The 3D chunk: three.js and react-three-fiber come in only through this import (the one the space3d scene uses).
const Space3D = dynamic(() => import('../../scenes/space3d/Space3D'), { ssr: false, loading: () => <Loading /> });

const trim = (n: number, d = 2) => {
  const t = format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return /^[-\u2212]0$/.test(t) ? '0' : t;
};

/** The sentences of the surface: its window, the heights, the holes, the probe and its slopes. */
export function surfaceSentences(t: ReturnType<typeof useTranslations>, model: SurfaceModel): string[] {
  const f = model.facts;
  const out: string[] = [];
  if (f.windowDefaulted) out.push(t('windowDefault'));
  out.push(t('window', { x0: trim(f.x[0]), x1: trim(f.x[1]), y0: trim(f.y[0]), y1: trim(f.y[1]) }));
  if (f.zMin === null || f.zMax === null) out.push(t('zNone'));
  else out.push(t('zRange', { min: trim(f.zMin, 3), max: trim(f.zMax, 3) }));
  if (f.holes > 0) out.push(t('holes', { count: f.holes }));
  if (f.clamped > 0) out.push(t('clamped', { count: f.clamped }));
  if (f.probe) {
    const p = f.probe;
    out.push(t('probe', { x: trim(p.x), y: trim(p.y), z: trim(p.z, 3) }));
    if (p.clamped) out.push(t('probeClamped'));
    if (p.dzdx !== null && p.dzdy !== null) out.push(t('slopes', { sx: trim(p.dzdx, 3), sy: trim(p.dzdy, 3) }));
    else if (p.dzdx !== null) out.push(t('slopeX', { sx: trim(p.dzdx, 3) }));
    else if (p.dzdy !== null) out.push(t('slopeY', { sy: trim(p.dzdy, 3) }));
    else out.push(t('slopeNone'));
  } else if (f.probeMissing) out.push(t('probeMissing'));
  return out;
}

export function SurfaceViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: SurfaceViewerProps) {
  const t = useTranslations('surface');
  const { scene, parameters } = topic;
  const tierState = useTier();
  const { tier, canvas, onReady, onFail } = tierState;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { program, scope, locale, firstSlider } = shared;
  const hidden = step?.hidden;
  const model = useMemo(() => buildSurface({ scene, program, scope, hidden }), [scene, program, scope, hidden]);

  const sentences = surfaceSentences(t, model);
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));

  const picture = (
    <div className="flex flex-col gap-4" data-surface-viewer="" data-tier={tier ?? 'pending'} data-ready={canvas ? 'true' : 'false'}>
      <TierNotices state={tierState} />
      <SceneFrame
        title={shared.title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        camera={step?.camera ?? scene.camera}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
        resetSeq={resetSeq}
      >
        {(view: View) => <Picture space={model.space} view={view} tier={tier} onReady={onReady} onFail={onFail} />}
      </SceneFrame>
    </div>
  );

  const extras = (
    <div data-testid="features">
      <h2 className="mb-2 text-xl font-semibold">{t('shows')}</h2>
      <ul className="m-0 flex list-disc flex-col gap-1 ps-6">
        {sentences.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );

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

function Picture({ space, view, tier, onReady, onFail }: { space: SpaceModel; view: View; tier: ReturnType<typeof useTier>['tier']; onReady: (canvas: HTMLCanvasElement) => void; onFail: () => void }) {
  // The picture, its axes and its labels are never mirrored in Urdu (AD-12).
  if (tier === null) return <Loading />;
  return (
    <div dir="ltr" className="absolute inset-0">
      {tier === 'A' ? (
        <Boundary onError={onFail}>
          <Space3D model={space} view={view} onReady={onReady} />
        </Boundary>
      ) : null}
      <Space2D model={space} view={view} geometry={tier !== 'A'} labels />
    </div>
  );
}
