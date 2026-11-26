import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dbEnv } from './env';

// The service-role client: server only, reaches the database and the Auth admin API (AD-8, AD-9).
export function adminClient(): SupabaseClient | null {
  const env = dbEnv();
  if (!env) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
