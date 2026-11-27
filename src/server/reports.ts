import 'server-only';
import { adminClient } from '../db/admin';
import type { Reason } from '../lib/report';

/** Stores one cleaned report, or counts a repeat of an open one (the database decides). False if it could not. */
export async function saveReport(input: { topicId: string; reason: Reason; note: string }): Promise<boolean> {
  const client = adminClient();
  if (!client) return false; // nothing to store into: say so, never pretend
  const { error } = await client.rpc('report_problem', { p_topic_id: input.topicId, p_reason: input.reason, p_note: input.note });
  return !error;
}
