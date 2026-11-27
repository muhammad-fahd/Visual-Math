import { notFound } from 'next/navigation';
import type { Topic } from '../../../../lib/topic-schema';
import { TopicPage } from '../../../../features/topic';
import cone from '../../../../../content/fixtures/geo-cone-volume.json';
import section from '../../../../../content/fixtures/geo-cone-section.json';
import net from '../../../../../content/fixtures/geo-cylinder-net.json';
import fill from '../../../../../content/fixtures/geo-cylinder-fill.json';
import graph from '../../../../../content/fixtures/alg-quadratic-graph.json';
import triangle from '../../../../../content/fixtures/geo-triangle-transform.json';
import fractions from '../../../../../content/fixtures/num-equivalent-fractions.json';
import balance from '../../../../../content/fixtures/alg-balance-scale.json';
import solver from '../../../../../content/fixtures/alg-solve-steps.json';
import circle from '../../../../../content/fixtures/trig-unit-circle.json';
import triangle3 from '../../../../../content/fixtures/trig-right-triangle.json';

// The topic page harness (Story 2.6): a fixture shown by the real page component, for the browser tests,
// and nothing else. Like the other harnesses it exists only when the server is started with VM_HARNESS=1.
// `?topic=` picks the fixture; the neighbours are the other fixtures. Real routes come with Epics 5 and 7.
export const dynamic = 'force-dynamic';

const TOPICS = { cone, section, net, fill, graph, triangle, fractions, balance, solver, circle, triangle3 } as const;
type Key = keyof typeof TOPICS;
const ORDER: Key[] = ['cone', 'section', 'net', 'fill', 'graph', 'triangle', 'fractions', 'balance', 'solver', 'circle', 'triangle3'];

export default async function Harness({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VM_HARNESS !== '1') notFound();
  const { locale } = await params;
  const { topic, bare } = await searchParams;
  const key: Key = typeof topic === 'string' && Object.hasOwn(TOPICS, topic) ? (topic as Key) : 'cone';
  const at = ORDER.indexOf(key);
  const neighbour = (k: Key | undefined) => (k ? { title: TOPICS[k].title, href: `/${locale}/dev/topic?topic=${k}` } : undefined);
  return (
    <TopicPage
      topic={TOPICS[key] as unknown as Topic}
      previous={bare === '1' ? undefined : neighbour(ORDER[at - 1])}
      next={bare === '1' ? undefined : neighbour(ORDER[at + 1])}
    />
  );
}
