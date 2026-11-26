import { z } from 'zod';
import { adminDeps } from '@/server/admin';
import { verifyCode } from '@/server/admin/auth-flow';
import { guarded, invalidResponse, lockedResponse, readBody, unauthorizedResponse } from '@/server/admin/http';
import { ratelimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

const Body = z.object({ factorId: z.string().min(1).max(64).optional(), code: z.string().regex(/^\d{6}$/) }).strict();

export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    const limited = await ratelimit(request, { name: 'mfa-verify', limit: 10, windowSeconds: 900 });
    if (limited) return limited;
    const body = await readBody(request, Body);
    if (!body.ok) return body.response;
    const result = await verifyCode(await adminDeps(), body.data);
    if (result.status === 'denied') return unauthorizedResponse();
    if (result.status === 'locked') return lockedResponse(result.retryAfterSeconds);
    if (result.status === 'invalid') return invalidResponse();
    return Response.json({ recoveryCodes: result.recoveryCodes ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
