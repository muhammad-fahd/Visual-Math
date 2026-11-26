import { z } from 'zod';
import { adminConfigured, adminDeps } from '@/server/admin';
import { signIn } from '@/server/admin/auth-flow';
import { errorResponse, guarded, invalidResponse, lockedResponse, readBody } from '@/server/admin/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().max(254), password: z.string().min(1).max(256) }).strict();

export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    const body = await readBody(request, Body);
    if (!body.ok) return body.response;
    if (!adminConfigured()) return errorResponse(503, 'unavailable', 'Sign-in is not available.');
    const result = await signIn(await adminDeps(), body.data);
    if (result.status === 'locked') return lockedResponse(result.retryAfterSeconds);
    if (result.status === 'invalid') return invalidResponse();
    return Response.json({ next: result.next }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
