import type { Section } from '../../lib/solid';

// The flat shape a cutting plane makes (FR-3.10), drawn in its own small panel beside the picture. Pure
// SVG from the cut polygon in the plane's own axes; its name and measurements are written next to it by
// the viewer in words and numbers, so the shape is never told by color alone.

const SIZE = 100;
const MARGIN = 8;

export function SectionPanel({ section }: { section: Section }) {
  const pts = section.polygon2;
  const reach = Math.max(1e-9, ...pts.flatMap((p) => [Math.abs(p[0]), Math.abs(p[1])]));
  const k = (SIZE / 2 - MARGIN) / reach;
  const points = pts.map((p) => `${(p[0] * k).toFixed(2)},${(-p[1] * k).toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false" className="h-40 w-40 shrink-0 rounded-md border-2 border-border bg-surface" data-section-panel="">
      <polygon points={points} className="fill-section stroke-section" strokeWidth={1.2} strokeLinejoin="round" style={{ fillOpacity: 0.35 }} />
    </svg>
  );
}
