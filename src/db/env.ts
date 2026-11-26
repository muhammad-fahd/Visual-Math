import 'server-only';
import { z } from 'zod';

// Typed, validated server environment (AD-24). Missing values mean "not configured":
// admin features then fail closed instead of crashing.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type DbEnv = z.infer<typeof schema>;

export function parseDbEnv(source: Record<string, string | undefined>): DbEnv | null {
  const parsed = schema.safeParse(source);
  return parsed.success ? parsed.data : null;
}

export function dbEnv(): DbEnv | null {
  return parseDbEnv(process.env);
}
