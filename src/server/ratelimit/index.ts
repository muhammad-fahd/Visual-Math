import 'server-only';
import { adminClient } from '../../db/admin';
import { dbEnv } from '../../db/env';
import { applyRateLimit, type RateRule, type RateStore } from './core';

export type { RateRule } from './core';

function postgresStore(): RateStore | null {
  const client = adminClient();
  if (!client) return null;
  return {
    async hit(key, limit, windowSeconds) {
      const { data, error } = await client.rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
      const row = Array.isArray(data) ? (data[0] as { allowed?: boolean; retry_after?: number } | undefined) : undefined;
      if (error || !row || typeof row.allowed !== 'boolean') throw new Error('rate_limit_hit failed');
      return { allowed: row.allowed, retryAfter: row.retry_after ?? 1 };
    },
  };
}

/**
 * Call at the top of every public handler (a handler without this or requireAdmin() fails lint).
 * Returns a Response to send back, or null to carry on:
 *
 *   const limited = await ratelimit(request, { name: 'log', limit: 20, windowSeconds: 60 });
 *   if (limited) return limited;
 */
export async function ratelimit(request: Request, rule: RateRule): Promise<Response | null> {
  // On Vercel (VERCEL_ENV is set) a missing database configuration must not switch the limiter off.
  return applyRateLimit(
    { store: postgresStore(), secret: dbEnv()?.SUPABASE_SERVICE_ROLE_KEY ?? null, requireStore: Boolean(process.env.VERCEL_ENV) },
    request,
    rule,
  );
}
