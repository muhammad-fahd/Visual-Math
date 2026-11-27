import type { ReactNode } from 'react';
import { format } from '../../lib/expr';
import { H, W, niceTicks, tickDecimals, toX, toY, type Dash, type Drawables, type Label, type Marker, type Token, type Viewport } from '../../lib/graph';

// The picture of a `canvas2d` scene (AD-13 tier B for 2D, FR-3.17): grid, axes with numbers, tinted regions,
// curves told apart by dash and marker as well as color, the marked features, points, text and the trace
// cursor. A pure function of `Drawables`: no hooks, no listeners (the frame owns input), colors are tokens.
// So it renders to static markup for a thumbnail, and to the page. `overlay` is the one way in for the
// feature layer's handles: it is drawn last, inside the same coordinates.

const STROKE: Record<Token, string> = {
  axis: 'stroke-axis',
  grid: 'stroke-grid',
  curve1: 'stroke-curve-1',
  curve2: 'stroke-curve-2',
  fill: 'stroke-fill',
  accent: 'stroke-accent',
  muted: 'stroke-muted',
  success: 'stroke-success',
  error: 'stroke-error',
  hint: 'stroke-hint',
  selected: 'stroke-selected',
  edge: 'stroke-edge',
  section: 'stroke-section',
};
const FILL: Record<Token, string> = {
  axis: 'fill-axis',
  grid: 'fill-grid',
  curve1: 'fill-curve-1',
  curve2: 'fill-curve-2',
  fill: 'fill-fill',
  accent: 'fill-accent',
  muted: 'fill-muted',
  success: 'fill-success',
  error: 'fill-error',
  hint: 'fill-hint',
  selected: 'fill-selected',
  edge: 'fill-edge',
  section: 'fill-section',
};

const DASH: Record<Dash, string | undefined> = { solid: undefined, dashed: '6 4', dotted: '1.5 3.5' };
const WIDTH = { 1: 1, 2: 1.8, 3: 2.8 } as const;

export interface Canvas2DProps {
  drawables: Drawables;
  axes: boolean;
  grid: boolean;
  /** Where the trace cursor is (data x), or null. */
  traceX?: number | null;
  /** Text of a label (the visitor's language, or the plain form of a formula). */
  labelText: (label: Label | undefined) => string;
  /** Text of a readout line, already formatted. */
  readoutText: (label: Record<string, string>, value: number, decimals: number) => string;
  /** Feature-layer handles, drawn last. */
  overlay?: ReactNode;
  /** A prefix that makes the ids of this picture unique on the page. */
  idPrefix?: string;
}

/** A marker of `size` centred on (x, y). */
export function MarkerShape({ kind, x, y, size, token, className }: { kind: Marker; x: number; y: number; size: number; token: Token; className?: string }) {
  const s = size;
  const cls = `${FILL[token]} stroke-surface ${className ?? ''}`;
  switch (kind) {
    case 'square':
      return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} className={cls} strokeWidth={0.6} />;
    case 'diamond':
      return <polygon points={`${x},${y - s * 1.3} ${x + s * 1.3},${y} ${x},${y + s * 1.3} ${x - s * 1.3},${y}`} className={cls} strokeWidth={0.6} />;
    case 'triangle':
      return <polygon points={`${x},${y - s * 1.2} ${x + s * 1.2},${y + s} ${x - s * 1.2},${y + s}`} className={cls} strokeWidth={0.6} />;
    default:
      return <circle cx={x} cy={y} r={s} className={cls} strokeWidth={0.6} />;
  }
}

const path = (v: Viewport, points: readonly (readonly [number, number])[], close = false): string =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${toX(v, x).toFixed(2)} ${toY(v, y).toFixed(2)}`).join(' ') + (close ? ' Z' : '');

/** About this many evenly spaced markers along a line, whatever its length. */
const MARKS = 7;

export function Canvas2D({ drawables, axes, grid, traceX = null, labelText, readoutText, overlay, idPrefix = 'c2d' }: Canvas2DProps) {
  const v = drawables.viewport;
  const xs = niceTicks(v.xMin, v.xMax, 8);
  const ys = niceTicks(v.yMin, v.yMax, 6);
  const xd = tickDecimals(xs);
  const yd = tickDecimals(ys);
  const x0 = toX(v, 0);
  const y0 = toY(v, 0);
  const axisX = Math.min(H, Math.max(0, y0)); // an axis that is off screen sits on the edge
  const axisY = Math.min(W, Math.max(0, x0));
  const clip = `${idPrefix}-clip`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full" data-canvas2d="">
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {grid ? (
          <g className="stroke-grid" strokeWidth={0.35} opacity={0.7}>
            {xs.map((t) => (
              <line key={`gx${t}`} x1={toX(v, t)} y1={0} x2={toX(v, t)} y2={H} />
            ))}
            {ys.map((t) => (
              <line key={`gy${t}`} x1={0} y1={toY(v, t)} x2={W} y2={toY(v, t)} />
            ))}
          </g>
        ) : null}

        {drawables.regions.map((r) =>
          r.polygons.map((poly, i) => <path key={`${r.id}-${i}`} d={path(v, poly, true)} className={`${FILL[r.style.color ?? 'selected']} ${STROKE[r.style.color ?? 'selected']}`} fillOpacity={r.style.fill === 'medium' ? 0.55 : 0.35} strokeWidth={0.5} data-element={r.id} data-kind="region" />),
        )}
        {drawables.curves.map((c) =>
          c.shade
            ? c.shade.polygons.map((poly, i) => <path key={`${c.id}-s${i}`} d={path(v, poly, true)} className={FILL[c.style.color]} fillOpacity={0.16} stroke="none" data-element={c.id} data-kind="shade" />)
            : null,
        )}

        {axes ? (
          <g className="stroke-axis" strokeWidth={0.9}>
            <line x1={0} y1={axisX} x2={W} y2={axisX} />
            <line x1={axisY} y1={0} x2={axisY} y2={H} />
            {xs.map((t) => (
              <line key={`tx${t}`} x1={toX(v, t)} y1={axisX - 2.5} x2={toX(v, t)} y2={axisX + 2.5} strokeWidth={0.7} />
            ))}
            {ys.map((t) => (
              <line key={`ty${t}`} x1={axisY - 2.5} y1={toY(v, t)} x2={axisY + 2.5} y2={toY(v, t)} strokeWidth={0.7} />
            ))}
          </g>
        ) : null}

        {drawables.curves.flatMap((c) => c.features?.vertical.filter(() => c.marks.asymptotes).map((a) => (
          <line key={`${c.id}-va${a}`} x1={toX(v, a)} y1={0} x2={toX(v, a)} y2={H} className="stroke-muted" strokeWidth={0.9} strokeDasharray="5 3" data-element={c.id} data-kind="asymptote" data-at={a} />
        )) ?? [])}
        {drawables.curves.flatMap((c) => c.features?.horizontal.filter(() => c.marks.asymptotes).map((a) => (
          <line key={`${c.id}-ha${a}`} x1={0} y1={toY(v, a)} x2={W} y2={toY(v, a)} className="stroke-muted" strokeWidth={0.9} strokeDasharray="5 3" data-element={c.id} data-kind="asymptote" data-at={a} />
        )) ?? [])}

        {drawables.curves.map((c) => (
          <g key={c.id} data-element={c.id} data-kind={c.kind}>
            {c.segments.map((seg, i) => (
              <path key={i} d={path(v, seg)} fill="none" className={STROKE[c.style.color]} strokeWidth={WIDTH[c.style.width]} strokeDasharray={DASH[c.style.dash]} strokeLinejoin="round" strokeLinecap={c.style.dash === 'dotted' ? 'round' : 'butt'} />
            ))}
            {c.segments.flatMap((seg, i) => {
              if (seg.length < 2) return [];
              // Markers at evenly spaced samples of the longest runs, so a curve carries its shape without color.
              const step = Math.max(1, Math.floor(seg.length / MARKS));
              const shapes = [];
              for (let k = Math.floor(step / 2); k < seg.length; k += step) {
                const [px, py] = seg[k]!;
                const sx = toX(v, px);
                const sy = toY(v, py);
                if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) shapes.push(<MarkerShape key={`${i}-${k}`} kind={c.style.marker} x={sx} y={sy} size={2.2} token={c.style.color} />);
              }
              return shapes;
            })}
          </g>
        ))}

        {drawables.curves.flatMap((c) => {
          const f = c.features;
          if (!f) return [];
          const items = [];
          if (c.marks.intercepts) {
            for (const r of f.roots) items.push(<MarkerShape key={`${c.id}-r${r}`} kind="circle" x={toX(v, r)} y={toY(v, 0)} size={3.2} token="accent" />);
            if (f.yIntercept !== null) items.push(<MarkerShape key={`${c.id}-yi`} kind="circle" x={toX(v, 0)} y={toY(v, f.yIntercept)} size={3.2} token="accent" />);
          }
          if (c.marks.turning) for (const t of f.turning) items.push(<MarkerShape key={`${c.id}-t${t.x}`} kind="diamond" x={toX(v, t.x)} y={toY(v, t.y)} size={3} token="error" />);
          return items;
        })}

        {drawables.curves.map((c) => {
          const text = labelText(c.label);
          const last = c.segments[c.segments.length - 1];
          if (!text || !last) return null;
          const [px, py] = last[last.length - 1]!;
          const sx = Math.min(W - 4, Math.max(4, toX(v, px)));
          const sy = Math.min(H - 4, Math.max(8, toY(v, py) - 5));
          return (
            <text key={`${c.id}-label`} x={sx} y={sy} textAnchor="end" fontSize={9} fontWeight={600} className={`${FILL[c.style.color]} stroke-bg`} strokeWidth={2.4} style={{ paintOrder: 'stroke' }} data-label={c.id}>
              {text}
            </text>
          );
        })}

        {traceX !== null && Number.isFinite(traceX) ? (
          <g data-trace="">
            <line x1={toX(v, traceX)} y1={0} x2={toX(v, traceX)} y2={H} className="stroke-text" strokeWidth={0.8} strokeDasharray="2 3" />
            {drawables.curves.map((c) =>
              c.traceY !== null && Number.isFinite(c.traceY) ? <MarkerShape key={`${c.id}-tr`} kind={c.style.marker} x={toX(v, traceX)} y={toY(v, c.traceY)} size={3.6} token={c.style.color} /> : null,
            )}
          </g>
        ) : null}

        {drawables.points.map((p) => (
          <g key={p.id} data-element={p.id} data-kind="point">
            <MarkerShape kind={p.style.marker ?? 'circle'} x={toX(v, p.x)} y={toY(v, p.y)} size={3.6} token={p.style.color ?? 'curve2'} />
            {labelText(p.label) ? (
              <text x={toX(v, p.x) + 6} y={toY(v, p.y) - 6} fontSize={9} className="fill-text stroke-bg" strokeWidth={2.2} style={{ paintOrder: 'stroke' }}>
                {labelText(p.label)}
              </text>
            ) : null}
          </g>
        ))}
        {drawables.texts.map((t) => (
          <text key={t.id} x={toX(v, t.x)} y={toY(v, t.y)} fontSize={10} className="fill-text stroke-bg" strokeWidth={2.2} style={{ paintOrder: 'stroke' }} data-element={t.id}>
            {labelText(t.label)}
          </text>
        ))}
        {drawables.readouts.map((r) => (
          <text key={r.id} x={toX(v, r.x)} y={toY(v, r.y)} fontSize={10} fontWeight={600} className="fill-text stroke-bg" strokeWidth={2.2} style={{ paintOrder: 'stroke' }} data-element={r.id}>
            {readoutText(r.label, r.value, r.decimals)}
          </text>
        ))}
      </g>

      {axes ? (
        <g fontSize={8} className="fill-muted stroke-bg" strokeWidth={2} style={{ paintOrder: 'stroke' }}>
          {xs
            .filter((t) => t !== 0)
            .map((t) => (
              <text key={`lx${t}`} x={toX(v, t)} y={Math.min(H - 3, axisX + 11)} textAnchor="middle">
                {format(t, xd)}
              </text>
            ))}
          {ys
            .filter((t) => t !== 0)
            .map((t) => (
              <text key={`ly${t}`} x={Math.min(W - 2, Math.max(14, axisY - 4))} y={toY(v, t) + 3} textAnchor="end">
                {format(t, yd)}
              </text>
            ))}
        </g>
      ) : null}
      {overlay}
    </svg>
  );
}
