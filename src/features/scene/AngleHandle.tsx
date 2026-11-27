'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { snap, type ParamSpec } from '../../lib/params';
import { SPECIAL_DEGREES, angleFromPointer, fromDegrees, nextSpecial, trigValues, trim, type Unit } from '../../lib/trig';
import type { useNumberFields } from './useNumberFields';

// The draggable angle of the unit circle (FR-3.21). The pointer's direction about the circle's centre is the
// angle, which snaps to special angles near them; the keyboard moves one parameter step (Shift ten), Home and End
// the ends, PageUp and PageDown the next special angle. Each is a write to the angle parameter, which clamps and
// snaps it, so the picture stays a function of the parameters. The handle stops the event so the frame does not pan.

type Fields = ReturnType<typeof useNumberFields>;

const HIT = 14;

export interface AngleHandleProps {
  circle: { cx: number; cy: number; r: number; x: number; y: number };
  spec: ParamSpec;
  unit: Unit;
  /** The angle now, in the parameter's unit. */
  value: number;
  /** Special values to snap to, in the parameter's unit, and how close counts. */
  snapValues: readonly number[];
  within: number;
  fields: Fields;
}

export function AngleHandle({ circle, spec, unit, value, snapValues, within, fields }: AngleHandleProps) {
  const t = useTranslations('trig');
  const dragging = useRef(false);
  const [focused, setFocused] = useState(false);
  const { cx, cy, x, y } = circle;

  // A special angle is exact (the parameter's range still limits it); anything else goes on the parameter's step grid.
  const write = (v: number, exact = false) => fields.slide(spec, exact ? Math.min(spec.max, Math.max(spec.min, v)) : snap(spec, v));

  const fromPointer = (e: PointerEvent<SVGGElement>): { value: number; snapped: boolean } | null => {
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const local = p.matrixTransform(ctm.inverse());
    return angleFromPointer({ dx: local.x - cx, dy: cy - local.y, unit, current: value, min: spec.min, max: spec.max, snapValues, within });
  };

  const specials = snapValues.length > 0 ? snapValues : SPECIAL_DEGREES.map((d) => fromDegrees(d, unit));

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const big = e.shiftKey ? 10 : 1;
    let next: number | null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + spec.step * big;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - spec.step * big;
    else if (e.key === 'Home') next = spec.min;
    else if (e.key === 'End') next = spec.max;
    else if (e.key === 'PageUp') next = nextSpecial(value, specials, true);
    else if (e.key === 'PageDown') next = nextSpecial(value, specials, false);
    else return;
    e.preventDefault();
    e.stopPropagation(); // the frame must not take the arrow keys for itself
    if (next !== null) write(next);
  };

  const deg = unit === 'rad' ? (value * 180) / Math.PI : value;
  const r = trigValues(deg);
  const text = t('handleValue', { angle: trim(deg, 1), sin: trim(r.sin, 3), cos: trim(r.cos, 3) });
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-label={t('handle')}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-valuetext={text}
      data-handle="angle"
      className="cursor-grab outline-none"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return; // only the main press drags
        e.stopPropagation(); // not a pan of the picture
        e.preventDefault();
        e.currentTarget.focus(); // preventDefault stops the browser doing it, and the keys need the focus
        dragging.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // a synthetic pointer cannot be captured; the drag still works
        }
        const a = fromPointer(e);
        if (a !== null) write(a.value, a.snapped);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        if (e.buttons === 0) {
          dragging.current = false;
          return;
        }
        e.stopPropagation();
        const a = fromPointer(e);
        if (a !== null) write(a.value, a.snapped);
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
      <circle cx={x} cy={y} r={HIT} fill="transparent" />
      <circle cx={x} cy={y} r={9} className="fill-surface stroke-selected" strokeWidth={2.4} fillOpacity={0.85} />
      <circle cx={x} cy={y} r={2.8} className="fill-selected" />
      {focused ? <circle cx={x} cy={y} r={HIT - 2} fill="none" className="stroke-focus" strokeWidth={2.2} /> : null}
    </g>
  );
}
