import { HALF, project } from '../../lib/solid';
import type { ViewLike } from '../../lib/solid';
import type { Dash, SpaceModel, SpaceToken } from '../../lib/space';

// The flat picture of a `space3d` scene (Tier B and C of AD-13, the static image, and the overlay that carries the labels
// over the 3D picture). A pure function of the drawing model and the view: the same `project()` the three.js camera is
// built to match, so the tiers cannot disagree. Colors are tokens, text is a label in the visitor's language, and nothing
// here listens to anything; the frame owns input.

export interface Space2DProps {
  model: SpaceModel;
  view: ViewLike;
  /** The lines, patches and marks. Off over the 3D picture, which draws them itself. */
  geometry: boolean;
  /** The letters beside things: element labels and axis names. */
  labels: boolean;
}

const STROKE: Record<SpaceToken, string> = {
  curve1: 'stroke-curve-1',
  curve2: 'stroke-curve-2',
  section: 'stroke-section',
  accent: 'stroke-accent',
  axis: 'stroke-axis',
  grid: 'stroke-grid',
  edge: 'stroke-edge',
};
const FILL: Record<SpaceToken, string> = {
  curve1: 'fill-curve-1',
  curve2: 'fill-curve-2',
  section: 'fill-section',
  accent: 'fill-accent',
  axis: 'fill-axis',
  grid: 'fill-grid',
  edge: 'fill-edge',
};
const DASH: Record<Dash, string | undefined> = { solid: undefined, dashed: '3 2', dotted: '0.6 1.6' };

const VIEWBOX = `${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`;
const r = (n: number) => Math.round(n * 100) / 100;

export function Space2D({ model, view, geometry, labels }: Space2DProps) {
  const at = (p: readonly [number, number, number]) => project(p, view, model.fit);
  const patches = model.patches
    .map((p) => {
      const pts = p.points.map(at);
      return { id: p.id, token: p.token, opacity: p.opacity, depth: pts.reduce((s, q) => s + q.depth, 0) / Math.max(1, pts.length), points: pts.map((q) => `${r(q.x)},${r(q.y)}`).join(' ') };
    })
    .sort((a, b) => a.depth - b.depth);
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full" data-space-2d="">
      {geometry
        ? patches.map((p, i) => <polygon key={`p${i}`} points={p.points} className={`${FILL[p.token]} ${STROKE[p.token]}`} strokeWidth={0.2} style={{ fillOpacity: p.opacity, strokeOpacity: 0.6 }} data-patch={p.id} />)
        : null}
      {geometry
        ? model.segments.map((s, i) => {
            const a = at(s.a);
            const b = at(s.b);
            return (
              <line
                key={`s${i}`}
                x1={r(a.x)}
                y1={r(a.y)}
                x2={r(b.x)}
                y2={r(b.y)}
                className={STROKE[s.token]}
                strokeWidth={s.weight === 2 ? 1 : 0.4}
                strokeLinecap="round"
                strokeDasharray={DASH[s.dash]}
                data-seg={s.id}
              />
            );
          })
        : null}
      {geometry
        ? model.marks.map((m, i) => {
            const p = at(m.at);
            return <circle key={`m${i}`} cx={r(p.x)} cy={r(p.y)} r={1.3} className={FILL[m.token]} data-mark={m.id} />;
          })
        : null}
      {labels
        ? model.tags.map((t, i) => {
            const p = at(t.at);
            return (
              <text
                key={`t${i}`}
                x={r(p.x + 1.8)}
                y={r(p.y - 1.8)}
                fontSize={t.id === 'axes' ? 4 : 4.6}
                fontWeight={t.id === 'axes' ? 400 : 600}
                className="fill-text stroke-bg"
                strokeWidth={1.1}
                style={{ paintOrder: 'stroke' }}
                data-tag={t.id}
              >
                {t.text}
              </text>
            );
          })
        : null}
    </svg>
  );
}
