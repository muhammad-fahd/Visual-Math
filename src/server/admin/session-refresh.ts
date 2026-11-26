import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Server Components cannot write cookies, so an expired admin access token could never be refreshed
// there and the admin would land on the not-available page after about an hour. The proxy runs
// before the page and can: it asks Supabase to verify the claims (which refreshes the session when
// needed) and copies the new cookies onto the request and the response (AD-10, Story 1.4 follow-up).
// It decides nothing: authorization stays in requireAdmin().

export interface RefreshEnv {
  url: string | undefined;
  anonKey: string | undefined;
}

export async function refreshAdminSession(
  request: NextRequest,
  env: RefreshEnv = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  // Nothing to refresh without Supabase configured or without a session cookie: do no network call.
  if (!env.url || !env.anonKey || !request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) return response;

  // Supabase may call setAll more than once (a refresh, then a chunked cookie): keep all of them.
  const written = new Map<string, { value: string; options: Parameters<NextResponse['cookies']['set']>[2] }>();
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        for (const { name, value, options } of cookies) {
          request.cookies.set(name, value);
          written.set(name, { value, options });
        }
        response = NextResponse.next({ request });
        for (const [name, { value, options }] of written) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        response.headers.set('Cache-Control', 'private, no-store');
      },
    },
  });
  try {
    await supabase.auth.getClaims();
  } catch {
    // An unreachable Auth service must not break the page: requireAdmin() decides, and fails closed.
  }
  return response;
}
