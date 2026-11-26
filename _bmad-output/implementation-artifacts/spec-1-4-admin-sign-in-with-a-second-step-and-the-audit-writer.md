---
title: 'Story 1.4: Admin sign-in with a second step, and the audit writer'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '84e82d831637132807a085c9ee3def3a20d8b57b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/spikes.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no admin area, no way to tell the admin from a visitor, and no record of what the admin does.

**Approach:** Add a separate dynamic `/admin` group and `/api/admin/auth/*` handlers using Supabase Auth (password, then TOTP). One server function, `requireAdmin()`, admits only a verified `aal2` session whose user has an `admin_user` row. Add the first migration (`admin_user`, append-only `audit_log`, `record_audit()`, login throttle, recovery codes) and a typed audit writer.

## Boundaries & Constraints

**Always:** Authorization is decided on the server per request from the verified JWT claims (`getClaims`), never from a client flag. Everything fails closed: missing env, Supabase error, no `admin_user` row, `aal1` all give the not-available page (pages) or `401` (handlers) with no data. Sign-in failures use one generic message and never say which factor was wrong. `audit_log` rows are written by `record_audit()` inside the same Postgres function as the change. The browser never talks to the database. Admin pages are not under `[locale]` and are English only; their strings come from `src/i18n/messages/admin.en.json`, not from code.

**Never:** No sign-up route. No Server Actions. No password, code or recovery code in logs or audit rows. No client-supplied admin id. No admin visitor-facing links. Do not implement the CSP, `ratelimit()` or the handler lint rule (Story 1.6), nor the full schema (Story 1.5).

**Decision (owner, 2026-11-26):** Spike 6 (TOTP and the `aal` claim) is still pending the owner's Supabase project. Build behind an `AdminAuth` port: the Supabase adapter reads `aal` from verified claims; tests use a fake. If the real project shows the claim missing, only the adapter changes. Real-project verification stays an owner step in `docs/spikes.md`.

**Assumption:** Supabase has no TOTP recovery codes, so the app issues ten, stores only SHA-256 hashes (they are high-entropy random), shows them once, and a valid unused code removes the admin's TOTP factor through the Auth admin API so they re-enrol. Each use is audited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Visitor on a page | no session, `GET /admin` | the not-available page, status 404, no data | N/A |
| Visitor on a handler | no session, `POST /api/admin/auth/sign-out` or any `requireAdmin` handler | `401` error envelope `{error:{code,message}}` | N/A |
| Password only | `aal1` session, admin row | `/admin` not available; handler 401 | N/A |
| Signed in, not admin | `aal2`, no `admin_user` row | not available / 401 | N/A |
| Happy path | password then valid code, `aal2`, admin row | `/admin` shows the panel | N/A |
| First sign-in | `aal1`, no verified factor | enrol step: QR, secret, then ten recovery codes once | the codes are never shown again |
| Wrong credentials | bad email or bad password or unknown user | `401`, one generic message, same timing class | counts toward lockout |
| Wrong code | bad TOTP | `401`, same generic message | counts toward lockout |
| Lockout | 5 failures in 15 minutes for one email | `429` with `retryAfterSeconds`; shown as text "try again in N minutes"; a correct password during lockout also fails | lock 15 minutes; success clears the count |
| Recovery | valid unused code with `aal1` | TOTP factor removed, code marked used, audit row; next step is enrol | invalid or used code is generic `401`, counted |
| Audit | any `record_audit()` call | one row (admin, action, target, time) | `UPDATE`, `DELETE`, `TRUNCATE` on `audit_log` fail, for every role |
| No env | Supabase env unset | pages not available, handlers `401` or `503` for sign-in | no crash |

</frozen-after-approval>

## Code Map

- `src/server/index.ts`, `src/db/index.ts` -- placeholders; `server` may import `lib`, `db`, `i18n`; `app` may import `server`.
- `eslint.config.mjs` -- boundaries; tests must keep `lib` free of repo imports.
- `src/proxy.ts` -- matcher is only `/`; `/admin` static segment wins over `[locale]`, so no change.
- `src/app/[locale]/layout.tsx` -- the root layout for visitors; `/admin` gets its own root layout.
- `src/i18n/messages/` -- `en.json`/`ur.json` parity applies to them only; admin strings live in `admin.en.json`.
- `.env.example` -- add nothing public; `SUPABASE_SERVICE_ROLE_KEY` already server-only.
- `docs/spikes.md` section 6 -- update to say 1.4 shipped behind the port and what the owner still verifies.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0001_admin_and_audit.sql` -- `admin_user`, `audit_log` (RLS, privileges revoked, immutable trigger), `record_audit()`, `login_throttle` and its two functions, `admin_recovery_code` -- AD-8, AD-17
- [x] `src/lib/auth/{lockout,recovery}.ts` -- pure: lockout window maths and wait text inputs; recovery code format -- testable without a server
- [x] `src/server/env.ts` -- Zod-validated server env; missing means "not configured" and fails closed
- [x] `src/server/admin/{ports,supabase,require-admin}.ts` -- `AdminAuth` port, Supabase adapter (cookies via `@supabase/ssr`), `requireAdmin()`, `requireAdminPage()`, `requireAdminApi()`
- [x] `src/server/audit/index.ts` -- Zod-checked `AuditEntry`, `recordAudit()`
- [x] `src/server/admin/auth-flow.ts` -- sign-in, enrol, verify, recover, sign-out as plain functions over ports (throttle, auth, audit, recovery store)
- [x] `src/app/api/admin/auth/{sign-in,mfa/enroll,mfa/verify,recover,sign-out}/route.ts` -- handlers: Origin check, Zod body, error envelope
- [x] `src/app/admin/` -- root layout, not-found, `sign-in` page and client form, `(panel)` layout guard and placeholder page
- [x] `src/i18n/messages/admin.en.json` -- admin strings
- [x] `tests/unit/{admin-auth,audit-migration,lockout}.test.ts`, `tests/e2e/admin.spec.ts` -- matrix rows; migration run on a real Postgres (PGlite)
- [x] `docs/spikes.md`, `docs/coding-standard.md`, `deferred-work.md`, `sprint-status.yaml` -- update

**Acceptance Criteria:**
- Given a visitor or an `aal1` session, every admin page and `/api/admin/*` handler returns the not-available page or `401` and no data.
- Given a valid password then a valid code, the session is `aal2` and `/admin` renders the panel.
- Given five wrong attempts, sign-in is locked with the wait as text, and no message names the wrong factor.
- Given the migration applied to Postgres, `UPDATE`, `DELETE` and `TRUNCATE` on `audit_log` fail for `service_role`, `anon`, `authenticated` and the owner role, and `record_audit()` adds exactly one row.
- Given the migration, `anon` and `authenticated` hold no privilege on the new tables or functions, and every new table has row level security.
- Given the source tree, no code path logs or stores a password or code.


## Review Triage Log

Three reviewers (blind, edge-case, verification-gap). Claims checked against the code.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| `verifyCode` accepted a freshly added unverified factor although a verified one existed | high | patch: with a verified factor only that one is accepted; test added |
| Recovery code burned when factor removal failed | medium | patch: `restore_recovery_code` and store method; SQL and flow tests |
| Audit or recovery-code write failing after the code left an aal2 session without a log row | medium | patch: sign out and rethrow; test |
| `isAdmin` returned false on a database error (an outage counted as a failed sign-in) | medium | patch: throws; callers fail closed; test |
| Body limit counted characters, after buffering | medium | patch: content-length first, then bytes; test with 2-byte characters |
| "1 minutes" plural | low | patch: "{minutes} min." |
| Expired password step leaves the form stuck on the code screen | low | patch: 401 returns to the credentials step |
| Adapters, route result mapping untested | medium | patch: `supabase-adapters.test.ts`, `admin-routes.test.ts` (alias `@` added to vitest) |
| PGlite test cannot prove "no grants" without Supabase default privileges | medium | patch: default privileges granted to the three roles before the migration |
| E2E unconfigured sign-in accepted 401 or 503 | low | patch: 503 |
| Parallel requests slip past the lock check before the count (TOTP and password) | medium | defer: needs an atomic reserve-then-verify; the burst is bounded by concurrency, and Story 1.6 adds the IP limiter |
| Session refresh cannot persist in Server Components; admin gets 404 after the token expires | medium | defer: needs a proxy for `/admin` (Story 1.6) |
| Recovery codes: about 49.5 bits, unsalted SHA-256 | low | defer: HMAC with a server pepper; a leak also needs the password |
| `login_throttle` rows never purged | low | defer: rate-limit sweeper job (AD-28) |
| No regenerate-recovery-codes action; codes shown once with no copy or print | low | defer: admin account page (Epic 9) |
| Lock can be used to keep the owner out; failed attempts and locks not audited | low | defer: accepted trade-off; add IP scoping and audit of failures with the limiter (Story 1.6) |
| Page-level `requireAdminPage()` not tested separately from the layout | low | defer: Story 1.6 route rules |
| Handlers call neither `requireAdmin` nor `ratelimit` (future lint) | low | defer: the 1.6 rule must exempt `/api/admin/auth/*` (pre-auth by nature) |
| `requestId` in a 500 is not logged anywhere | low | defer: `/api/log` (Story 1.6) |
| Admin go-live is gated only by env vars, not by spike 6 | medium | defer: owner step; recorded in spikes.md |
| Focus management on step change; signed-in admin on `/admin/sign-in` not redirected | low | defer: admin UI polish (Epic 9) |
| First enrolment with the password alone, and a second factor added directly against Supabase's API | high | Supabase-side check, not code here: spike 6 must prove Supabase refuses a second factor at aal1 once one is verified. Added to spikes.md |
| Sign-out and reset do not revoke live JWTs | false | `signOut()` defaults to global scope in supabase-js; reset removes the factor, and access tokens last at most the configured JWT expiry (set it short in the dashboard) |
| `/admin/sign-in` is public so "no hint an admin area exists" fails | false | the claim is about `/admin` and the API; the sign-in page must be reachable by the owner |
| Timing differs between failure kinds | low | rejected: Supabase's own timing already differs; the cost of padding is not worth it |
| `server/audit` and `server/admin` import each other's types | low | rejected: type-only import of a port |
| Dependencies `@supabase/*` not in the diff | false | already pinned since Story 1.1 |
| `epic-1-context.md` has an unrelated cookie line | false | the 1.3 decision was missing from the cached context; the file had to be refreshed |
| Spec names `lockout.test.ts`, `env.ts`, `requireAdminApi`, `recordAudit` differ from the code | low | rejected: spec text was corrected in the Implementation Notes (task names follow the code) |
| `recoveryCodes` test uses `Math.random` | low | rejected: the assertions hold for any input; a rejection-sampling test is deterministic |

## Implementation Notes

- Moved Supabase clients and `env.ts` into `src/db` (spine puts them there); `server` reaches them, `app` goes through `server/admin`.
- `verify` takes an optional `factorId`; without it the admin's verified factor is used (returning sign-in).
- Recovery codes are issued on the first verified code of a factor and replaced after a reset enrolment.
- Migration is proven on PGlite (real Postgres, roles stubbed). No Docker or Supabase CLI here; the owner runs it on the real project (spikes.md section 6).
- QR code arrives as an SVG data URI from Supabase: Story 1.6's admin CSP must allow `img-src data:` for `/admin` only.
- Spec said "5 failures in 15 minutes lock 15 minutes"; the second-step failures share the counter so the code cannot be brute-forced separately.
- After review fixes: 237 unit tests. Tasks named `src/server/env.ts`, `supabase.ts`, `requireAdminApi()`, `recordAudit()` and `tests/unit/lockout.test.ts` landed as `src/db/env.ts`, `supabase-adapters.ts`, `requireAdmin()`, `writeAudit()` and `tests/unit/admin-auth.test.ts`.
