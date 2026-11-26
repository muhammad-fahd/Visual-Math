---
title: 'Story 1.6: Security baseline'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '5151245562a1f5123f5dea75e53200e4c7ee22ab'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md'
  - '{project-root}/docs/spikes.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No security headers or CSP, no shared rate limiter, no health or error endpoint, no lint that stops an unguarded handler, no scan of the built bundle for secrets or `eval`, and the admin session cannot refresh.

**Approach:** Send a closed CSP and the standard security headers from `next.config.ts` (production only), build `ratelimit()` on a Postgres table and put it (or `requireAdmin()`) on every handler, enforced by a lint rule. Add `/api/health` and a scrubbed first-party `/api/log`, a bundle scanner in `npm run check`, a Playwright security spec, and a `proxy.ts` refresh for the admin session.

## Boundaries & Constraints

**Always:** Every other directive stays strict. Visitor pages: `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self'` plus the storage origin when set, `font-src 'self'`, `connect-src 'self'` plus the storage origin, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`. Admin pages add `img-src data:` (the QR code) and nothing else. HSTS in production. Handlers: Zod body, same-origin check on cookie routes, the AD-9 error envelope, database errors never forwarded. The rate-limit key is a salted, daily-rotating hash of the client address and a route name; no address is stored. `/api/log` keeps no IP, no cookie and no full URL query. The 30-day and 1-hour retention functions exist; the scheduler is not built.

**Never:** No `script-src` hash or nonce (a hash makes browsers ignore `unsafe-inline` and breaks hydration). No third-party script, font, analytics or error SDK. No CSP in `next dev` (React refresh needs `eval`). No client-side error reporter yet. Do not edit applied migrations: the new tables go in `0004`.

**Decision (owner, 2026-11-26):** Spike 3 resolved with `script-src 'self' 'unsafe-inline'`. AD-17 and Story 1.6's first criterion are amended: instead of "no inline script without a hash", Playwright asserts that every inline script is either the pre-paint script (exact text) or a Next framework script, and that no CSP violation or third-party request occurs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Headers | production response for `/en`, `/ur`, `/admin`, API | CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; admin adds `img-src data:` | N/A |
| Third party | any page load | no request leaves the origin; no CSP violation event | test fails |
| Inline scripts | any page | only the pre-paint script or a Next framework script | test fails on any other |
| Unguarded handler | route exports `POST` with neither `requireAdmin()` nor `ratelimit()` | lint error naming the handler | N/A |
| Rate limit | more than `limit` calls in the window from one address | `429` envelope with `Retry-After`; another address unaffected; window resets | limiter store down: `503`, never allowed through |
| Health | `GET /api/health` | `200 {status:"ok", db:"ok"}`, `no-store`; database down: `503 {db:"down"}`; unconfigured: `200`, `db:"unconfigured"` | no secrets, no error text |
| Log | valid `POST /api/log` | `204`; one `error_log` row with message cut to 500 chars, path without query or hash, emails and long tokens replaced | oversize `413`, bad shape `400`, cross-origin `403`, over limit `429` |
| Log privacy | body or headers carry an address or cookie | nothing of it is stored or logged | N/A |
| Bundle scan | client chunk contains a service-role key pattern, `eval(` or `new Function(` of our code | `npm run check` fails and names file and pattern | scan finds no `.next`: fail |
| HTTPS | `http://` request | redirected to `https://` (platform); HSTS sent over HTTPS | owner verifies on the live domain |
| Admin refresh | expired access token, valid refresh token, `/admin/*` | proxy refreshes cookies on the response; page sees the session | no env or no cookies: pass through untouched |

</frozen-after-approval>

## Code Map

- `next.config.ts` -- add `headers()`; imports the pure CSP builder.
- `src/proxy.ts` -- matcher `['/']` today; add `/admin/:path*` for the session refresh without touching the `/` redirect.
- `src/server/csp-hashes.ts` -- the pre-paint hash; stays for the theme test, no longer used in the CSP.
- `src/server/admin/http.ts` -- `guarded()`, `errorResponse`, `readBody`; reuse for `/api/log`; `guarded` should log the request id.
- `src/app/api/admin/auth/*/route.ts` -- five handlers: add `ratelimit()`; `tests/unit/admin-routes.test.ts` mocks `@/server/admin`: extend.
- `supabase/migrations/0002` -- the privilege pattern; `scripts/check-migrations.mjs` runs on every new migration.
- `eslint.config.mjs`, `eslint-rules/no-literal-text.mjs`, `tests/unit/lint-rules.test.ts` -- local rule and its failing-code test pattern.
- `tests/e2e/*.spec.ts`, `playwright.config.ts` (webServer `npm run start`: production build).
- AD-9, AD-17, AD-24, AD-26, AD-28; `docs/spikes.md` section 3.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0004_rate_limit_and_error_log.sql` -- `rate_limit`, `error_log`, atomic `rate_limit_hit()`, sweepers; RLS, service role only
- [x] `src/lib/security/{csp,scrub}.ts` -- CSP builder and the log scrubber (pure)
- [x] `src/server/ratelimit/index.ts`, `src/server/admin/http.ts` -- `ratelimit()`; `guarded` logs the request id
- [x] `src/app/api/{health,log}/route.ts`; add `ratelimit()` to the five auth handlers
- [x] `eslint-rules/require-handler-guard.mjs`, `eslint.config.mjs` -- the handler rule
- [x] `next.config.ts` -- security headers (production only)
- [x] `scripts/check-bundle.mjs` and `package.json` `check`
- [x] `src/server/admin/session-refresh.ts`, `src/proxy.ts` -- admin session refresh
- [x] `tests/unit/*`, `tests/e2e/security.spec.ts` -- matrix rows
- [x] Docs: AD-17 amendment, `epics.md` Story 1.6, `docs/spikes.md`, `docs/coding-standard.md`, `docs/environments.md`, `deferred-work.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given the CSP, Playwright fails on any third-party request, any CSP violation, and any inline script that is not the pre-paint script or a Next framework script.
- Given a handler without `requireAdmin()` or `ratelimit()`, lint fails.
- Given the built client bundle, a scan finds no service-role key and no `eval` or `new Function` from our code.
- Given `/api/health`, an external monitor can read it; given `/api/log`, a scrubbed error is stored with no IP.
- Given HTTPS, HSTS is sent and HTTP is redirected (platform), verified on the live domain by the owner.


## Review Triage Log

Three reviewers (blind, edge-case, verification-gap). Claims checked against the code.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| Limiter allowed everything when the store or secret was missing, even on a deployment | high | patch: on Vercel (`VERCEL_ENV` set) it answers 503; tests |
| Lint rule skipped `export { POST } from`, destructured exports, wrappers, other extensions and folders; a bare `await ratelimit()` passed | high | patch: all reported, the guard's result must be used, glob widened to `src/app/**/route.*`; tests |
| Real `ratelimit()` glue (RPC rows to allow or refuse) untested | medium | patch: `ratelimit-store.test.ts` |
| Per-route limits and order (limit before body and flow) untested | medium | patch: `admin-routes.test.ts` |
| Chunked body buffered whole before the size check | medium | patch: streamed with a cap; test |
| `/api/log` byte limit smaller than the schema allows for Urdu | medium | patch: 48 KiB; multi-byte test |
| `scrubPath` skipped the email and IP rules; no Eastern Arabic digits or Unicode emails; truncation split surrogate pairs | medium | patch: per-segment rules, Unicode classes, code-point cut; tests |
| Bundle scan missed `window.eval`, `Function(` without `new`, an eval alias, prerendered output; silent when the secret is not in the env | medium | patch: patterns, `.next/server/app` scanned, a note when only patterns were checked; tests |
| Health: `unconfigured` stays green on a deployment; query had no timeout | medium | patch: 503 on a deployment, 3 s timeout; `health.test.ts` |
| Session refresh kept only the last `setAll` call's cookies | medium | patch: all kept; test |
| Windows over an hour are cut short by the sweeper | low | patch: `rate_limit_hit` refuses more than 3600 s; test |
| HSTS two years with `includeSubDomains` is hard to undo | medium | patch: one year, no `includeSubDomains` until the domain is final; documented |
| Storage origin set but unusable fails silently | low | patch: build warns; documented |
| E2E: prefix match of inline scripts, `localhost` hardcoded, `img-src` exact, misleading title | low | patch: flight data must parse as JSON, origin from `baseURL`, regex, title fixed |
| Proxy matcher untested; `/administrators` test enshrined an accident | low | patch: matcher asserted, accident test removed |
| Spike 3 doc still said "My recommendation" | low | patch |
| Shared `unknown` bucket; spoofable `x-real-ip` and `x-forwarded-for` off Vercel | low | rejected: Vercel always sets `x-vercel-forwarded-for`, which comes first; off Vercel there is no limiter configured |
| UTC-day key lets a window straddle midnight | low | rejected: at most 2x of 10 attempts once a day; the per-account lockout (5) still holds |
| Service key reused as HMAC secret | low | rejected: documented in `docs/environments.md`; rotation only resets buckets |
| Sweepers and the 30-day purge not scheduled | medium | defer: the daily job is a later story (spec: scheduler not built); recorded |
| `/api/log` has no caller; `error_log` has no size cap | low | defer: client reporter and table cap with the observability story |
| `Cache-Control` set on admin pass-through | low | rejected: harmless, wanted |
| Query text after a space survives URL scrubbing | low | defer: message scrubbing is best effort; the table limits are the backstop |
| Refresh-token race on parallel admin requests | low | defer: skip prefetch requests if it shows up in use |
| `guarded()` logs only the error class | low | defer: add a scrubbed first frame with the logging story |
| `ratelimit` is "the only limiter" with no lint | low | defer: add a rule if a second limiter ever appears |
| Match by name, not import | low | rejected: stated in the rule header; a shadowing function is visible in review |
| Concurrency test of `for update` | low | rejected: the row lock is Postgres's guarantee; PGlite is single-connection |
| `npm run check` does not run e2e | low | rejected: unchanged since Story 1.1; CI runs them |

## Implementation Notes
- Final: 7 handlers (five admin auth, health, log) guarded; migration `0004`; CSP, HSTS and friends from `next.config.ts` in production only; bundle scan covers `.next/static` and `.next/server/app`.
- Admin proxy refresh is only exercised with a mocked Supabase client; real behaviour is part of spike 6.
- HSTS is `max-age=31536000` without `includeSubDomains` (owner can raise it once the domain is final).
