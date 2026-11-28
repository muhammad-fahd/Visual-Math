import type { P2, Plane } from '../../lib/matrix';
import { FILL, STROKE } from '../tokens';

// The flat picture of a `matrix-transform@1` scene in 2D (Story 4.4, FR-3.27): the window with its grid and axes, the original
// shape as a dashed ghost, the transformed shape solid, the filled image of the unit square (the determinant as area), the
// images of the basis vectors as arrows, and the eigenvector lines. A pure function of the drawing model, drawn in a square
// window of `range` each way; colors are tokens, labels are symbols, nothing here listens to anything.

export interface Matrix2DProps {
  plane: Plane;
}

const r = (n: number) => Math.round(n * 1000) / 1000;

export function Matrix2D({ plane }: Matrix2DProps) {
  const { range } = plane;
  const X = (x: number) => r(x);
  const Y = (y: number) => r(-y);
  const path = (pts: readonly P2[], closed: boolean) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p[0])},${Y(p[1])}`).join(' ') + (closed ? ' Z' : '');
  const step = range <= 12 ? 1 : Math.ceil(range / 12);
  const last = Math.floor(range / step) * step;
  const ticks: number[] = [];
  for (let i = -last; i <= last; i += step) ticks.push(i);
  const w = range / 60; // a line's weight scales with the window, so every range looks alike
  const head = range * 0.07;

  /** An arrow from the origin to `to`, with a two-barb head (nothing when the vector is too short to point). */
  const arrow = (to: P2) => {
    const len = Math.hypot(to[0], to[1]);
    if (len < 1e-9 || len > range * 100) return null;
    const ux = to[0] / len;
    const uy = to[1] / len;
    const h = Math.min(head, len * 0.4);
    const bx = to[0] - ux * h;
    const by = to[1] - uy * h;
    const px = -uy * h * 0.45;
    const py = ux * h * 0.45;
    return `M${X(bx + px)},${Y(by + py)} L${X(to[0])},${Y(to[1])} L${X(bx - px)},${Y(by - py)}`;
  };
  const longLine = (v: P2): [P2, P2] => [[-v[0] * range * 3, -v[1] * range * 3], [v[0] * range * 3, v[1] * range * 3]];

  return (
    <svg viewBox={`${-range} ${-range} ${range * 2} ${range * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full" data-matrix-2d="">
      {plane.grid ? (
        <g data-part="grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={X(t)} y1={Y(-range)} x2={X(t)} y2={Y(range)} className={t === 0 ? STROKE.axis : STROKE.grid} strokeWidth={t === 0 ? w * 1.4 : w * 0.7} />
              <line x1={X(-range)} y1={Y(t)} x2={X(range)} y2={Y(t)} className={t === 0 ? STROKE.axis : STROKE.grid} strokeWidth={t === 0 ? w * 1.4 : w * 0.7} />
            </g>
          ))}
        </g>
      ) : null}
      {plane.area ? <path d={path(plane.area, true)} className={`${FILL.accent} ${STROKE.accent}`} style={{ fillOpacity: 0.28 }} strokeWidth={w} data-part="area" /> : null}
      <g data-part="ghost">
        {plane.ghost.map((g, i) => (
          <path key={i} d={path(g.points, g.closed)} fill="none" className={STROKE.edge} strokeWidth={w * 0.8} strokeDasharray={`${w * 4} ${w * 3}`} data-ghost={g.id} />
        ))}
      </g>
      <g data-part="result">
        {plane.result.map((g, i) => (
          <path key={i} d={path(g.points, g.closed)} fill="none" className={g.closed ? STROKE.curve1 : STROKE.curve2} strokeWidth={g.closed ? w * 2 : w * 0.9} strokeLinejoin="round" data-result={g.id} />
        ))}
      </g>
      {plane.eigenLines.map((e) => {
        const [a, b] = longLine(e.vector);
        return (
          <g key={e.id} data-eigen={e.id}>
            <line x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} className={STROKE.section} strokeWidth={w * 1.6} strokeDasharray={`${w * 6} ${w * 3}`} />
            <text x={X(e.vector[0] * range * 0.8 + w * 4)} y={Y(e.vector[1] * range * 0.8)} fontSize={range * 0.075} className="fill-text stroke-bg" strokeWidth={w * 2} style={{ paintOrder: 'stroke' }}>
              {e.text}
            </text>
          </g>
        );
      })}
      {plane.basis.map((b, i) => {
        const d = arrow(b.to);
        return (
          <g key={b.id} data-basis={b.id}>
            <line x1={0} y1={0} x2={X(b.to[0])} y2={Y(b.to[1])} className={i === 0 ? STROKE.curve1 : STROKE.curve2} strokeWidth={w * 2.4} strokeLinecap="round" />
            {d ? <path d={d} fill="none" className={i === 0 ? STROKE.curve1 : STROKE.curve2} strokeWidth={w * 2.4} strokeLinecap="round" strokeLinejoin="round" /> : null}
            <text x={X(b.to[0]) + w * 4} y={Y(b.to[1]) - w * 4} fontSize={range * 0.08} fontWeight={600} className="fill-text stroke-bg" strokeWidth={w * 2} style={{ paintOrder: 'stroke' }}>
              {b.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
