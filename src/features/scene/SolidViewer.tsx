'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { format } from '../../lib/expr';
import { snap, type ParamSpec } from '../../lib/params';
import { build, compose, dimsOf, drawLayers, fitBase, stateOf, type Composed, type Dims, type Geometry, type Kind, type Mode } from '../../lib/solid';
import type { Topic } from '../../lib/topic-schema';
import { FrameToggle, SceneFrame, type Camera, type View } from '../../scenes/frame';
import { OFFER_AFTER_MS, SectionPanel, Solid2D, lightChosen, rememberLight, webglAvailable, type Tier } from '../../scenes/solid3d';
import { Boundary } from './Boundary';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ViewerStep } from './useSceneState';

export type { ViewerParts } from './SceneParts';
export type { ViewerStep } from './useSceneState';

// The viewer of a `solid3d@1` topic (Story 2.4): the picture in its frame, the sliders and typed values,
// the live results and formulas. The page of Story 2.6 will place it; until then a harness page does.
// Tiers (AD-13): A is three.js in a lazy chunk, B is the light flat picture, C is that same picture with
// the plain message. The chunk is requested only when Tier A is chosen, never for B, C or a 2D topic.

type Loc = Record<string, string>;
type Num = number | string;

export interface SolidScene {
  caption: Loc;
  description?: Loc;
  solid: { kind: Kind; dims: Record<string, number | string> };
  labels?: { dimensions: boolean };
  camera?: Camera;
  /** FR-3.10: a cutting plane, from an axis and an offset or from a normal and a distance. */
  section?: { enabled: Num; plane?: { axis: 'x' | 'y' | 'z'; offset: Num }; normal?: [Num, Num, Num]; d?: Num };
  /** FR-3.11: 0 folded, 1 flat. */
  net?: { progress: Num };
  /** FR-3.12: the liquid level, 0 to 1 of the height. */
  fill?: { level: Num };
  readouts?: { id: string; label: Loc; expr: string; decimals: number; unit?: string }[];
}

export interface SolidTopic {
  title: Loc;
  scene: SolidScene;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

function Loading() {
  const t = useTranslations('solid');
  return <p className="m-0 p-4 text-muted">{t('loading')}</p>;
}

// The 3D chunk: three.js and react-three-fiber come in only through this import.
const Solid3D = dynamic(() => import('../../scenes/solid3d/Solid3D'), { ssr: false, loading: () => <Loading /> });

/** A field that is a bare parameter id can be played by animating that parameter (the Play buttons). */
function bareParameter(value: Num | undefined, parameters: Topic['parameters']) {
  if (typeof value !== 'string') return undefined;
  return parameters.find((p) => p.id === value && (p.kind === 'number' || p.kind === 'integer'));
}

const PLAY_SECONDS = 2.5;
const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const trim = (n: number) => format(n, 1).replace(/\.0$/, '');

export interface SolidViewerProps {
  topic: SolidTopic;
  step?: ViewerStep;
  /** Formula ids the current step uses: they are marked. */
  highlight?: readonly string[];
  /** Values from the address: applied once per `seq`, and kept as the visitor's own (a step leaves them alone). */
  restore?: { seq: number; params: Record<string, number> };
  /** A counter: each time it goes up everything returns to its start (the page's Reset all). */
  resetSeq?: number;
  /** The parameters the visitor changed and their values, whenever they change (for the address). */
  onChanged?: (changed: Record<string, number>) => void;
  /** Without it the viewer lays its pieces out in one column. */
  children?: (parts: ViewerParts) => ReactNode;
}

export function SolidViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: SolidViewerProps) {
  const t = useTranslations('solid');
  const { scene, parameters } = topic;
  const [anim, setAnim] = useState<{ spec: ParamSpec; from: number; to: number; start: number; duration: number } | null>(null);
  // A frame already queued when Reset all (or the address) stops an animation must not move the value after it.
  const playId = useRef(0);
  const [mode, setMode] = useState<Mode>('solid');
  const [labels, setLabels] = useState(scene.labels?.dimensions ?? true);
  const [axes, setAxes] = useState(false);
  const [tier, setTier] = useState<Tier | null>(null);
  const [reason, setReason] = useState<'none' | 'lost'>('none');
  const [offer, setOffer] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canUse3d, setCanUse3d] = useState(false);
  const ready = useRef(false);
  const tierRef = useRef<Tier | null>(null);
  tierRef.current = tier;

  // The state every viewer shares: parameters, the step, the address, Reset all, readouts and formulas.
  const shared = useSceneState({
    topic,
    step,
    highlight,
    restore,
    resetSeq,
    onChanged,
    stop: () => {
      playId.current++;
      setAnim(null);
    },
    onReset: () => {
      setMode('solid');
      setLabels(scene.labels?.dimensions ?? true);
      setAxes(false);
    },
  });
  const { fields, values, program, scope, locale, firstSlider } = shared;

  const kind = scene.solid.kind;
  const dimsAt = useCallback((at: Record<string, number>): Dims => dimsOf(scene.solid.dims, program, at), [program, scene.solid.dims]);
  const geometry = useMemo(() => build(kind, dimsAt(values)), [kind, dimsAt, values]);
  // The picture is fitted to the largest the solid can get, so a slider that grows it visibly grows it.
  const fitBaseValue = useMemo(() => fitBase(kind, dimsAt, parameters, Boolean(scene.net)), [parameters, kind, dimsAt, scene.net]);
  const hidden = step?.hidden;
  const state = useMemo(() => {
    const all = stateOf(scene, program, scope);
    // A step can hide a part of the scene (topic-format: `hide`); a part it does not hide is as the scene says.
    return { section: hidden?.has('section') ? undefined : all.section, net: hidden?.has('net') ? undefined : all.net, fill: hidden?.has('fill') ? undefined : all.fill };
  }, [scene, program, scope, hidden]);
  const dimensionsShown = labels && !hidden?.has('dimensions');
  const composed = useMemo(() => compose(kind, geometry, state), [kind, geometry, state]);
  const fit = Math.max(fitBaseValue, composed.fit);

  // ---- Play (FR-3.11, 3.12, NFR-3.3): animates the parameter a field names, when it names one ----
  // A net the solid cannot have (a sphere) has nothing to play.
  const netParam = geometry.panels.length > 0 ? bareParameter(scene.net?.progress, parameters) : undefined;
  const fillParam = bareParameter(scene.fill?.level, parameters);

  // ---- tiers ----
  useEffect(() => {
    const gl = webglAvailable(); // once: a device has few contexts to spare
    setCanUse3d(gl);
    setTier(lightChosen() ? 'B' : gl ? 'A' : 'C');
  }, []);

  useEffect(() => {
    if (tier !== 'A') return;
    ready.current = false;
    const timer = setTimeout(() => {
      if (!ready.current) setOffer(true);
    }, OFFER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [tier]);

  // A lost graphics context drops the picture to Tier C with the plain message (AD-13). The listener is
  // attached the moment the canvas exists, so a context lost right after the first frame is not missed.
  const detach = useRef<(() => void) | null>(null);
  const onReady = useCallback((el: HTMLCanvasElement) => {
    detach.current?.();
    const lost = (e: Event) => {
      e.preventDefault();
      if (tierRef.current !== 'A') return;
      setReason('lost');
      setTier('C');
      setCanvas(null);
    };
    el.addEventListener('webglcontextlost', lost);
    detach.current = () => el.removeEventListener('webglcontextlost', lost);
    ready.current = true;
    setOffer(false);
    setCanvas(el);
  }, []);
  useEffect(() => () => detach.current?.(), []);
  useEffect(() => {
    if (tier !== 'A') {
      detach.current?.();
      detach.current = null;
    }
  }, [tier]);

  const onFail = useCallback(() => {
    if (tierRef.current !== 'A') return;
    detach.current?.();
    detach.current = null;
    setReason('lost');
    setTier('C');
    setCanvas(null);
  }, []);

  const chooseLight = (on: boolean) => {
    rememberLight(on);
    setOffer(false);
    setCanvas(null);
    setTier(on ? 'B' : 'A');
  };

  // ---- parameters ----
  const setParam = fields.set;

  useEffect(() => {
    if (!anim) return;
    let frame = 0;
    const id = ++playId.current;
    const tick = (now: number) => {
      if (playId.current !== id) return;
      const k = Math.min(1, Math.max(0, (now - anim.start) / anim.duration));
      setParam(anim.spec, snap(anim.spec, anim.from + (anim.to - anim.from) * k)); // on the step grid, so the box reads 0.42, not 0.41999
      if (k < 1) frame = requestAnimationFrame(tick);
      else setAnim(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anim, setParam]);

  // With reduced motion the animations start at their finished state; Play then jumps between the two ends. Once, at the start.
  useEffect(() => {
    if (!reducedMotion()) return;
    for (const spec of [netParam, fillParam]) if (spec) setParam(spec, spec.max);
  }, []);

  const play = (spec: ParamSpec, forward: boolean) => {
    const to = forward ? spec.max : spec.min;
    const from = values[spec.id] ?? spec.default;
    if (reducedMotion() || from === to) {
      setAnim(null);
      setParam(spec, to);
      return;
    }
    const share = Math.abs(to - from) / (spec.max - spec.min || 1);
    setAnim({ spec, from, to, start: performance.now(), duration: Math.max(200, PLAY_SECONDS * 1000 * share) });
  };

  // ---- numbers shown ----
  const sectionText = composed.section
    ? `${shapeName(t, composed.section.shape, composed.section.corners)}. ${composed.section.measures.map((m) => `${t(`section.measure.${m.id}`)} ${trim(m.value)}`).join('. ')}`
    : composed.sectionAsked
      ? t('section.miss')
      : '';
  const fillText = composed.fill ? t('fill.share', { percent: Math.round(composed.fill.share * 100) }) : '';
  const announcement = useAnnouncement(spokenOf(shared.readouts, [sectionText, fillText]));

  const title = loc(topic.title, locale);
  const labelOf = (id: string, value: number) => `${id} = ${trim(value)}`;

  const modes: Mode[] = ['solid', 'wireframe', 'transparent'];
  const toggles = (
    <>
      <span role="group" aria-label={t('mode.group')} className="inline-flex flex-wrap gap-2">
        {modes.map((m) => (
          <FrameToggle key={m} pressed={mode === m} onToggle={() => setMode(m)}>
            {t(`mode.${m}`)}
          </FrameToggle>
        ))}
      </span>
      <FrameToggle pressed={labels} onToggle={setLabels}>
        {t('labels')}
      </FrameToggle>
      <FrameToggle pressed={axes} onToggle={setAxes}>
        {t('axes')}
      </FrameToggle>
    </>
  );

  const notices = (
    <>
      {tier === 'C' ? (
        <p role="status" className="m-0 rounded-md border-2 border-hint p-3 text-text" data-testid="tier-message">
          {reason === 'lost' ? t('contextLost') : t('noWebgl')}
        </p>
      ) : null}
      {tier === 'B' ? (
        <p className="m-0 flex flex-wrap items-center gap-3 text-muted" data-testid="tier-light">
          {t('lightOn')}
          {canUse3d ? (
            <button type="button" className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-3 font-semibold text-text" onClick={() => chooseLight(false)}>
              {t('use3d')}
            </button>
          ) : null}
        </p>
      ) : null}
      {offer && tier === 'A' ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border-2 border-hint p-3" data-testid="tier-offer">
          <p className="m-0">{t('lightOffer')}</p>
          <button type="button" className="min-h-11 rounded-md border-2 border-primary bg-primary px-3 font-semibold text-on-primary" onClick={() => chooseLight(true)}>
            {t('useLight')}
          </button>
          <button type="button" className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-3 font-semibold text-text" onClick={() => setOffer(false)}>
            {t('keepWaiting')}
          </button>
        </div>
      ) : null}
    </>
  );

  const picture = (
    <div className="flex flex-col gap-4" data-solid-viewer="" data-tier={tier ?? 'pending'} data-ready={canvas ? 'true' : 'false'}>
      {notices}
      <SceneFrame
        title={title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        camera={step?.camera ?? scene.camera}
        extraControls={toggles}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
        resetSeq={resetSeq}
      >
        {(view: View) => <Picture tier={tier} geometry={geometry} composed={composed} fit={fit} view={view} mode={mode} labels={dimensionsShown} axes={axes} labelOf={labelOf} onReady={onReady} onFail={onFail} />}
      </SceneFrame>
      <ul className="sr-only" aria-label={t('labels')}>
        {(composed.showDimensions && dimensionsShown ? geometry.dimensions : []).map((d) => (
          <li key={d.id}>{t('dimension', { name: d.id, value: trim(d.value) })}</li>
        ))}
      </ul>
    </div>
  );

  const extras = (
    <>
      {netParam || fillParam ? (
        <div role="group" aria-label={t('animation.group')} className="flex flex-wrap items-center gap-2" data-testid="play">
          {netParam ? (
            <>
              <button type="button" className={playButton} onClick={() => play(netParam, true)}>
                {t('net.unfold')}
              </button>
              <button type="button" className={playButton} onClick={() => play(netParam, false)}>
                {t('net.fold')}
              </button>
            </>
          ) : null}
          {fillParam ? (
            <>
              <button type="button" className={playButton} onClick={() => play(fillParam, true)}>
                {t('fill.pourIn')}
              </button>
              <button type="button" className={playButton} onClick={() => play(fillParam, false)}>
                {t('fill.pourOut')}
              </button>
            </>
          ) : null}
          {anim ? (
            <button type="button" className={playButton} onClick={() => setAnim(null)}>
              {t('animation.pause')}
            </button>
          ) : null}
        </div>
      ) : null}

      {scene.section && composed.sectionAsked ? (
        <div data-testid="section" className="flex flex-wrap items-center gap-4">
          {composed.section ? (
            <>
              <SectionPanel section={composed.section} />
              <div>
                <h2 className="mb-1 text-xl font-semibold">{t('section.title')}</h2>
                <p className="m-0 font-semibold" data-section-shape={composed.section.shape}>
                  {shapeName(t, composed.section.shape, composed.section.corners)}
                </p>
                <dl className="m-0 mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
                  {composed.section.measures.map((m) => (
                    <div key={m.id} className="contents">
                      <dt>{t(`section.measure.${m.id}`)}</dt>
                      <dd className="m-0" dir="ltr" data-measure={m.id}>
                        {trim(m.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          ) : (
            <p className="m-0" data-testid="section-miss">
              {t('section.miss')}
            </p>
          )}
        </div>
      ) : null}

      {composed.net ? (
        <div data-testid="net-parts">
          <h2 className="mb-1 text-xl font-semibold">{t('net.title')}</h2>
          <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1">
            {composed.net.parts.map((part) => (
              <div key={part.role} className="flex gap-2">
                <dt>{t(`net.part.${part.role}`)}</dt>
                <dd className="m-0" dir="ltr" data-part={part.role}>
                  {trim(part.area)}
                </dd>
              </div>
            ))}
            <div className="flex gap-2 font-semibold">
              <dt>{t('net.total')}</dt>
              <dd className="m-0" dir="ltr" data-part="total">
                {trim(composed.net.total)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {composed.fill ? (
        <p className="m-0" data-fill-share={Math.round(composed.fill.share * 100)}>
          {fillText}
        </p>
      ) : null}
    </>
  );

  const controls = (
    <ParameterControls
      parameters={parameters}
      state={shared}
      heading={t('measurements')}
      onUserInput={() => {
        playId.current++;
        setAnim(null);
      }}
    />
  );
  const results = <ReadoutList readouts={shared.readouts} />;
  const formulaList = <FormulaList formulas={shared.formulas} />;
  const live = <LiveRegion text={announcement} />;

  const parts: ViewerParts = { picture, extras, controls, results, formulas: formulaList, live };
  if (children) return <>{children(parts)}</>;
  return (
    <section className="flex flex-col gap-6">
      {picture}
      {extras}
      {parts.controls}
      {parts.results}
      {parts.formulas}
      {parts.live}
    </section>
  );
}

function Picture({
  tier,
  geometry,
  composed,
  fit,
  view,
  mode,
  labels,
  axes,
  labelOf,
  onReady,
  onFail,
}: {
  tier: Tier | null;
  geometry: Geometry;
  composed: Composed;
  fit: number;
  view: View;
  mode: Mode;
  labels: boolean;
  axes: boolean;
  labelOf: (id: string, value: number) => string;
  onReady: (canvas: HTMLCanvasElement) => void;
  onFail: () => void;
}) {
  const list = useMemo(
    () => drawLayers(composed.layers, composed.showDimensions ? geometry.dimensions : [], geometry.radius, view, fit),
    [composed, geometry, view, fit],
  );
  if (tier === null) return <Loading />;
  const flat = tier !== 'A';
  return (
    // The picture, its axes and its labels are never mirrored in Urdu (AD-12).
    <div dir="ltr" className="absolute inset-0">
      {tier === 'A' ? (
        <Boundary onError={onFail}>
          <Solid3D layers={composed.layers} view={view} fit={fit} mode={mode} glass={composed.glass} onReady={onReady} />
        </Boundary>
      ) : null}
      <Solid2D list={list} mode={mode} glass={composed.glass} layers={{ faces: flat, edges: flat, dimensions: labels, axes }} labelOf={labelOf} />
    </div>
  );
}

const playButton = 'min-h-11 rounded-md border-2 border-border-strong bg-surface px-3 font-semibold text-text';

function shapeName(t: ReturnType<typeof useTranslations>, shape: string, corners: number): string {
  return t(`section.shape.${shape}`, { n: corners });
}
