import { z } from 'zod';
import { adminDeps } from '@/server/admin';
import { guarded, readBody, unauthorizedResponse } from '@/server/admin/http';
import { ratelimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    const limited = await ratelimit(request, { name: 'sign-out', limit: 30, windowSeconds: 900 });
    if (limited) return limited;
    const body = await readBody(request, z.object({}).strict());
    if (!body.ok) return body.response;
    const { auth } = await adminDeps();
    if (!(await auth.session())) return unauthorizedResponse();
    await auth.signOut();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
