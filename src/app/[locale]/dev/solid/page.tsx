import { notFound } from 'next/navigation';
import { SolidViewer, type SolidTopic } from '../../../../features/scene';
import cone from '../../../../../content/fixtures/geo-cone-volume.json';

// The solid viewer harness (Story 2.4): the cone fixture in the real viewer, for the browser tests, and
// nothing else. Like the frame harness it exists only when the server is started with VM_HARNESS=1;
// otherwise it is a 404. The topic page (Story 2.6) will place the viewer for real.
export const dynamic = 'force-dynamic';

export default function Harness() {
  if (process.env.VM_HARNESS !== '1') notFound();
  return (
    <main className="mx-auto max-w-3xl p-4">
      <SolidViewer topic={cone as unknown as SolidTopic} />
    </main>
  );
}
