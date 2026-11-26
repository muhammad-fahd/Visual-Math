'use client';

import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from '../../lib/expr';
import { checkTyped, createProgram, defaults, snap, unitSymbol, type ParamSpec } from '../../lib/params';
import { build, drawList, type Dims, type Kind, type Mode } from '../../lib/solid';
import { fillFormula, type Bound } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { createAnnouncer, FrameToggle, SceneFrame, type Camera, type View } from '../../scenes/frame';
import { OFFER_AFTER_MS, Solid2D, lightChosen, rememberLight, webglAvailable, type Tier } from '../../scenes/solid3d';
import { Boundary } from './Boundary';
import { MathHtml } from './MathHtml';

// The viewer of a `solid3d@1` topic (Story 2.4): the picture in its frame, the sliders and typed values,
// the live results and formulas. The page of Story 2.6 will place it; until then a harness page does.
// Tiers (AD-13): A is three.js in a lazy chunk, B is the light flat picture, C is that same picture with
// the plain message. The chunk is requested only when Tier A is chosen, never for B, C or a 2D topic.

type Loc = Record<string, string>;

export interface SolidScene {
  caption: Loc;
  description?: Loc;
  solid: { kind: Kind; dims: Record<string, number | string> };
  labels?: { dimensions: boolean };
  camera?: Camera;
  readouts?: { id: string; label: Loc; expr: string; decimals: number; unit?: string }[];
}

export interface SolidTopic {
  title: Loc;
  scene: SolidScene;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

const loc = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? '';

function Loading() {
  const t = useTranslations('solid');
  return <p className="m-0 p-4 text-muted">{t('loading')}</p>;
}

// The 3D chunk: three.js and react-three-fiber come in only through this import.
const Solid3D = dynamic(() => import('../../scenes/solid3d/Solid3D'), { ssr: false, loading: () => <Loading /> });

const trim = (n: number) => format(n, 1).replace(/\.0$/, '');
const inputClass = 'min-h-11 w-24 rounded-md border-2 border-border-strong bg-surface px-3 text-text';

export function SolidViewer({ topic }: { topic: SolidTopic }) {
  const t = useTranslations('solid');
  const locale = useLocale();
  const { scene, parameters } = topic;
  const [values, setValues] = useState(() => defaults(parameters));
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(parameters.map((p) => [p.id, String(p.default)])));
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>('solid');
  const [labels, setLabels] = useState(scene.labels?.dimensions ?? true);
  const [axes, setAxes] = useState(false);
  const [tier, setTier] = useState<Tier | null>(null);
  const [reason, setReason] = useState<'none' | 'lost'>('none');
  const [offer, setOffer] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canUse3d, setCanUse3d] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const ready = useRef(false);
  const tierRef = useRef<Tier | null>(null);
  const firstSlider = useRef<HTMLInputElement | null>(null);
  tierRef.current = tier;

  const program = useMemo(() => createProgram(parameters.map((p) => p.id), topic.derived), [parameters, topic.derived]);
  const scope = useMemo(() => program.scope(values), [program, values]);

  const kind = scene.solid.kind;
  const dimsAt = useCallback(
    (at: Record<string, number>): Dims => {
      const s = program.scope(at);
      return Object.fromEntries(Object.entries(scene.solid.dims).map(([name, source]) => [name, program.evaluate(source, s)]));
    },
    [program, scene.solid.dims],
  );
  const geometry = useMemo(() => build(kind, dimsAt(values)), [kind, dimsAt, values]);
  // The picture is fitted to the largest the solid can get, so a slider that grows it visibly grows it.
  const fitBase = useMemo(() => {
    const at = (pick: (p: Topic['parameters'][number]) => number) => Object.fromEntries(parameters.map((p) => [p.id, pick(p)]));
    const radii = [at((p) => p.min), at((p) => p.max), at((p) => p.default)].map((v) => build(kind, dimsAt(v)).radius);
    return Math.max(...radii.filter(Number.isFinite), 1e-6);
  }, [parameters, kind, dimsAt]);
  const fit = Math.max(fitBase, geometry.radius);

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
  /** `syncDraft` is false while the visitor is typing: "7." must stay "7." until they finish. */
  const setParam = useCallback((spec: ParamSpec, value: number, syncDraft = true) => {
    setValues((v) => ({ ...v, [spec.id]: value }));
    if (syncDraft) setDrafts((d) => ({ ...d, [spec.id]: String(value) }));
    setErrors((e) => ({ ...e, [spec.id]: false }));
  }, []);

  const commitTyped = (spec: ParamSpec, raw: string, final: boolean) => {
    const r = checkTyped(spec, raw);
    if (r.ok) {
      setParam(spec, r.value, final); // on Enter or blur the box shows the plain value; while typing it is left alone
      return;
    }
    if (final) {
      setErrors((e) => ({ ...e, [spec.id]: true }));
      // The old value stays; the box goes back to it so what is shown is what is drawn.
      setDrafts((d) => ({ ...d, [spec.id]: String(values[spec.id]) }));
    }
  };

  // ---- numbers shown ----
  const readouts = (scene.readouts ?? []).map((r) => {
    const value = program.evaluate(r.expr, scope);
    const unit = unitSymbol(r.unit);
    return {
      id: r.id,
      label: loc(r.label, locale),
      shown: `${format(value, r.decimals)}${unit}`,
      spoken: Number.isFinite(value) ? `${format(value, r.decimals)}${unit}` : t('undefinedValue'),
    };
  });
  const spokenAll = readouts.map((r) => `${r.label}: ${r.spoken}`).join('. ');

  // One polite live region, debounced 500 ms, fed by the readouts (AD-15). Not said on first render.
  const announcer = useRef<ReturnType<typeof createAnnouncer> | null>(null);
  const last = useRef(spokenAll);
  useEffect(() => {
    announcer.current = createAnnouncer(setAnnouncement);
    return () => announcer.current?.cancel();
  }, []);
  useEffect(() => {
    if (spokenAll === last.current) return;
    last.current = spokenAll;
    announcer.current?.say(spokenAll);
  }, [spokenAll]);

  const formulas = topic.formulas.map((f) => {
    const bound: Record<string, Bound> = {};
    for (const [name, b] of Object.entries(f.bind ?? {})) bound[name] = { value: program.evaluate(b.expr, scope), decimals: b.decimals };
    return { id: f.id, latex: fillFormula(f.latex, bound), caption: loc(f.caption, locale) };
  });

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

  return (
    <section className="flex flex-col gap-6" data-solid-viewer="" data-tier={tier ?? 'pending'} data-ready={canvas ? 'true' : 'false'}>
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

      <SceneFrame
        title={title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        camera={scene.camera}
        extraControls={toggles}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
      >
        {(view: View) => <Picture tier={tier} geometry={geometry} fit={fit} view={view} mode={mode} labels={labels} axes={axes} labelOf={labelOf} onReady={onReady} onFail={onFail} />}
      </SceneFrame>

      <ul className="sr-only" aria-label={t('labels')}>
        {geometry.dimensions.map((d) => (
          <li key={d.id}>{t('dimension', { name: d.id, value: trim(d.value) })}</li>
        ))}
      </ul>

      <div>
        <h2 className="mb-3 text-xl font-semibold">{t('measurements')}</h2>
        <div className="flex flex-col gap-4">
          {parameters.map((p, i) => (
            <Control
              key={p.id}
              spec={p}
              locale={locale}
              value={values[p.id]!}
              draft={drafts[p.id] ?? ''}
              error={errors[p.id] === true}
              inputRef={i === 0 ? firstSlider : undefined}
              onSlide={(v) => setParam(p, snap(p, v))}
              onDraft={(raw) => {
                setDrafts((d) => ({ ...d, [p.id]: raw }));
                commitTyped(p, raw, false);
              }}
              onCommit={(raw) => commitTyped(p, raw, true)}
              onSet={(v) => setParam(p, v)}
            />
          ))}
        </div>
      </div>

      {readouts.length > 0 ? (
        <div>
          <h2 className="mb-3 text-xl font-semibold">{t('readouts')}</h2>
          <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2">
            {readouts.map((r) => (
              <div key={r.id} className="flex gap-2">
                <dt className="font-semibold">{r.label}</dt>
                <dd className="m-0" dir="ltr" data-readout={r.id}>
                  {r.shown}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-xl font-semibold">{t('formulas')}</h2>
        <div className="flex flex-col gap-4">
          {formulas.map((f) => (
            <figure key={f.id} className="m-0" data-formula={f.id}>
              <div className="overflow-x-auto text-lg">
                <MathHtml latex={f.latex} inline={false} />
              </div>
              {f.caption ? <figcaption className="text-muted">{f.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only" data-testid="readout-live">
        {announcement}
      </div>
    </section>
  );
}

function Picture({
  tier,
  geometry,
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
  geometry: ReturnType<typeof build>;
  fit: number;
  view: View;
  mode: Mode;
  labels: boolean;
  axes: boolean;
  labelOf: (id: string, value: number) => string;
  onReady: (canvas: HTMLCanvasElement) => void;
  onFail: () => void;
}) {
  const list = useMemo(() => drawList(geometry, view, fit), [geometry, view, fit]);
  if (tier === null) return <Loading />;
  const flat = tier !== 'A';
  return (
    // The picture, its axes and its labels are never mirrored in Urdu (AD-12).
    <div dir="ltr" className="absolute inset-0">
      {tier === 'A' ? (
        <Boundary onError={onFail}>
          <Solid3D geometry={geometry} view={view} fit={fit} mode={mode} onReady={onReady} />
        </Boundary>
      ) : null}
      <Solid2D list={list} mode={mode} layers={{ faces: flat, edges: flat, dimensions: labels, axes }} labelOf={labelOf} />
    </div>
  );
}

function Control({
  spec,
  locale,
  value,
  draft,
  error,
  inputRef,
  onSlide,
  onDraft,
  onCommit,
  onSet,
}: {
  spec: Topic['parameters'][number];
  locale: string;
  value: number;
  draft: string;
  error: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onSlide: (v: number) => void;
  onDraft: (raw: string) => void;
  onCommit: (raw: string) => void;
  onSet: (v: number) => void;
}) {
  const t = useTranslations('solid');
  const label = loc(spec.label, locale);
  const unit = unitSymbol(spec.unit).trim();
  const id = `param-${spec.id}`;
  const errorId = `${id}-error`;

  if (spec.kind === 'toggle') {
    return (
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input type="checkbox" className="size-6 accent-primary" checked={value !== 0} onChange={(e) => onSet(e.target.checked ? 1 : 0)} />
        {label}
      </label>
    );
  }
  if (spec.kind === 'choice') {
    return (
      <label className="flex flex-col gap-1 font-semibold">
        {label}
        <select className={`${inputClass} w-auto`} value={value} onChange={(e) => onSet(Number(e.target.value))}>
          {(spec.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {loc(o.label, locale)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
        {unit ? <span className="font-normal text-muted"> ({unit})</span> : null}
      </label>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id={id}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onSlide(Number(e.target.value))}
          className="min-h-11 flex-1 accent-primary"
          dir="ltr"
        />
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          aria-label={t('typeValue', { label })}
          aria-invalid={error}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit(e.currentTarget.value);
            }
          }}
          className={inputClass}
          data-typed={spec.id}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="m-0 text-error" data-testid={`error-${spec.id}`}>
          {t('range', { min: String(spec.min), max: String(spec.max) })}
        </p>
      ) : null}
    </div>
  );
}
