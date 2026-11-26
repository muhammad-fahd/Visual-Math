import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dbEnv } from './env';

// The service-role client: server only, reaches the database and the Auth admin API (AD-8, AD-9).
export function adminClient(): SupabaseClient | null {
  const env = dbEnv();
  if (!env) return null;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: env.SUPABASE_DB_SCHEMA },
  });
  // The schema is chosen at run time (public, or preview_* in a preview), so it cannot be a type parameter.
  return client as unknown as SupabaseClient;
}
