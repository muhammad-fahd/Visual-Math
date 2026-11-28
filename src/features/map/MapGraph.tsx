'use client';

import { useLocale, useTranslations } from 'next-intl';
import { i18n } from '../../i18n/support';
import { topicHref } from '../../lib/library';
import type { MapLayout } from '../../lib/map';
import { useViewedIds } from '../progress';

// The picture of one learning map (Story 5.5): chapters as rows, topics as nodes, an arrow from each prerequisite to the
// topic that needs it. It is a picture only: hidden from assistive technology and out of the tab order, because the list
// beside it says the same thing in full. It stays left to right in Urdu, like every diagram; the words inside a node
// follow their own direction: in SVG `text-anchor` start and end follow that direction, so text that runs right to left
// is anchored `start` at the right edge of its box. A viewed topic carries a check. The level is a word in the node, never color alone.

export function MapGraph({ layout }: { layout: MapLayout }) {
  const t = useTranslations();
  const locale = useLocale();
  const viewed = useViewedIds();
  const rtl = i18n.direction(locale) === 'rtl';
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface" dir="ltr" data-map-scroll="">
      <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false" data-map-graph="" className="block max-w-none">
        <defs>
          <marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-edge" />
          </marker>
        </defs>
        {layout.lanes.map((lane, i) => (
          <g key={i} data-map-lane="">
            <rect x={6} y={lane.y} width={layout.width - 12} height={lane.h} rx={8} className="fill-none stroke-border" strokeDasharray={lane.external ? '4 4' : undefined} />
            <text x={rtl ? layout.width - 16 : 16} y={lane.y + 17} fontSize={13} fontWeight={600} textAnchor="start" direction={rtl ? 'rtl' : 'ltr'} className="fill-muted">
              {lane.external ? t('map.outside') : lane.name}
            </text>
          </g>
        ))}
        {layout.edges.map((e) => (
          <path key={`${e.from}>${e.to}`} d={e.d} className="fill-none stroke-edge" strokeWidth={1.6} markerEnd="url(#map-arrow)" data-map-edge={`${e.from}>${e.to}`} />
        ))}
        {layout.nodes.map((n) => {
          const done = viewed.has(n.id);
          const tx = rtl ? n.x + n.w - 10 : n.x + 10;
          const dir = rtl ? 'rtl' : 'ltr';
          return (
            <a key={n.id} href={topicHref(locale, n.id)} tabIndex={-1} data-map-node={n.id} data-viewed={done ? '' : undefined}>
              <title>{n.title}</title>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} className={`fill-surface ${done ? 'stroke-primary' : 'stroke-border-strong'}`} strokeWidth={done ? 3 : 1.5} strokeDasharray={n.external ? '5 3' : undefined} />
              <text x={tx} y={n.y + 22} fontSize={13} fontWeight={600} textAnchor="start" direction={dir} className="fill-text">
                {n.shortTitle}
              </text>
              <text x={tx} y={n.y + 41} fontSize={11} textAnchor="start" direction={dir} className="fill-muted">
                {n.external ? n.categoryName : `${t(`topic.level.${n.level}`)} · ${t('topic.minutes', { n: n.minutes })}`}
              </text>
              {done ? (
                <text x={rtl ? n.x + 10 : n.x + n.w - 10} y={n.y + 20} fontSize={14} fontWeight={700} textAnchor={rtl ? 'start' : 'end'} className="fill-text">
                  ✓
                </text>
              ) : null}
            </a>
          );
        })}
      </svg>
    </div>
  );
}
