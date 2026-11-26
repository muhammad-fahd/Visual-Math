import { z } from 'zod';
import type { AuditEntry } from '../admin/ports';

// The audit writer (FR-9.13, AD-17). Admin writes are Postgres functions that call record_audit()
// themselves, so the change and its row commit together. This validates and writes entries for
// events that are not a database change (sign-in, factor reset).

export const AuditEntrySchema = z.object({
  adminId: z.uuid(),
  action: z.string().regex(/^[a-z][a-z0-9_.]{0,63}$/),
  target: z.string().min(1).max(200),
});

export const AUDIT_ACTIONS = {
  signIn: 'admin.sign_in',
  mfaEnrolled: 'admin.mfa_enrolled',
  mfaReset: 'admin.mfa_reset',
} as const;

export interface AuditSink {
  recordAudit(entry: AuditEntry): Promise<void>;
}

/** Validates, then writes. A failure throws: an unlogged admin action must not look successful. */
export async function writeAudit(sink: AuditSink, entry: AuditEntry): Promise<void> {
  await sink.recordAudit(AuditEntrySchema.parse(entry));
}
