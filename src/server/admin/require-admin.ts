import type { AdminDeps } from './ports';

export interface AdminContext {
  adminId: string;
  email: string;
}

/**
 * The one authorization check (AD-8): a verified aal2 session AND a row in admin_user, decided on
 * the server for every request. Anything else, including any error, is "not an admin".
 */
export async function checkAdmin({ auth, store }: AdminDeps): Promise<AdminContext | null> {
  try {
    const session = await auth.session();
    if (!session || session.aal !== 'aal2') return null;
    if (!(await store.isAdmin(session.userId))) return null;
    return { adminId: session.userId, email: session.email };
  } catch {
    return null;
  }
}

/** A 401 in the error envelope of AD-9; says nothing about why. */
export function unauthorized(): Response {
  return Response.json(
    { error: { code: 'unauthorized', message: 'Sign-in required.' } },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function requireAdminResponse(deps: AdminDeps): Promise<AdminContext | Response> {
  return (await checkAdmin(deps)) ?? unauthorized();
}
