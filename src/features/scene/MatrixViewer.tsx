'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';
import { format } from '../../lib/expr';
import { buildMatrix, type MatrixFacts, type MatrixModel, type MatrixSceneLike } from '../../lib/matrix';
import type { SpaceModel } from '../../lib/space';
import type { Topic } from '../../lib/topic-schema';
import { SceneFrame, type Camera, type View } from '../../scenes/frame';
import { Matrix2D } from '../../scenes/matrix';
import { Space2D } from '../../scenes/space3d';
import { Boundary } from './Boundary';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';
import { TierNotices, useTier } from './useTier';

// The viewer of a `matrix-transform@1` topic (Story 4.4, FR-3.27): a matrix applied to a grid or a shape, flat in 2D and in
// the frame in 3D (through the `space3d` renderers), with the sliders and typed boxes that edit the matrix, the live numbers
// and a text list of the matrix, where the basis vectors go, the determinant as area or volume and the eigenvectors. It shares
// parameters, steps, the address, Reset all, readouts and formulas with the other viewers through `useSceneState`.

type Loc = Record<string, string>;

export interface MatrixSceneFull extends MatrixSceneLike {
  caption: Loc;
  description?: Loc;
  camera?: Camera;
  readouts?: ReadoutSpec[];
}

export interface MatrixTopic {
  title: Loc;
  scene: MatrixSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface MatrixViewerProps {
  topic: MatrixTopic;
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
const tuple = (v: readonly number[]) => `(${v.map((x) => trim(x)).join(', ')})`;

/** The sentences of the matrix: its rows, where the basis vectors go, the determinant, the eigenvectors. */
export function matrixSentences(t: ReturnType<typeof useTranslations>, model: MatrixModel): string[] {
  const f: MatrixFacts | null = model.facts;
  if (!f) return [t('skipped')];
  const out: string[] = [t('rows', { rows: f.matrix.map((r) => tuple(r)).join('; ') })];
  if (f.progress < 1) out.push(t('progress', { percent: trim(f.progress * 100, 0) }));
  if (f.showBasis) out.push(f.images.map((c, i) => t('goes', { i: i + 1, v: tuple(c) })).join('; ') + '.');
  if (f.showDet) {
    const abs = trim(Math.abs(f.det), 3);
    if (f.flat) out.push(t(f.measure === 'area' ? 'detFlatArea' : 'detFlatVolume'));
    else {
      out.push(t(f.measure === 'area' ? 'detArea' : 'detVolume', { det: trim(f.det, 3), abs }));
      if (f.flips) out.push(t('flipped'));
    }
    if (Math.abs(f.before - 1) > 1e-9 && !f.flat) out.push(t(f.measure === 'area' ? 'areaChange' : 'volumeChange', { before: trim(f.before, 3), after: trim(f.after, 3) }));
  }
  if (f.eigen) {
    if (f.eigen.kind === 'complex') out.push(t('eigenComplex'));
    else if (f.eigen.kind === 'all') out.push(t('eigenAll', { value: trim(f.eigen.value, 3) }));
    else for (const e of f.eigen.pairs) out.push(t('eigen', { value: trim(e.value, 3), v: tuple(e.vector) }));
  }
  return out;
}

export function MatrixViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: MatrixViewerProps) {
  const t = useTranslations('matrix');
  const { scene, parameters } = topic;
  const tierState = useTier(scene.dim === 3);
  const { tier, canvas, onReady, onFail } = tierState;
  const shared = useSceneState({ topic, step, highlight, restore, resetSeq, onChanged });
  const { program, scope, locale, firstSlider } = shared;
  const hidden = step?.hidden;
  const model = useMemo(() => buildMatrix({ scene, program, scope, hidden }), [scene, program, scope, hidden]);

  const sentences = matrixSentences(t, model);
  const announcement = useAnnouncement(spokenOf(shared.readouts, sentences));
  const is3D = scene.dim === 3;

  const picture = (
    <div className="flex flex-col gap-4" data-matrix-viewer="" data-dim={scene.dim} data-tier={is3D ? (tier ?? 'pending') : undefined} data-ready={is3D ? (canvas ? 'true' : 'false') : undefined}>
      {is3D ? <TierNotices state={tierState} /> : null}
      <SceneFrame
        title={shared.title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        camera={is3D ? (step?.camera ?? scene.camera) : undefined}
        capabilities={is3D ? undefined : { rotate: false, zoom: false, pan: false }}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
        resetSeq={resetSeq}
      >
        {(view: View) => <Picture model={model} view={view} tier={tier} onReady={onReady} onFail={onFail} />}
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

function Picture({ model, view, tier, onReady, onFail }: { model: MatrixModel; view: View; tier: ReturnType<typeof useTier>['tier']; onReady: (canvas: HTMLCanvasElement) => void; onFail: () => void }) {
  // The picture, its axes and its labels are never mirrored in Urdu (AD-12).
  if (model.plane) {
    return (
      <div dir="ltr" className="absolute inset-0">
        <Matrix2D plane={model.plane} />
      </div>
    );
  }
  const space: SpaceModel | null = model.space;
  if (!space) return null;
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
