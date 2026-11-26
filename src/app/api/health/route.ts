import { checkHealth } from '@/server/health';
import { guarded } from '@/server/admin/http';
import { ratelimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

// For an external uptime monitor (AD-26, AD-28). Public and read-only; it says whether the site and
// its database answer and nothing else: no versions, no hostnames, no error text.
export function GET(request: Request): Promise<Response> {
  return guarded(async () => {
    const limited = await ratelimit(request, { name: 'health', limit: 60, windowSeconds: 60 });
    if (limited) return limited;
    const health = await checkHealth();
    return Response.json(health.body, { status: health.status, headers: { 'Cache-Control': 'no-store' } });
  });
}
