import { createHash } from 'node:crypto';
import { errorResponse, guarded, readBody } from '@/server/admin/http';
import { ratelimit } from '@/server/ratelimit';
import { saveReport } from '@/server/reports';
import { checkNote, cleanNote } from '@/lib/report';
import { reportBody } from '@/lib/report/schema';

export const dynamic = 'force-dynamic';

// Report a problem (FR-2.4, AD-26): public, no login, no cookie. Limited first; the body is strict; the note
// is cleaned here, never trusted from the browser. Only the topic id, the reason and the note are stored.
export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    // Slow a sender down overall, and slow the same sender down more for one topic.
    const limited = await ratelimit(request, { name: 'report', limit: 6, windowSeconds: 600 });
    if (limited) return limited;
    const body = await readBody(request, reportBody, { maxBytes: 8192 });
    if (!body.ok) return body.response;

    // A refused note must not use up the quota for the retry, so it is checked before the topic's limit.
    const note = cleanNote(body.data.note);
    const problem = checkNote(body.data.reason, note);
    if (problem === 'too-long') return errorResponse(400, 'note_too_long', 'The note is too long.');
    if (problem === 'required') return errorResponse(400, 'note_required', 'Please write a short note.');

    // The topic id is hashed into the limiter's name: ids are up to 64 characters and names are short.
    const topicKey = createHash('sha256').update(body.data.topicId).digest('hex').slice(0, 24);
    const limitedForTopic = await ratelimit(request, { name: `report-${topicKey}`, limit: 2, windowSeconds: 600 });
    if (limitedForTopic) return limitedForTopic;

    const stored = await saveReport({ topicId: body.data.topicId, reason: body.data.reason, note });
    if (!stored) return errorResponse(503, 'unavailable', 'Try again shortly.');
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  });
}
