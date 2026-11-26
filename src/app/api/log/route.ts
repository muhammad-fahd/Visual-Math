import { z } from 'zod';
import { errorResponse, guarded, readBody } from '@/server/admin/http';
import { recordError } from '@/server/errorlog';
import { ratelimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

// First-party error reporting (AD-26): no third-party SDK, no IP, no cookie. The body is cut down
// by scrubLog before it is stored or printed.
const Body = z
  .object({
    message: z.string().max(2000),
    path: z.string().max(2000).optional(),
    detail: z.string().max(8000).optional(),
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    const limited = await ratelimit(request, { name: 'log', limit: 20, windowSeconds: 60 });
    if (limited) return limited;
    const body = await readBody(request, Body, { maxBytes: 49_152 });
    if (!body.ok) return body.response;
    const requestId = crypto.randomUUID();
    const stored = await recordError({ requestId, kind: 'client', path: body.data.path, message: body.data.message, detail: body.data.detail });
    if (!stored) return errorResponse(503, 'unavailable', 'Try again shortly.');
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  });
}
