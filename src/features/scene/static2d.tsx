import type { ReactElement } from 'react';
import { buildTool } from '../../lib/algebra';
import { format } from '../../lib/expr';
import { buildDrawables, measureLabel } from '../../lib/graph';
import { buildModel, type Label, type Prim } from '../../lib/numbermodel';
import { createProgram, defaults, type DerivedSpec } from '../../lib/params';
import { build, compose, dimsOf, drawLayers, fitBase, stateOf } from '../../lib/solid';
import { buildSpace } from '../../lib/space';
import { buildChart } from '../../lib/stats';
import { plainMath } from '../../lib/text';
import { buildTriangle, unitCircleAt } from '../../lib/trig';
import { Canvas2D } from '../../scenes/canvas2d';
import { startView } from '../../scenes/frame/camera';
import { NumberModel } from '../../scenes/numbermodel';
import { Solid2D } from '../../scenes/solid3d/Solid2D';
import { Space2D } from '../../scenes/space3d/Space2D';
import type { AlgebraToolSceneFull } from './AlgebraToolViewer';
import type { Canvas2DSceneFull } from './Canvas2DViewer';
import type { NumberModelSceneFull } from './NumberModelViewer';
import type { SolidScene } from './SolidViewer';
import type { SpaceSceneFull } from './SpaceViewer';
import type { StatsSceneFull } from './StatsViewer';
import type { RightTriangleSceneFull, UnitCircleSceneFull } from './TrigViewers';

// `static2D` of every scene type (the epic-3 goal, FR-3.29, AD-13): the picture of a topic's scene at its start
// values, as a pure React element with no hook, no listener and no browser API, so a server can render it (the
// tree and the home page thumbnails, a print view, the light mode). It is the same data and the same renderers as
// the viewer, which is why a thumbnail is the picture the visitor first sees. A new scene type is one case here and
// one line in `viewers.tsx`; `tests/unit/static2d.test.ts` fails when the two lists drift apart.
//
// This file has no `'use client'` on purpose: it must stay callable from a server component. The viewers, which
// have state, are in `viewers.tsx`.

type Loc = Record<string, string>;

export interface Static2DTopic {
  title: Loc;
  scene: { type: string; caption: Loc; [key: string]: unknown };
  parameters: readonly { id: string; min: number; max: number; step: number; default: number; kind?: 'number' | 'integer' | 'toggle' | 'choice'; unit?: string }[];
  derived?: readonly DerivedSpec[];
}

/** Words the pictures draw that belong to a language (the layouts stay free of any); English by default. */
export interface Static2DWords {
  opposite: string;
  adjacent: string;
  hypotenuse: string;
  heads: string;
  tails: string;
}

export interface Static2DInput {
  topic: Static2DTopic;
  /** The visitor's language; text falls back to English, then to any language there is. */
  locale: string;
  /** What a step says: parameter values on top of the start values, and the parts it hides or shows. */
  step?: { params?: Record<string, number>; hidden?: ReadonlySet<string>; shown?: ReadonlySet<string> };
  words?: Partial<Static2DWords>;
}

const ENGLISH: Static2DWords = { opposite: 'opposite', adjacent: 'adjacent', hypotenuse: 'hypotenuse', heads: 'H', tails: 'T' };

/** The scene types this file draws, for the test that keeps it level with the scene registry. */
export const STATIC2D_TYPES: readonly string[] = ['canvas2d', 'number-model', 'algebra-tool', 'unit-circle', 'right-triangle', 'stats', 'solid3d', 'space3d'];

const pick = (text: Loc | undefined, locale: string): string => text?.[locale] ?? text?.['en'] ?? Object.values(text ?? {})[0] ?? '';
const trim = (n: number) => format(n, 1).replace(/\.0$/, '');

function frame(caption: string, type: string, children: ReactElement): ReactElement {
  return (
    <div role="img" aria-label={caption} dir="ltr" data-static2d={type} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-border bg-surface">
      {children}
    </div>
  );
}

/** A step solver as a picture: the equation and the first moves, as lines of text. */
function solverPrims(lines: readonly { latex: string }[], revealed: number): Prim[] {
  return lines.slice(0, Math.min(revealed, 5)).map((l, i): Prim => ({ t: 'text', x: 30, y: 60 + i * 42, text: `${i + 1}   ${plainMath(l.latex)}`, anchor: 'start', size: 18, tone: 'axis', bold: i === 0 }));
}

/** The picture of a scene at its start values, or null for a scene type this file does not know. */
export function static2D({ topic, locale, step, words }: Static2DInput): ReactElement | null {
  // Each case below reads the fields its scene type has; the schema has already said they are there.
  const raw: unknown = topic.scene;
  const program = createProgram(
    topic.parameters.map((p) => p.id),
    [...(topic.derived ?? [])],
  );
  const values = { ...defaults(topic.parameters as never), ...(step?.params ?? {}) };
  const scope = program.scope(values);
  const hidden = step?.hidden;
  const caption = pick(topic.scene.caption, locale);
  const w = { ...ENGLISH, ...words };
  const text = (l: Label) => ('text' in l ? pick(l.text, locale) : plainMath(l.latex));

  switch (topic.scene.type) {
    case 'canvas2d': {
      const scene = raw as Canvas2DSceneFull;
      const drawables = buildDrawables({ scene, program, scope, view: { scale: 1, panX: 0, panY: 0 }, hidden, shown: step?.shown });
      return frame(
        caption,
        'canvas2d',
        <Canvas2D
          drawables={drawables}
          axes={scene.axes?.show !== false && !hidden?.has('axes')}
          grid={scene.grid !== false && !hidden?.has('grid')}
          xLabel={scene.axes?.xLabel ? text(scene.axes.xLabel as Label) : undefined}
          yLabel={scene.axes?.yLabel ? text(scene.axes.yLabel as Label) : undefined}
          ticks={typeof scene.axes?.ticks === 'number' ? scene.axes.ticks : undefined}
          labelText={(l) => (l ? text(l as Label) : '')}
          readoutText={(label, value, decimals) => `${pick(label, locale)}: ${Number.isFinite(value) ? format(value, decimals) : '—'}`}
          measureText={measureLabel}
        />,
      );
    }
    case 'number-model': {
      const scene = raw as NumberModelSceneFull;
      const built = buildModel({ model: scene.model, program, scope, params: new Set(), hidden, text });
      return frame(caption, 'number-model', <NumberModel prims={built.prims} />);
    }
    case 'algebra-tool': {
      const scene = raw as AlgebraToolSceneFull;
      const built = buildTool({ tool: scene.tool, program, scope, hidden });
      const prims = built.solver ? solverPrims(built.solver.lines, built.solver.revealed) : built.prims;
      return frame(caption, 'algebra-tool', <NumberModel prims={prims} />);
    }
    case 'unit-circle': {
      const scene = raw as UnitCircleSceneFull;
      const spec = topic.parameters.find((p) => p.id === scene.angle);
      const built = unitCircleAt({ scene, program, scope, unit: spec?.unit === 'rad' ? 'rad' : 'deg', hidden });
      return frame(caption, 'unit-circle', <NumberModel prims={built.prims} />);
    }
    case 'right-triangle': {
      const scene = raw as RightTriangleSceneFull;
      const built = buildTriangle({ given: scene.given, labels: scene.labels, ratios: scene.ratios, program, scope, words: w, hidden });
      return frame(caption, 'right-triangle', <NumberModel prims={built.prims} />);
    }
    case 'stats': {
      const scene = raw as StatsSceneFull;
      const built = buildChart({ chart: scene.chart, program, scope, hidden, text, words: { heads: w.heads, tails: w.tails } });
      return frame(caption, 'stats', <NumberModel prims={built.prims} />);
    }
    case 'solid3d': {
      const scene = raw as SolidScene;
      const kind = scene.solid.kind;
      const dimsAt = (at: Record<string, number>) => dimsOf(scene.solid.dims, program, at);
      const geometry = build(kind, dimsAt(values));
      const all = stateOf(scene, program, scope);
      const composed = compose(kind, geometry, { section: hidden?.has('section') ? undefined : all.section, net: hidden?.has('net') ? undefined : all.net, fill: hidden?.has('fill') ? undefined : all.fill });
      const fit = Math.max(fitBase(kind, dimsAt, topic.parameters, Boolean(scene.net)), composed.fit);
      const list = drawLayers(composed.layers, composed.showDimensions ? geometry.dimensions : [], geometry.radius, startView(scene.camera), fit);
      const labels = (scene.labels?.dimensions ?? true) && !hidden?.has('dimensions');
      return frame(
        caption,
        'solid3d',
        <Solid2D list={list} mode="solid" glass={composed.glass} layers={{ faces: true, edges: true, dimensions: labels, axes: false }} labelOf={(id, value) => `${id} = ${trim(value)}`} />,
      );
    }
    case 'space3d': {
      const scene = raw as SpaceSceneFull;
      const model = buildSpace({ scene, program, scope, hidden, labelOf: (label, id) => (label ? text(label as Label) : id) });
      return frame(caption, 'space3d', <Space2D model={model} view={startView(scene.camera)} geometry labels />);
    }
    default:
      return null;
  }
}
