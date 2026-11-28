import { categoryNode, chapterNode, linkedTopics, loc, readingOrder } from '../library';
import { plainText } from '../text';
import type { Catalog, CatalogTopic, Level } from '../topic-schema/catalog';

// The learning map of one category (Story 5.5, FR-1.7). Pure and deterministic: the catalog in, a drawable layout and
// the same map as a list out. Chapters are rows; a topic's column is one more than its deepest prerequisite in the
// category, so an arrow always runs from a prerequisite to the topics that need it, left to right. Topics of other
// categories that are prerequisites of, or need, a topic here are outside nodes in a last row. A prerequisite that is
// not published is not in the catalog, so it is never drawn or listed (FR-1.9). A cycle cannot loop: the edge that
// closes it is ignored when columns are counted.

export const NODE_W = 176;
export const NODE_H = 56;
const GAP_X = 56;
const GAP_Y = 14;
const PAD = 16;
const LANE_TITLE_H = 26;
const LANE_PAD = 10;
const TITLE_CHARS = 22;

export interface MapNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  shortTitle: string;
  level: Level;
  minutes: number;
  /** A topic of another category. */
  external: boolean;
  /** The name of its category, for an outside node. */
  categoryName?: string;
}

export interface MapEdge {
  from: string;
  to: string;
  d: string;
}

export interface MapLane {
  name: string;
  y: number;
  h: number;
  external: boolean;
}

export interface MapRef {
  id: string;
  title: string;
  /** The category name, when the topic is in another category. */
  categoryName?: string;
}

export interface MapListTopic {
  id: string;
  title: string;
  level: Level;
  minutes: number;
  needs: MapRef[];
  leads: MapRef[];
}

export interface MapLayout {
  width: number;
  height: number;
  lanes: MapLane[];
  nodes: MapNode[];
  edges: MapEdge[];
  /** The same map as text: one group per chapter, then the outside topics. */
  list: { name: string; external: boolean; topics: MapListTopic[] }[];
}

const short = (title: string): string => {
  const chars = Array.from(title);
  return chars.length <= TITLE_CHARS ? title : `${chars.slice(0, TITLE_CHARS - 1).join('')}…`;
};

export function layoutMap(catalog: Catalog, category: string, locale: string): MapLayout {
  const all = readingOrder(catalog);
  const own = all.filter((t) => t.path.category === category);
  const ownIds = new Set(own.map((t) => t.id));
  const byId = new Map(all.map((t) => [t.id, t]));
  const title = (t: CatalogTopic) => plainText(loc(t.title, locale));
  const categoryName = (t: CatalogTopic) => {
    const n = categoryNode(catalog, t.path.category);
    return n ? loc(n.name, locale) : t.path.category;
  };

  // Edges: prerequisite to dependent, for every topic here and every outside topic that touches one here.
  const needs = new Map<string, string[]>();
  const leads = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    if (!needs.has(to)) needs.set(to, []);
    if (!leads.has(from)) leads.set(from, []);
    if (!needs.get(to)!.includes(from)) needs.get(to)!.push(from);
    if (!leads.get(from)!.includes(to)) leads.get(from)!.push(to);
  };
  for (const t of all) {
    for (const p of linkedTopics(catalog, t.prerequisites, t.id)) if (ownIds.has(t.id) || ownIds.has(p.id)) add(p.id, t.id);
  }

  // Columns inside the category: one more than the deepest prerequisite here; a cycle's closing edge is skipped.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const columnOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    visiting.add(id);
    let d = 0;
    for (const p of needs.get(id) ?? []) if (ownIds.has(p) && !visiting.has(p)) d = Math.max(d, columnOf(p) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const t of own) columnOf(t.id);

  // Outside nodes: left of the first topic that needs them, or right of the deepest topic they need.
  const externals = [...new Set([...needs.keys(), ...leads.keys()])].filter((id) => !ownIds.has(id) && byId.has(id)).sort((a, b) => all.indexOf(byId.get(a)!) - all.indexOf(byId.get(b)!));
  const extColumn = (id: string): number => {
    const dependents = (leads.get(id) ?? []).filter((x) => ownIds.has(x));
    if (dependents.length > 0) return Math.min(...dependents.map((x) => depth.get(x)!)) - 1;
    const sources = (needs.get(id) ?? []).filter((x) => ownIds.has(x));
    return sources.length > 0 ? Math.max(...sources.map((x) => depth.get(x)!)) + 1 : 0;
  };

  // Rows: the chapters that have topics, in tree order; the outside row last.
  type Lane = { key: string; name: string; external: boolean; members: CatalogTopic[] };
  const lanes: Lane[] = [];
  for (const t of own) {
    let lane = lanes.find((l) => l.key === t.path.chapter);
    if (!lane) {
      const n = chapterNode(catalog, t.path.category, t.path.subcategory, t.path.chapter);
      lane = { key: t.path.chapter, name: n ? loc(n.name, locale) : t.path.chapter, external: false, members: [] };
      lanes.push(lane);
    }
    lane.members.push(t);
  }
  if (externals.length > 0) lanes.push({ key: '\u0000outside', name: '', external: true, members: externals.map((id) => byId.get(id)!) });

  // An outside prerequisite of a first-column topic would sit in column -1: shift everything one column right instead, so
  // every arrow runs left to right.
  const shift = externals.some((id) => extColumn(id) < 0) ? 1 : 0;
  const column = (lane: Lane, t: CatalogTopic) => (lane.external ? extColumn(t.id) : depth.get(t.id)!) + shift;
  const nodes: MapNode[] = [];
  const laneBoxes: MapLane[] = [];
  let top = PAD;
  let maxCol = 0;
  for (const lane of lanes) {
    const slots = new Map<number, number>();
    let rows = 1;
    for (const t of lane.members) {
      const col = column(lane, t);
      const slot = slots.get(col) ?? 0;
      slots.set(col, slot + 1);
      rows = Math.max(rows, slot + 1);
      maxCol = Math.max(maxCol, col);
      nodes.push({
        id: t.id,
        x: PAD + col * (NODE_W + GAP_X),
        y: top + LANE_TITLE_H + slot * (NODE_H + GAP_Y),
        w: NODE_W,
        h: NODE_H,
        title: title(t),
        shortTitle: short(title(t)),
        level: t.level,
        minutes: t.estimatedMinutes,
        external: lane.external,
        categoryName: lane.external ? categoryName(t) : undefined,
      });
    }
    const h = LANE_TITLE_H + rows * NODE_H + (rows - 1) * GAP_Y + LANE_PAD;
    laneBoxes.push({ name: lane.name, y: top, h, external: lane.external });
    top += h + LANE_PAD;
  }

  const at = new Map(nodes.map((n) => [n.id, n]));
  const edges: MapEdge[] = [];
  for (const [to, froms] of needs) {
    for (const from of froms) {
      const a = at.get(from);
      const b = at.get(to);
      if (!a || !b) continue;
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const dx = Math.max(24, Math.abs(x2 - x1) / 2);
      edges.push({ from, to, d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` });
    }
  }
  edges.sort((p, q) => (p.from < q.from ? -1 : p.from > q.from ? 1 : p.to < q.to ? -1 : p.to > q.to ? 1 : 0));

  const ref = (id: string): MapRef => {
    const t = byId.get(id)!;
    return { id, title: title(t), categoryName: ownIds.has(id) ? undefined : categoryName(t) };
  };
  const listOf = (t: CatalogTopic): MapListTopic => ({
    id: t.id,
    title: title(t),
    level: t.level,
    minutes: t.estimatedMinutes,
    needs: (needs.get(t.id) ?? []).filter((id) => byId.has(id)).map(ref),
    leads: (leads.get(t.id) ?? []).filter((id) => byId.has(id)).map(ref),
  });
  const list = lanes.filter((l) => !l.external).map((l) => ({ name: l.name, external: false, topics: l.members.map(listOf) }));

  return { width: PAD * 2 + (maxCol + 1) * (NODE_W + GAP_X) - GAP_X, height: top, lanes: laneBoxes, nodes, edges, list };
}

export interface MapData {
  /** Categories that have topics, in tree order. */
  categories: { id: string; name: string; count: number }[];
  layouts: Record<string, MapLayout>;
}

export function buildMapData(catalog: Catalog, locale: string): MapData {
  const categories = catalog.tree
    .filter((n) => n.subcategory === null && n.count > 0)
    .map((n) => ({ id: n.category, name: loc(n.name, locale), count: n.count }));
  return { categories, layouts: Object.fromEntries(categories.map((c) => [c.id, layoutMap(catalog, c.id, locale)])) };
}
