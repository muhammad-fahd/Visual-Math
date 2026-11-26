// The seams between admin logic and Supabase (spike 6 is behind these, decision 2026-11-26).
// Real adapters: ./supabase-adapters.ts. Tests use fakes.

export type Aal = 'aal1' | 'aal2';

/** The session as proven by verified JWT claims. */
export interface AdminSession {
  userId: string;
  email: string;
  aal: Aal;
}

export interface Factor {
  id: string;
  verified: boolean;
}

export interface Enrolment {
  factorId: string;
  qrCode: string; // an SVG data URI from Supabase Auth
  secret: string;
  uri: string;
}

export interface AdminAuth {
  /** Verified claims of the request's session, or null (none, expired, forged, or not configured). */
  session(): Promise<AdminSession | null>;
  signInWithPassword(email: string, password: string): Promise<boolean>;
  listFactors(): Promise<Factor[]>;
  removeUnverifiedFactors(): Promise<void>;
  enroll(): Promise<Enrolment | null>;
  /** Challenge and verify a code; on success the session becomes aal2. */
  verify(factorId: string, code: string): Promise<boolean>;
  /** Auth admin API: remove all of the user's TOTP factors (recovery). */
  removeAllFactors(userId: string): Promise<boolean>;
  signOut(): Promise<void>;
}

export interface AuditEntry {
  adminId: string;
  action: string;
  target: string;
}

export interface AdminStore {
  isAdmin(userId: string): Promise<boolean>;
  loginStatus(key: string): Promise<Date | null>;
  loginFailure(key: string): Promise<Date | null>;
  loginClear(key: string): Promise<void>;
  replaceRecoveryCodes(adminId: string, hashes: string[]): Promise<void>;
  consumeRecoveryCode(adminId: string, hash: string): Promise<boolean>;
  restoreRecoveryCode(adminId: string, hash: string): Promise<void>;
  recordAudit(entry: AuditEntry): Promise<void>;
}

export interface AdminDeps {
  auth: AdminAuth;
  store: AdminStore;
}
