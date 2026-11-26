import 'server-only';
import { adminClient } from '../db/admin';
import { scrubDetail, scrubMessage, scrubPath } from '../lib/security/scrub';

export interface LogInput {
  requestId: string;
  kind: 'client' | 'server';
  path: unknown;
  message: unknown;
  detail?: unknown;
}

export type ScrubbedLog = { requestId: string; kind: 'client' | 'server'; path: string; message: string; detail: string | null };

/** The exact values that are stored and printed: nothing else from the request ever reaches the log. */
export function scrubLog(input: LogInput): ScrubbedLog {
  return {
    requestId: input.requestId,
    kind: input.kind,
    path: scrubPath(input.path),
    message: scrubMessage(input.message) || '(no message)',
    detail: scrubDetail(input.detail),
  };
}

/** Writes one scrubbed error to the database (when configured) and to Vercel's logs as structured JSON. */
export async function recordError(input: LogInput): Promise<boolean> {
  const entry = scrubLog(input);
  console.error(JSON.stringify({ level: 'error', ...entry }));
  const client = adminClient();
  if (!client) return true; // nothing to store into yet; the structured line above is the record
  const { error } = await client.rpc('log_error', {
    p_request_id: entry.requestId,
    p_kind: entry.kind,
    p_path: entry.path,
    p_message: entry.message,
    p_detail: entry.detail,
  });
  return !error;
}
