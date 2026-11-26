import 'server-only';
import { z } from 'zod';

// Typed, validated server environment (AD-24). Missing or inconsistent values mean "not configured":
// admin features then fail closed instead of crashing.
//
// APP_ENV and the schema must agree: production and development use `public`; a preview deployment
// uses a throwaway schema named `preview_*` and can never be pointed at `public`. Which Supabase
// key a deployment holds is scoped in Vercel (docs/environments.md): code cannot tell.
const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
    SUPABASE_DB_SCHEMA: z.string().default('public'),
    // Set by Vercel itself. When present it must agree with APP_ENV, so a preview that forgot APP_ENV fails closed.
    VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  })
  .superRefine((env, ctx) => {
    const preview = env.APP_ENV === 'preview';
    const ok = preview ? /^preview_[a-z0-9_]{1,55}$/.test(env.SUPABASE_DB_SCHEMA) : env.SUPABASE_DB_SCHEMA === 'public';
    if (!ok) ctx.addIssue({ code: 'custom', path: ['SUPABASE_DB_SCHEMA'], message: 'schema does not match APP_ENV' });
    if (env.VERCEL_ENV && env.VERCEL_ENV !== env.APP_ENV) ctx.addIssue({ code: 'custom', path: ['APP_ENV'], message: 'APP_ENV does not match the platform environment' });
  });

export type DbEnv = z.infer<typeof schema>;

export function parseDbEnv(source: Record<string, string | undefined>): DbEnv | null {
  // An empty string means "unset" (an .env file with a blank value).
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(cleaned);
  return parsed.success ? parsed.data : null;
}

export function dbEnv(): DbEnv | null {
  return parseDbEnv(process.env);
}
