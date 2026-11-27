'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { snap, type ParamSpec } from '../../lib/params';
import { limitControl, type Control } from '../../lib/numbermodel';
import type { useNumberFields } from './useNumberFields';

// Drag and drop for the number and fraction models (FR-3.19). A control has discrete positions; the pointer
// picks the nearest one, the keyboard the next one, and the value goes to the parameter it is bound to (which
// clamps and snaps it). So a move is always a parameter write and the picture stays a function of the
// parameters. Each handle stops the event so the frame does not pan, and is a focusable `slider`.

type Fields = ReturnType<typeof useNumberFields>;

const HIT = 14;

export function ModelHandles({ controls, specs, fields }: { controls: readonly Control[]; specs: ReadonlyMap<string, ParamSpec>; fields: Fields }) {
  return (
    <g>
      {controls.map((c) => {
        const spec = specs.get(c.param);
        // Only the positions the parameter can take are offered (its range may be narrower than the picture's).
        const limited = spec ? limitControl(c, spec) : null;
        return spec && limited ? <ModelHandle key={c.id} control={limited} spec={spec} fields={fields} /> : null;
      })}
    </g>
  );
}

function ModelHandle({ control, spec, fields }: { control: Control; spec: ParamSpec; fields: Fields }) {
  const t = useTranslations('models');
  const dragging = useRef(false);
  const [focused, setFocused] = useState(false);
  const { values, positions, index } = control;
  const last = values.length - 1;
  const at = positions[index];
  if (!at || last < 0) return null;

  const pick = (i: number) => {
    const k = Math.min(last, Math.max(0, i));
    if (k !== index) fields.slide(spec, snap(spec, control.toParam(values[k]!)));
  };

  const nearestTo = (e: PointerEvent<SVGGElement>): number | null => {
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const local = p.matrixTransform(ctm.inverse());
    let best = 0;
    let bestD = Infinity;
    positions.forEach(([x, y], i) => {
      const d = (x - local.x) ** 2 + (y - local.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const big = e.shiftKey ? 10 : 1;
    let target: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = index + big;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = index - big;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = last;
    else return;
    e.preventDefault();
    e.stopPropagation(); // the frame must not take the arrow keys for itself
    pick(target);
  };

  const current = values[index]!;
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-label={t(control.label.key, control.label.values)}
      aria-valuemin={values[0]}
      aria-valuemax={values[last]}
      aria-valuenow={current}
      aria-valuetext={t('valueOf', { value: Number(current.toFixed(4)), max: values[last]! })}
      data-handle={control.id}
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
        const i = nearestTo(e);
        if (i !== null) pick(i);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        if (e.buttons === 0) {
          dragging.current = false; // the button was let go where we did not see it
          return;
        }
        e.stopPropagation();
        const i = nearestTo(e);
        if (i !== null) pick(i);
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
      <circle cx={at[0]} cy={at[1]} r={HIT} fill="transparent" />
      <circle cx={at[0]} cy={at[1]} r={8} className="fill-surface stroke-selected" strokeWidth={2.4} fillOpacity={0.85} />
      <circle cx={at[0]} cy={at[1]} r={2.6} className="fill-selected" />
      {focused ? <circle cx={at[0]} cy={at[1]} r={HIT - 2} fill="none" className="stroke-focus" strokeWidth={2.2} /> : null}
    </g>
  );
}
