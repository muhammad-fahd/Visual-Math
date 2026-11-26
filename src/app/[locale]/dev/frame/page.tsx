import { notFound } from 'next/navigation';
import { FrameHarness } from '../../../../features/dev/FrameHarness';

// The scene frame harness (Story 2.3): a page for the browser tests, and nothing else. It exists only
// when the server is started with VM_HARNESS=1; in production that variable is never set, so this
// is a 404. It is dynamic on purpose: the decision is made per request, not baked in at build time.
export const dynamic = 'force-dynamic';

export default async function Harness({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VM_HARNESS !== '1') notFound();
  const params = await searchParams;
  const mode = params['mode'] === '2d' || params['mode'] === 'zoom' ? params['mode'] : '3d';
  return (
    <FrameHarness
      mode={mode}
      describe={params['desc'] !== '0'}
      topic={{
        title: 'Harness solid',
        caption: 'A square that turns, scales and moves.',
        description: 'A plain square drawn only to test the scene frame. It has no meaning.',
        toggle: 'Wireframe',
      }}
    />
  );
}
