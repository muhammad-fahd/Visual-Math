import { z } from 'zod';
import { adminDeps } from '@/server/admin';
import { enrol } from '@/server/admin/auth-flow';
import { guarded, readBody, unauthorizedResponse } from '@/server/admin/http';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return guarded(async () => {
    const body = await readBody(request, z.object({}).strict());
    if (!body.ok) return body.response;
    const result = await enrol(await adminDeps());
    if (result.status !== 'ok') return unauthorizedResponse();
    return Response.json({ ...result.enrolment }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
