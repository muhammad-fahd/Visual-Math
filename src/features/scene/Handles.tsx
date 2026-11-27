'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { format } from '../../lib/expr';
import { fromX, fromY, toX, toY, type DrawPoint, type Viewport } from '../../lib/graph';
import { snap, type ParamSpec } from '../../lib/params';
import type { useNumberFields } from './useNumberFields';

// The draggable points of a graph (FR-3.17, FR-3.29). They are the only pointer code of the 2D scene, and
// they live here in the feature layer, not in the renderer: each handle stops the event so the frame does not
// pan, and each one is a focusable control that the arrow keys move, so a point can be moved without a
// pointer. A handle writes the parameters its point is bound to; the parameter clamps and snaps it.

type Fields = ReturnType<typeof useNumberFields>;

const HIT = 11;

export function Handles({ points, viewport, specs, fields, values, labelOf }: { points: readonly DrawPoint[]; viewport: Viewport; specs: ReadonlyMap<string, ParamSpec>; fields: Fields; values: Readonly<Record<string, number>>; labelOf: (p: DrawPoint) => string }) {
  return (
    <g>
      {points.map((p) =>
        p.drag ? <Handle key={p.id} point={p} viewport={viewport} specs={specs} fields={fields} values={values} name={labelOf(p)} /> : null,
      )}
    </g>
  );
}

function Handle({ point, viewport, specs, fields, values, name }: { point: DrawPoint; viewport: Viewport; specs: ReadonlyMap<string, ParamSpec>; fields: Fields; values: Readonly<Record<string, number>>; name: string }) {
  const t = useTranslations('canvas');
  const dragging = useRef(false);
  const [focused, setFocused] = useState(false);
  const xSpec = point.drag?.x ? specs.get(point.drag.x) : undefined;
  const ySpec = point.drag?.y ? specs.get(point.drag.y) : undefined;
  const cx = toX(viewport, point.x);
  const cy = toY(viewport, point.y);

  /** Sets each bound parameter from a data position: on the point's own grid if it has one, then the parameter's. */
  const moveTo = (x: number, y: number) => {
    const grid = (v: number) => (point.snap ? Math.round(v / point.snap) * point.snap : v);
    if (xSpec) fields.slide(xSpec, snap(xSpec, grid(x)));
    if (ySpec) fields.slide(ySpec, snap(ySpec, grid(y)));
  };

  const toData = (e: PointerEvent<SVGGElement>): { x: number; y: number } | null => {
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const local = p.matrixTransform(ctm.inverse());
    return { x: fromX(viewport, local.x), y: fromY(viewport, local.y) };
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const big = e.shiftKey ? 10 : 1;
    // Never finer than the parameter's own step, or the parameter would round the move back to where it was.
    const stepX = Math.max(point.snap ?? 0, xSpec?.step ?? 1);
    const stepY = Math.max(point.snap ?? 0, ySpec?.step ?? 1);
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowRight') dx = stepX * big;
    else if (e.key === 'ArrowLeft') dx = -stepX * big;
    else if (e.key === 'ArrowUp') dy = stepY * big;
    else if (e.key === 'ArrowDown') dy = -stepY * big;
    else return;
    e.preventDefault();
    e.stopPropagation(); // the frame must not take the arrow keys for itself
    moveTo((xSpec ? (values[xSpec.id] ?? point.x) : point.x) + dx, (ySpec ? (values[ySpec.id] ?? point.y) : point.y) + dy);
  };

  if (!xSpec && !ySpec) return null; // bound to nothing the topic has: no handle that moves nothing
  const text = t('handleValue', { x: format(point.x, 2), y: format(point.y, 2) });
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-label={t('handle', { name })}
      aria-valuetext={text}
      aria-valuenow={xSpec ? point.x : point.y}
      aria-valuemin={xSpec?.min ?? ySpec?.min}
      aria-valuemax={xSpec?.max ?? ySpec?.max}
      data-handle={point.id}
      className="cursor-grab outline-none"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return; // only the main press drags
        e.stopPropagation(); // not a pan of the picture
        e.preventDefault();
        e.currentTarget.focus(); // preventDefault stops the browser doing it, and the arrow keys need the focus
        dragging.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // a synthetic pointer cannot be captured; the drag still works
        }
        const d = toData(e);
        if (d) moveTo(d.x, d.y);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        if (e.buttons === 0) {
          dragging.current = false; // the button was let go where we did not see it
          return;
        }
        e.stopPropagation();
        const d = toData(e);
        if (d) moveTo(d.x, d.y);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onLostPointerCapture={() => {
        dragging.current = false;
      }}
    >
      <circle cx={cx} cy={cy} r={HIT} fill="transparent" />
      {focused ? <circle cx={cx} cy={cy} r={HIT - 2} fill="none" className="stroke-focus" strokeWidth={2.2} /> : null}
    </g>
  );
}
