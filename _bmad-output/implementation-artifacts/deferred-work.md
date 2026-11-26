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
