import type { DrawList, Mode, Token } from '../../lib/solid';
import { HALF } from '../../lib/solid';

// The flat picture of a solid (Tier B and C of AD-13, and the overlay that carries dimension labels and
// axes over the 3D picture). A pure function of what `drawList` says: colors are tokens, text is a
// label in the visitor's language, and nothing here listens to anything. The frame owns input.

export interface Layers {
  faces: boolean;
  edges: boolean;
  dimensions: boolean;
  axes: boolean;
}

export interface Solid2DProps {
  list: DrawList;
  mode: Mode;
  layers: Layers;
  /** `r = 3` for each dimension, already built by the viewer from its labels and numbers. */
  labelOf: (id: string, value: number) => string;
  /** A section or a liquid needs a see-through solid: the solid is drawn as in Transparent. */
  glass?: boolean;
}

// Scene colors are tokens (DESIGN.md): the fill of a solid, the cutting plane and cut, the liquid.
const FACE: Record<Token, string> = { fill: 'fill-fill stroke-fill', section: 'fill-section stroke-section', curve1: 'fill-curve-1 stroke-curve-1' };
const LINE: Record<Token, string> = { fill: 'stroke-edge', section: 'stroke-section', curve1: 'stroke-curve-1' };

const VIEWBOX = `${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`;

export function Solid2D({ list, mode: asked, layers, labelOf, glass = false }: Solid2DProps) {
  const mode: Mode = glass && asked === 'solid' ? 'transparent' : asked;
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full" data-solid-2d="">
      {layers.axes
        ? list.axes.map((a) => (
            <g key={a.id} className="stroke-axis" strokeWidth={0.5}>
              <line x1={a.a.x} y1={a.a.y} x2={a.b.x} y2={a.b.y} />
              <text x={a.b.x} y={a.b.y} fontSize={4} className="fill-text stroke-none" dy={-1}>
                {a.id}
              </text>
            </g>
          ))
        : null}
      {layers.faces && mode !== 'wireframe'
        ? list.faces
            .filter((f) => f.front || mode === 'transparent')
            .map((f, i) => {
              // The solid and its net follow the mode; the plane, the cut face and the liquid have their own look.
              const own = f.layer === 'solid' || f.layer === 'net';
              const fillOpacity = own ? (mode === 'transparent' && f.layer === 'solid' ? 0.12 + 0.12 * f.light : 0.55 + 0.45 * f.light) : f.opacity;
              const strokeOpacity = own ? (mode === 'transparent' && f.layer === 'solid' ? 0.12 : 1) : f.layer === 'plane' ? 0.5 : 1;
              return <polygon key={i} points={f.points} className={FACE[f.token]} strokeWidth={f.layer === 'cut' ? 0.9 : 0.25} strokeLinejoin="round" style={{ fillOpacity, strokeOpacity }} data-layer={f.layer} />;
            })
        : null}
      {layers.edges
        ? list.edges
            .filter((e) => e.layer !== 'solid' || mode !== 'solid' || !e.hidden)
            .filter((e) => !(mode === 'wireframe' && e.layer === 'plane'))
            .map((e, i) => (
              <line
                key={i}
                x1={e.a.x}
                y1={e.a.y}
                x2={e.b.x}
                y2={e.b.y}
                className={LINE[e.token]}
                strokeWidth={e.layer === 'cut' ? 1.4 : 0.8}
                strokeLinecap="round"
                strokeDasharray={e.layer === 'plane' ? '3 2' : e.hidden ? '1.5 1.5' : undefined}
                data-layer={e.layer}
              />
            ))
        : null}
      {layers.dimensions
        ? list.dimensions.map((d) => (
            <g key={d.id}>
              <line x1={d.a.x} y1={d.a.y} x2={d.b.x} y2={d.b.y} className="stroke-accent" strokeWidth={0.9} strokeDasharray="3 1.5" />
              <circle cx={d.a.x} cy={d.a.y} r={1} className="fill-accent" />
              <circle cx={d.b.x} cy={d.b.y} r={1} className="fill-accent" />
              <text
                x={d.label.x}
                y={d.label.y}
                fontSize={5}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-text stroke-bg"
                strokeWidth={1.2}
                style={{ paintOrder: 'stroke' }}
                data-dimension={d.id}
              >
                {labelOf(d.id, d.value)}
              </text>
            </g>
          ))
        : null}
    </svg>
  );
}
