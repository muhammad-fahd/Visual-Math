import 'server-only';
import { adminClient } from '../db/admin';
import { isTopicId } from '../lib/library';
import type { Topic } from '../lib/topic-schema';

// `loadTopic(id)` (Story 5.4, AD-19): the one place the document of a topic is read for a visitor, so a version 2
// gate (a device count, a signed delivery) has a single place to attach. Only a published, not deleted topic comes
// back (FR-1.9): from the database's published version through `published_topic()` (migration 0007), from the fixtures
// under the harness (VM_HARNESS=1), and null with neither. The document was validated when it was uploaded; here it is
// only checked to be the document asked for. A database that fails is an error, never a silent "not found".

const looksLikeTopic = (doc: unknown, id: string): doc is Topic =>
  typeof doc === 'object' && doc !== null && (doc as { id?: unknown }).id === id && Array.isArray((doc as { steps?: unknown }).steps) && typeof (doc as { scene?: unknown }).scene === 'object';

export async function loadTopic(id: string): Promise<Topic | null> {
  if (!isTopicId(id)) return null;
  if (process.env['VM_HARNESS'] === '1') {
    const { fixtureTopic } = await import('./fixture-catalog');
    const doc = fixtureTopic(id);
    return looksLikeTopic(doc, id) ? doc : null;
  }
  const client = adminClient();
  if (!client) return null;
  const { data, error } = await client.rpc('published_topic', { p_id: id });
  if (error) throw new Error('published_topic failed');
  return looksLikeTopic(data, id) ? data : null;
}
