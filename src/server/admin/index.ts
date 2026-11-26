import 'server-only';
import { notFound } from 'next/navigation';
import { adminClient } from '../../db/admin';
import { dbEnv } from '../../db/env';
import { authClient } from '../../db/auth';
import type { AdminDeps } from './ports';
import { checkAdmin, requireAdminResponse, type AdminContext } from './require-admin';
import { supabaseAuth, supabaseStore } from './supabase-adapters';

/** Real dependencies for this request. Unset environment gives adapters that deny everything. */
export async function adminDeps(): Promise<AdminDeps> {
  const admin = adminClient();
  return { auth: supabaseAuth(await authClient(), admin), store: supabaseStore(admin) };
}

/** False when the Supabase environment is not set; sign-in then reports it is unavailable. */
export function adminConfigured(): boolean {
  return dbEnv() !== null;
}

/** Admin pages: anything but an admin gets the not-available page and no data (AD-8). */
export async function requireAdminPage(): Promise<AdminContext> {
  const admin = await checkAdmin(await adminDeps());
  if (!admin) notFound();
  return admin;
}

/** Admin handlers: call first; returns the admin or the 401 Response to return as is. */
export async function requireAdmin(): Promise<AdminContext | Response> {
  return requireAdminResponse(await adminDeps());
}

export { AuditEntrySchema, AUDIT_ACTIONS, writeAudit } from '../audit';
export type { AdminContext } from './require-admin';
