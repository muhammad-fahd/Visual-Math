import { z } from 'zod';
import { adminDeps } from '@/server/admin';
import { recover } from '@/server/admin/auth-flow';
import { guarded, invalidResponse, lockedResponse, readBody, unauthorizedResponse } from '@/server/admin/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ code: z.string().min(1).max(64) }).strict();

export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    const body = await readBody(request, Body);
    if (!body.ok) return body.response;
    const result = await recover(await adminDeps(), body.data);
    if (result.status === 'denied') return unauthorizedResponse();
    if (result.status === 'locked') return lockedResponse(result.retryAfterSeconds);
    if (result.status === 'invalid') return invalidResponse();
    return Response.json({ next: result.next }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
