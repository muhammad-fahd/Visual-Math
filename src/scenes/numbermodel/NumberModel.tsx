import type { ReactNode } from 'react';
import { H, W, type Fill, type Prim } from '../../lib/numbermodel';
import { FILL, STROKE } from '../tokens';

// The picture of a `number-model` scene (Story 3.3, FR-3.19): rectangles, sectors, lines, dots and text that
// `lib/numbermodel` laid out in a 400 by 300 box. A pure function of the prims: no hooks and no listeners (the
// handles are drawn by the feature layer through `overlay`), colors are tokens, so it renders to static markup
// for a thumbnail as well as to the page.

const OPACITY: Record<Fill, number> = { none: 0, light: 0.14, medium: 0.38, solid: 0.95 };

function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx.toFixed(2)} ${cy.toFixed(2)} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function PrimView({ p }: { p: Prim }) {
  switch (p.t) {
    case 'rect':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} className={`${FILL[p.tone]} ${STROKE[p.tone]}`} fillOpacity={OPACITY[p.fill]} strokeWidth={1} />;
    case 'line':
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} className={STROKE[p.tone]} strokeWidth={p.width} strokeDasharray={p.dash ? '6 4' : undefined} strokeLinecap="round" />;
    case 'text':
      return (
        <text x={p.x} y={p.y} textAnchor={p.anchor} fontSize={p.size} fontWeight={p.bold ? 700 : 500} className={`${FILL[p.tone]} stroke-bg`} strokeWidth={2.4} style={{ paintOrder: 'stroke' }}>
          {p.text}
        </text>
      );
    case 'dot':
      return <circle cx={p.x} cy={p.y} r={p.r} className={`${FILL[p.tone]} stroke-surface`} strokeWidth={1} />;
    case 'sector': {
      const className = `${FILL[p.tone]} ${STROKE[p.tone]}`;
      // One sector is the whole circle (a fraction with denominator 1): an arc from a point to itself draws nothing.
      if (p.a1 - p.a0 >= 2 * Math.PI - 1e-9) return <circle cx={p.cx} cy={p.cy} r={p.r} className={className} fillOpacity={OPACITY[p.fill]} strokeWidth={1.2} />;
      return <path d={sectorPath(p.cx, p.cy, p.r, p.a0, p.a1)} className={className} fillOpacity={OPACITY[p.fill]} strokeWidth={1.2} strokeLinejoin="round" />;
    }
    case 'path':
      if (p.points.length < 2) return null;
      return <path d={p.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')} fill="none" className={STROKE[p.tone]} strokeWidth={p.width} strokeDasharray={p.dash ? '6 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />;
    case 'jump': {
      const mid = (p.x1 + p.x2) / 2;
      const dir = p.x2 > p.x1 ? 1 : -1;
      return (
        <g className={STROKE[p.tone]}>
          <path d={`M${p.x1} ${p.y} Q${mid} ${p.y - 2 * p.h} ${p.x2} ${p.y}`} fill="none" strokeWidth={2} />
          <polygon points={`${p.x2},${p.y} ${p.x2 - 4 * dir},${p.y - 8} ${p.x2 + 4 * dir},${p.y - 6}`} className={FILL[p.tone]} strokeWidth={1} />
        </g>
      );
    }
  }
}

export interface NumberModelProps {
  prims: readonly Prim[];
  /** Feature-layer handles, drawn last, in the same coordinates. */
  overlay?: ReactNode;
}

export function NumberModel({ prims, overlay }: NumberModelProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full" data-number-model="">
      {prims.map((p, i) => (
        <PrimView key={i} p={p} />
      ))}
      {overlay}
    </svg>
  );
}
