import { notFound } from 'next/navigation';
import { SolidViewer, type SolidTopic } from '../../../../features/scene';
import cone from '../../../../../content/fixtures/geo-cone-volume.json';
import section from '../../../../../content/fixtures/geo-cone-section.json';
import net from '../../../../../content/fixtures/geo-cylinder-net.json';
import fill from '../../../../../content/fixtures/geo-cylinder-fill.json';

// The solid viewer harness (Stories 2.4 and 2.5): the fixtures in the real viewer, for the browser
// tests, and nothing else. Like the frame harness it exists only when the server is started with
// VM_HARNESS=1; otherwise it is a 404. `?topic=` picks the fixture (cone, section, net or fill). The
// topic page (Story 2.6) will place the viewer for real.
export const dynamic = 'force-dynamic';

const TOPICS = { cone, section, net, fill } as const;

export default async function Harness({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VM_HARNESS !== '1') notFound();
  const { topic } = await searchParams;
  const chosen = typeof topic === 'string' && Object.hasOwn(TOPICS, topic) ? TOPICS[topic as keyof typeof TOPICS] : cone;
  return (
    <main className="mx-auto max-w-3xl p-4">
      <SolidViewer topic={chosen as unknown as SolidTopic} />
    </main>
  );
}
