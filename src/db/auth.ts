import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { dbEnv } from './env';

// The anon-key client bound to the request's cookies. Used only for the admin's own session
// (sign-in, second step, reading verified claims); it never reads a table (AD-8).
export async function authClient(): Promise<SupabaseClient | null> {
  const env = dbEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the handlers that matter can.
        }
      },
    },
  });
}
