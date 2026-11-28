'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { format } from '../../lib/expr';
import { buildDrawables, complex, measureLabel, resolveViewport, type Canvas2DScene, type ComplexFact, type DrawCurve, type DrawMeasure, type Label } from '../../lib/graph';
import type { ParamSpec } from '../../lib/params';
import { plainMath } from '../../lib/text';
import type { Topic } from '../../lib/topic-schema';
import { Canvas2D, MarkerShape } from '../../scenes/canvas2d';
import { STROKE } from '../../scenes/tokens';
import { SceneFrame, type View } from '../../scenes/frame';
import { Handles } from './Handles';
import { FormulaList, LiveRegion, ParameterControls, ReadoutList, type ViewerParts } from './SceneParts';
import { loc, spokenOf, useAnnouncement, useSceneState, type ReadoutSpec, type ViewerStep } from './useSceneState';

// The viewer of a `canvas2d@1` topic (Story 3.1, FR-3.17): the graph in its frame, the sliders and typed
// boxes, the legend and a text list of what the graph shows, and a trace. It shares the parameters, steps,
// address, Reset all, readouts and formulas with the solid viewer through `useSceneState`. Zoom and pan come
// from the frame; draggable points are handles in `Handles`; nothing here listens to the pointer itself.

type Loc = Record<string, string>;

export interface Canvas2DSceneFull extends Canvas2DScene {
  caption: Loc;
  description?: Loc;
  readouts?: ReadoutSpec[];
}

export interface Canvas2DTopic {
  title: Loc;
  scene: Canvas2DSceneFull;
  parameters: Topic['parameters'];
  derived?: Topic['derived'];
  formulas: Topic['formulas'];
}

export interface Canvas2DViewerProps {
  topic: Canvas2DTopic;
  step?: ViewerStep;
  highlight?: readonly string[];
  restore?: { seq: number; params: Record<string, number> };
  resetSeq?: number;
  onChanged?: (changed: Record<string, number>) => void;
  children?: (parts: ViewerParts) => React.ReactNode;
}

const trim = (n: number, d = 2) => format(n, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

export function Canvas2DViewer({ topic, step, highlight, restore, resetSeq, onChanged, children }: Canvas2DViewerProps) {
  const t = useTranslations('canvas');
  const { scene, parameters } = topic;
  const [traceX, setTraceX] = useState<number | null>(null);
  const traceId = useId();

  const shared = useSceneState({
    topic,
    step,
    highlight,
    restore,
    resetSeq,
    onChanged,
    onReset: () => setTraceX(null),
  });
  const { fields, values, program, scope, locale, firstSlider } = shared;
  const specs = useMemo(() => new Map<string, ParamSpec>(parameters.map((p) => [p.id, p])), [parameters]);

  const labelText = (label: Label | undefined): string => {
    if (!label) return '';
    return 'text' in label ? loc(label.text, locale) : plainMath(label.latex);
  };

  const base = useMemo(() => resolveViewport(scene, program, scope), [scene, program, scope]);

  // What the graph shows at the unzoomed window: the legend and the text list (the picture itself is aria-hidden).
  const overview = useMemo(
    () => buildDrawables({ scene, program, scope, view: { scale: 1, panX: 0, panY: 0 }, hidden: step?.hidden, shown: step?.shown, traceX }),
    [scene, program, scope, step?.hidden, step?.shown, traceX],
  );

  // The trace is there while a function is drawn: one a step hid, or that is invisible, is no reason for a slider.
  const traceOn = scene.trace !== false && overview.curves.some((c) => c.kind === 'function');

  const nameOf = (c: DrawCurve, i: number) => labelText(c.label) || t('curve', { n: i + 1 });
  const num = (n: number) => trim(n, 2);

  const sentences: string[] = [];
  overview.curves.forEach((c, i) => {
    const name = nameOf(c, i);
    const f = c.features;
    if (f && c.marks.intercepts) {
      if (f.roots.length > 0) sentences.push(t('xIntercepts', { name, values: f.roots.map(num).join(', ') }));
      if (f.yIntercept !== null) sentences.push(t('yIntercept', { name, y: num(f.yIntercept) }));
    }
    if (f && c.marks.turning) for (const p of f.turning) sentences.push(t(p.kind === 'min' ? 'turningMin' : 'turningMax', { name, x: num(p.x), y: num(p.y) }));
    if (f && c.marks.asymptotes) {
      for (const a of f.vertical) sentences.push(t('vertical', { name, x: num(a) }));
      for (const a of f.horizontal) sentences.push(t('horizontal', { name, y: num(a) }));
    }
    if (c.shade) sentences.push(t(c.shade.side === 'below' ? 'shadeBelow' : 'shadeAbove', { name }) + (c.shade.strict ? `; ${t('strict')}` : ''));
  });

  // Geometry: each measure and each transformed image is a sentence too, so a length, an angle or an image
  // vertex can be read without the picture, and it follows the drag live (FR-3.18).
  const measureValue = (m: DrawMeasure) => (Number.isFinite(m.value) ? num(m.value) : t('notDefined'));
  for (const m of overview.measures) sentences.push(t(`measure.${m.kind}`, { name: labelText(m.label) || m.of, value: measureValue(m) }));
  for (const sh of overview.shapes) {
    if (sh.kind === 'polygon' && sh.image) sentences.push(t('image', { name: labelText(sh.label) || sh.id, points: sh.points.map(([x, y]) => `(${num(x)}, ${num(y)})`).join(' ') }));
  }

  // The Argand elements (Story 4.2, FR-3.24): each number, sum, product, power and root as a sentence with its numbers.
  const elementLabel = (id: string) => {
    const el = scene.elements.find((e) => e.id === id);
    return el && 'label' in el ? (el.label as Label | undefined) : undefined;
  };
  const nameFor = (id: string) => labelText(elementLabel(id)) || id;
  const cxText = (f: ComplexFact): string => {
    const value = (re: number, im: number) => complex.formatComplex([re, im]);
    const deg = (d: number | null) => (d === null ? '' : num(d));
    switch (f.kind) {
      case 'number':
        return f.argument === null ? t('complex.numberZero', { name: nameFor(f.id) }) : t('complex.number', { name: nameFor(f.id), value: value(f.re, f.im), modulus: num(f.modulus), argument: deg(f.argument) });
      case 'add':
        return t('complex.add', { a: nameFor(f.of[0]), b: nameFor(f.of[1]), value: value(f.re, f.im) });
      case 'mul':
        return f.modulus === 0 ? t('complex.mulZero', { a: nameFor(f.of[0]), b: nameFor(f.of[1]) }) : t('complex.mul', { a: nameFor(f.of[0]), b: nameFor(f.of[1]), value: value(f.re, f.im), scale: num(f.scale), turn: deg(f.turn), modulus: num(f.modulus), argument: deg(f.argument) });
      case 'conj':
        return t('complex.conj', { a: nameFor(f.of), value: value(f.re, f.im) });
      case 'power':
        return f.modulus === 0 ? t('complex.powerZero', { a: nameFor(f.of), n: f.n }) : t('complex.power', { a: nameFor(f.of), n: f.n, value: value(f.re, f.im), modulus: num(f.modulus), argument: deg(f.argument) });
      case 'roots': {
        const head = t('complex.roots', { a: nameFor(f.of), n: f.n, radius: num(f.radius), step: num(360 / f.n), first: deg(f.first) });
        return f.n <= 8 ? `${head} ${t('complex.rootsList', { list: f.roots.map(([re, im]) => value(re, im)).join('; ') })}` : head;
      }
      case 'skipped':
        return t(`complex.skipped${f.reason === 'missing' ? 'Missing' : f.reason === 'notFinite' ? 'NotFinite' : f.reason === 'tooFar' ? 'TooFar' : 'Zero'}`, { name: nameFor(f.id) });
    }
  };
  for (const f of overview.complex) sentences.push(cxText(f));

  const traceSentences =
    traceOn && traceX !== null
      ? [t('traceAt', { x: num(traceX) }), ...overview.curves.flatMap((c, i) => (c.kind === 'function' ? [t('traceCurve', { name: nameOf(c, i), value: c.traceY !== null && Number.isFinite(c.traceY) ? num(c.traceY) : t('notDefined') })] : []))]
      : [];
  const announcement = useAnnouncement(spokenOf(shared.readouts, [...sentences, ...traceSentences]));

  const picture = (
    <div className="flex flex-col gap-4" data-canvas2d-viewer="">
      <SceneFrame
        title={shared.title}
        caption={loc(scene.caption, locale)}
        description={loc(scene.description, locale) || undefined}
        capabilities={{ rotate: false, zoom: scene.zoom !== false, pan: scene.pan === true }}
        onEscapeFromToolbar={() => firstSlider.current?.focus()}
        resetSeq={resetSeq}
      >
        {(view: View) => (
          <GraphPicture
            scene={scene}
            program={program}
            scope={scope}
            view={view}
            hidden={step?.hidden}
            shown={step?.shown}
            traceX={traceOn ? traceX : null}
            labelText={labelText}
            specs={specs}
            fields={fields}
            values={values}
            pointName={(i) => t('point', { n: i + 1 })}
            measureText={measureLabel}
            locale={locale}
          />
        )}
      </SceneFrame>
    </div>
  );

  const extras = (
    <>
      {traceOn ? (
        <div className="flex flex-col gap-2" data-testid="trace">
          <label htmlFor={traceId} className="font-semibold">
            {t('traceLabel')}
          </label>
          <input
            id={traceId}
            type="range"
            min={base.xMin}
            max={base.xMax}
            step={(base.xMax - base.xMin) / 200}
            value={traceX ?? (base.xMin + base.xMax) / 2}
            onChange={(e) => setTraceX(Number(e.target.value))}
            className="min-h-11 w-full accent-primary"
            dir="ltr"
            data-testid="trace-slider"
          />
          {traceX === null ? (
            <p className="m-0 text-muted">{t('traceOff')}</p>
          ) : (
            <ul className="m-0 list-none p-0" data-testid="trace-values">
              {traceSentences.map((s, i) => (
                <li key={i} className={i === 0 ? 'font-semibold' : undefined}>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {overview.curves.length > 0 ? (
        <div data-testid="legend">
          <h2 className="mb-2 text-xl font-semibold">{t('legend')}</h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {overview.curves.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3" data-legend={c.id}>
                <svg width="52" height="16" viewBox="0 0 52 16" aria-hidden="true" className="shrink-0">
                  <line x1={2} y1={8} x2={50} y2={8} className={STROKE[c.style.color]} strokeWidth={c.style.width === 3 ? 2.8 : c.style.width === 1 ? 1 : 1.8} strokeDasharray={c.style.dash === 'dashed' ? '6 4' : c.style.dash === 'dotted' ? '1.5 3.5' : undefined} />
                  <MarkerShape kind={c.style.marker} x={26} y={8} size={3} token={c.style.color} />
                </svg>
                <span>{t('legendEntry', { name: nameOf(c, i), dash: t(`dash.${c.style.dash}`), marker: t(`marker.${c.style.marker}`) })}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sentences.length > 0 ? (
        <div data-testid="features">
          <h2 className="mb-2 text-xl font-semibold">{t('features')}</h2>
          <ul className="m-0 flex list-disc flex-col gap-1 ps-6">
            {sentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

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


/** The picture for one view: the drawables for the frame's zoom and pan, and the handles over them. */
function GraphPicture({
  scene,
  program,
  scope,
  view,
  hidden,
  shown,
  traceX,
  labelText,
  specs,
  fields,
  values,
  pointName,
  measureText,
  locale,
}: {
  scene: Canvas2DSceneFull;
  program: Parameters<typeof buildDrawables>[0]['program'];
  scope: Parameters<typeof buildDrawables>[0]['scope'];
  view: View;
  hidden: ReadonlySet<string> | undefined;
  shown: ReadonlySet<string> | undefined;
  traceX: number | null;
  labelText: (l: Label | undefined) => string;
  specs: ReadonlyMap<string, ParamSpec>;
  fields: ReturnType<typeof useSceneState>['fields'];
  values: Record<string, number>;
  pointName: (i: number) => string;
  measureText: (m: DrawMeasure) => string;
  locale: string;
}) {
  const drawables = useMemo(
    () => buildDrawables({ scene, program, scope, view, hidden, shown, traceX }),
    [scene, program, scope, view, hidden, shown, traceX],
  );
  return (
    <div dir="ltr" className="absolute inset-0">
      <Canvas2D
        drawables={drawables}
        axes={scene.axes?.show !== false && !hidden?.has('axes')}
        grid={scene.grid !== false && !hidden?.has('grid')}
        xLabel={scene.axes?.xLabel ? labelText(scene.axes.xLabel) : undefined}
        yLabel={scene.axes?.yLabel ? labelText(scene.axes.yLabel) : undefined}
        ticks={typeof scene.axes?.ticks === 'number' ? scene.axes.ticks : undefined}
        traceX={traceX}
        labelText={labelText}
        measureText={measureText}
        readoutText={(label, value, decimals) => `${loc(label, locale)}: ${Number.isFinite(value) ? format(value, decimals) : '—'}`}
        overlay={
          <Handles
            points={drawables.points}
            viewport={drawables.viewport}
            specs={specs}
            fields={fields}
            values={values}
            labelOf={(p) => labelText(p.label) || pointName(drawables.points.indexOf(p))}
          />
        }
      />
    </div>
  );
}
