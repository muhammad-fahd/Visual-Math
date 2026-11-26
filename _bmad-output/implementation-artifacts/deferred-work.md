- source_spec: `spec-1-1-project-setup-ci-and-the-first-spikes.md`
  summary: Classify `src/styles`, `src/i18n` and `proxy.ts` as boundary elements
  evidence: Files outside the six layers are unchecked; Stories 1.2 and 1.3 create them.
- source_spec: `spec-1-1-project-setup-ci-and-the-first-spikes.md`
  summary: Lint rule: a `'use client'` file must not import `server` or `db`
  evidence: The layer rule lets `app` import `server`, so a client component in `app` could; add in Story 1.6.
- source_spec: `spec-1-1-project-setup-ci-and-the-first-spikes.md`
  summary: Add `npm audit` and dependency update automation
  evidence: None configured; fits the Story 9.4 security review.
- source_spec: `spec-1-1-project-setup-ci-and-the-first-spikes.md`
  summary: Replace the CSS vitest scan with stylelint (hex and physical properties)
  evidence: ESLint does not read CSS; the scan is a stopgap.
- source_spec: `spec-1-2-theme-tokens-dark-mode-and-fonts.md`
  summary: Give Urdu inline emphasis (b, strong) a visible cue, since bold is not shipped
  evidence: Story 1.2 forces weight 400 under :lang(ur); emphasis needs underline or color, decide in Story 2.6 with the topic page.
- source_spec: `spec-1-2-theme-tokens-dark-mode-and-fonts.md`
  summary: Preload the Nastaliq font on /ur pages
  evidence: Route does not exist until Story 1.3; preload avoids a late swap.
- source_spec: `spec-1-2-theme-tokens-dark-mode-and-fonts.md`
  summary: Apply Urdu body size and line-height to nested lang=ur blocks
  evidence: Rule targets html:lang(ur); revisit when mixed-language blocks exist.
- source_spec: `spec-1-3-locale-routing-language-switch-and-rtl-shell.md`
  summary: Pass only the message namespaces that client components use to NextIntlClientProvider
  evidence: The whole catalog is sent to every page today; it grows with each key. Revisit when messages exceed a few KB.
- source_spec: `spec-1-3-locale-routing-language-switch-and-rtl-shell.md`
  summary: Save the language cookie for visitors without JavaScript (a small redirect route)
  evidence: The switcher links work without JS but only the JS click saves vm-locale; the route handler needs the Story 1.6 limiter rules.
- source_spec: `spec-1-3-locale-routing-language-switch-and-rtl-shell.md`
  summary: Redirect case and region variants of the locale (/EN, /ur-PK) instead of 404
  evidence: The proxy matcher only covers /; such links currently 404.
- source_spec: `spec-1-3-locale-routing-language-switch-and-rtl-shell.md`
  summary: Add hreflang alternates and canonical URLs
  evidence: Needs the product domain from Story 9.8.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Reserve a login attempt atomically before verifying the password or code
  evidence: Lock check and count are separate calls, so a parallel burst can exceed five guesses; bounded by concurrency, pair with the Story 1.6 IP limiter.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Refresh the admin session in a proxy for /admin
  evidence: Server Components cannot write cookies, so after the access token expires the admin sees the not-available page with no way back to sign-in.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Store recovery code hashes with HMAC and a server pepper
  evidence: About 49.5 bits and unsalted SHA-256; a leaked table plus the password could reset the second factor.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Purge stale login_throttle rows in the rate-limit sweeper (AD-28)
  evidence: Rows are created for any submitted email hash and never deleted.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Regenerate recovery codes from an admin account page
  evidence: Codes are shown once and cannot be replaced without removing the factor.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Audit failed sign-ins and lockouts, and scope the lock by IP as well as email
  evidence: Only successes are audited; anyone who knows the address can keep the owner locked out.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Test that every page under admin/(panel) calls requireAdminPage; exempt /api/admin/auth/* from the requireAdmin-or-ratelimit lint
  evidence: Defence in depth is only a comment today (Story 1.6 route rules).
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Log the request id of a 500 from admin handlers through /api/log
  evidence: The id is returned but nothing records it (Story 1.6).
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Block admin go-live until spike 6 passes
  evidence: Setting the Supabase env vars enables the unverified path; add a checklist item or a flag at deploy time.
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Move focus to the new heading or field on each sign-in step; redirect a signed-in admin from /admin/sign-in
  evidence: Admin UI polish (Epic 9).
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Admin CSP must allow img-src data: on /admin only
  evidence: The TOTP QR code is an SVG data URI from Supabase (Story 1.6).
- source_spec: `spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md`
  summary: Purge audit_log after 12 months despite append-only rule
  evidence: AD-17 retention conflicts with the trigger; the purge job needs a dedicated, audited path.
- source_spec: `spec-1-5-database-math-tree-tables-and-seed.md`
  summary: Revoke default privileges for role supabase_admin on the real project
  evidence: Objects created by another role (dashboard, supabase_admin) still get anon grants; cannot be tested on PGlite.
- source_spec: `spec-1-5-database-math-tree-tables-and-seed.md`
  summary: Add deferrable unique constraints on positions within a parent when reordering is built (Story 7.5)
  evidence: Duplicate orderings are possible today.
- source_spec: `spec-1-5-database-math-tree-tables-and-seed.md`
  summary: Keep topic_version.published_at in step with topic.published_hash in the publish saga
  evidence: Two fields can disagree; the saga is the only writer.
- source_spec: `spec-1-5-database-math-tree-tables-and-seed.md`
  summary: Log why the database environment was rejected (APP_ENV, schema or platform mismatch)
  evidence: parseDbEnv returns null for both 'not configured' and 'inconsistent'; use /api/log in Story 1.6.
- source_spec: `spec-1-5-database-math-tree-tables-and-seed.md`
  summary: Check column-level grants to anon and authenticated in check-migrations
  evidence: Only table-level grants are inspected.
- source_spec: `spec-1-5-database-math-tree-tables-and-seed.md`
  summary: Automate dropping preview schemas when a pull request closes
  evidence: Done by hand today; stale schemas accumulate.
- source_spec: `spec-1-6-security-baseline.md`
  summary: Schedule rate_limit_sweep(), error_log_purge() and the other retention jobs (daily job, AD-28)
  evidence: The functions exist (migration 0004) but nothing calls them; rate-limit keys should go after 1 hour, error log after 30 days, audit log after 12 months.
- source_spec: `spec-1-6-security-baseline.md`
  summary: Report client errors to /api/log (error boundary and window error handlers) and cap error_log size
  evidence: The endpoint has no caller yet; many addresses could fill the table before the 30-day purge.
- source_spec: `spec-1-6-security-baseline.md`
  summary: Strip query text after a space in scrubbed messages
  evidence: A URL query containing a space leaves its tail in the message.
- source_spec: `spec-1-6-security-baseline.md`
  summary: Skip admin session refresh for prefetch requests if refresh-token races appear
  evidence: Parallel admin requests may reuse one refresh token.
- source_spec: `spec-1-6-security-baseline.md`
  summary: Log a scrubbed first stack frame in guarded()
  evidence: Only the error class and request id are printed; debugging a 500 is harder.
- source_spec: `spec-1-6-security-baseline.md`
  summary: Raise HSTS to two years with includeSubDomains once every subdomain serves HTTPS
  evidence: Currently one year, no includeSubDomains, because the product domain is not final.
- source_spec: `spec-2-1-expression-module.md`
  summary: Calibrate the scene cost cap (3,000,000 steps, AD-3) and the renderer's fallback with real devices
  evidence: The interpreter runs about 20 ns per step on a desktop, so the cap is about 60 ms per frame, above a 33 ms frame; measure on a mid-range phone in Story 2.4 (spike 1) and lower the cap or compile hot paths if needed.
- source_spec: `spec-2-1-expression-module.md`
  summary: Reconcile topic-format section 3 with the implementation: fact is NaN from 167 (1e300 cap), 9 call arguments is E_EXPR_LIMIT, positions are 1-based
  evidence: Small wording differences found while building; the document should state them (human applies, Story 2.2 adds the field-table diff check).
- source_spec: `spec-2-2-topic-schema-md-parser-and-scene-registry.md`
  summary: Parse uploaded JSON with duplicate-key detection (S0, Story 7.1)
  evidence: JSON.parse keeps the last of two equal keys, so two versions of one field can hide in a file; the schema never sees the first.
- source_spec: `spec-2-2-topic-schema-md-parser-and-scene-registry.md`
  summary: Reconcile topic-format.md with the schema: Term texts are Should (1.3) but the Zod sketch in 1.4 shows them required; the Parameter table lists `min`, `max` in one row
  evidence: Found while building Story 2.2; the document should say what the schema does (the schema wins).
- source_spec: `spec-2-2-topic-schema-md-parser-and-scene-registry.md`
  summary: Heading paths for texts inside a scene type's own fields (labels in canvas2d, solid3d and others)
  evidence: The MD layout only names scene.caption, scene.description and scene.readouts.<id>.label; each scene type story adds its own paths to `locate` in md.ts and to topic-format section 4.
- source_spec: `spec-2-2-topic-schema-md-parser-and-scene-registry.md`
  summary: Add the parameter range rules (step grid, default on the grid, toggle 0 and 1, choice options) as stage S2
  evidence: Only `min < max` is in the S1 schema (as the Zod sketch has it); the rest of topic-format 1.2 is E_RANGE in Story 7.1.
