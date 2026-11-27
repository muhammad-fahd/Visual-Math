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
- source_spec: `spec-2-3-scene-frame-and-common-controls.md`
  summary: Decide the direction of keyboard turning against dragging (ArrowRight raises the azimuth; a drag to the right lowers it)
  evidence: The two turn the picture opposite ways; the frozen Story 2.3 matrix fixes ArrowRight at +5. Owner to decide whether to align the keys with the drag.
- source_spec: `spec-2-3-scene-frame-and-common-controls.md`
  summary: Resolve wheel and touch scroll trapping with the sticky layout of Story 2.6
  evidence: The surface zooms on every wheel event and uses touch-action none; on a full-width picture a visitor cannot scroll past it by wheel or touch. The toolbar covers every gesture.
- source_spec: `spec-2-3-scene-frame-and-common-controls.md`
  summary: Vary the first-time hint and the keyboard hint with the scene's capabilities (wheel, right-drag, + - 0, Shift)
  evidence: The text always says drag to turn, which is wrong for 2D scenes.
- source_spec: `spec-2-3-scene-frame-and-common-controls.md`
  summary: Move focus into the maximized fallback and make the page behind inert
  evidence: Fallback Full screen leaves keyboard focus behind the frame and lets the page scroll.
- source_spec: `spec-2-3-scene-frame-and-common-controls.md`
  summary: Announce zoom and move actions through the page's single live region (Story 2.6)
  evidence: Only Reset view, Full screen on and off are announced today.
- source_spec: `spec-2-3-scene-frame-and-common-controls.md`
  summary: Run the scene frame on a real phone and on Firefox and WebKit
  evidence: Only desktop Chrome and Edge were run locally; CI covers Firefox and WebKit; spike 1 (phones) is the owner's.
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: Adaptive quality for Tier A (`PerformanceMonitor` or an equivalent) after spike 1
  evidence: AD-13 lists it; the viewer has dpr at most 1.5, a demand loop and 32 segments, but nothing lowers quality on a slow phone. Needs `drei` or a small own monitor; decide with device numbers.
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: Add `render3D` and `static2D` to the viewer registry entry and place the viewer from the topic page (Story 2.6)
  evidence: `SolidViewer` is used directly by the harness page; the registry in `src/scenes/registry.ts` only has meta and `describe`. The thumbnail from `static2D` (AD-20) is also still to do.
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: Reconcile `topic-format.md` with `solid3d@1` as built
  evidence: Dimension labels (`l`, `w`, `h`, `a`, `R`, `r`), `labels.dimensions` defaulting to shown, radii along x, and `section`, `net`, `fill` arriving with Story 2.5 are not in the doc.
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: Measure KaTeX JS in the browser against the 200 KB initial budget (Story 9.1)
  evidence: Live formulas must re-render on a slider move, so KaTeX is client code on a topic page now; the earlier spike measured it as server-only.
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: LaTeX command allowlist in `renderMath` or at upload (Story 7.1)
  evidence: KaTeX under `trust: false` still accepts macro commands such as `\\def`; only an allowlist closes that (AD-14).
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: Review the Urdu strings added for the solid viewer
  evidence: `solid.*` messages in `ur.json` are AI drafts, like the rest.
- source_spec: `spec-2-4-3d-solid-scene-sliders-live-formulas-and-tiers.md`
  summary: Run the solid viewer on a real phone (spike 1), Firefox and WebKit
  evidence: Only desktop Chrome and Edge were run locally; software WebGL says nothing about a phone's 30 fps.
- source_spec: `spec-2-5-cross-section-unfold-and-fill.md`
  summary: Reconcile `topic-format.md` with `section`, `net` and `fill` as built
  evidence: Offsets are from the solid's centre; `progress` and `level` are bare parameter ids when they are to be played; a net only exists for six kinds; the shape names and measures of a cut are not documented.
- source_spec: `spec-2-5-cross-section-unfold-and-fill.md`
  summary: Check the new fields at upload (Story 7.1)
  evidence: A plane that never meets the solid, a `net` on a kind without one, a `progress` or `level` outside 0 to 1 over the parameter's range, and a Play target that is not a parameter should be problems, not silent no-ops.
- source_spec: `spec-2-5-cross-section-unfold-and-fill.md`
  summary: Measure the net animation on a phone (spike 1)
  evidence: 34 panels (cylinder) are rebuilt as three.js geometry every frame; fine on a laptop, unmeasured on a mid-range phone.
- source_spec: `spec-2-5-cross-section-unfold-and-fill.md`
  summary: Review the Urdu strings added for cut, net and fill
  evidence: `solid.section.*`, `solid.net.*`, `solid.fill.*` and `solid.animation.*` are AI drafts.
- source_spec: `spec-2-5-cross-section-unfold-and-fill.md`
  summary: Name the cut of a cone off its axis (a conic) and give a rectangle's sides their roles
  evidence: A cone cut off its axis is shown as a curved shape with area and distance round; width and height of a rectangle are the longer and shorter side.
- source_spec: `spec-2-6-topic-page-steps-formulas-and-worked-example.md`
  summary: Use the app's locale-aware link for path and neighbour links when the tree routes exist (Epic 5)
  evidence: The topic page uses plain anchors with hrefs it is given; each click is a full page load until the real link component and addresses are chosen.
- source_spec: `spec-2-6-topic-page-steps-formulas-and-worked-example.md`
  summary: Place `TopicPage` on a real route fed by the catalog and storage (Epics 5 and 7), with the tree names, neighbours and the 404 for an unpublished topic
  evidence: Today only the `VM_HARNESS` page shows it, with fixtures and stub neighbours.
- source_spec: `spec-2-6-topic-page-steps-formulas-and-worked-example.md`
  summary: Upload checks for the topic page's text (Story 7.1)
  evidence: A `{{term:id}}` that names no term, a calculated line named like an input or without decimals, a step that names an unknown parameter, and a `formulaRef` that names no formula are silently ignored by the page today.
- source_spec: `spec-2-6-topic-page-steps-formulas-and-worked-example.md`
  summary: Give a scene type with no viewer (the unit circle, Epic 3) the same sliders and formulas as a solid topic
  evidence: `TopicPage` shows only the step bar for it, with a plain message; the parameters and formulas wait for that viewer.
- source_spec: `spec-2-6-topic-page-steps-formulas-and-worked-example.md`
  summary: One accessibility pass over the viewer's controls
  evidence: `aria-valuetext` with the unit on sliders, one label for a slider and its typed box, and the slider track mirroring in Urdu (SRS lists it as mirrored).
- source_spec: `spec-2-6-topic-page-steps-formulas-and-worked-example.md`
  summary: Real devices and a real 200% text size for the topic page
  evidence: The sticky and un-stick rules are tested with viewports (320 px, 640 by 400); a browser's own text-size setting and phones are the owner's (spike 1).
- source_spec: `spec-2-7-report-a-problem.md`
  summary: Decide a cap on open problem reports per topic and per day, and what to do with reports for topic ids that do not exist (Story 7.6)
  evidence: The route checks the id's format only (a topic can be unpublished while its page is open), so a patient sender can store reports for invented ids; the rate limits slow this but do not bound the table.
- source_spec: `spec-2-7-report-a-problem.md`
  summary: Schedule `problem_report_purge()` with the other purge functions in the daily job
  evidence: Handled reports older than 12 months are never deleted until something calls it; the same is true of `rate_limit_sweep()` and `error_log_purge()`.
- source_spec: `spec-2-7-report-a-problem.md`
  summary: Mention problem reports and what is kept (topic id, reason, note, 12 months after handled) on the Privacy page (Story 6.5)
  evidence: The page does not exist yet; the sheet already asks visitors not to write personal details.
- source_spec: `spec-2-7-report-a-problem.md`
  summary: Review the Urdu strings added for the report sheet
  evidence: `report.*` in `ur.json` are AI drafts.
- source_spec: `spec-2-7-report-a-problem.md`
  summary: Show the admin the grouped reports with their repeat counts (Story 7.6)
  evidence: `problem_report.repeats` and `last_seen_at` are kept for it; nothing reads them yet.
- source_spec: `spec-2-8-reset-all-marked-terms-and-language-switch-on-a-topic.md`
  summary: Run the three reviewers (blind, edge-case, verification-gap) on Story 2.8 and triage them
  evidence: They failed on the account's usage limit and returned nothing; the story was reviewed inline only. The diff is `src/` since the baseline commit in the spec.
- source_spec: `spec-2-8-reset-all-marked-terms-and-language-switch-on-a-topic.md`
  summary: Put the worked example's inputs in the address too, if a visitor should keep them across a language switch
  evidence: Only the step and the sliders are written today, by the spec; the example restarts at its defaults after a switch.
- source_spec: `spec-2-8-reset-all-marked-terms-and-language-switch-on-a-topic.md`
  summary: Keep the step and sliders when the topic page is reached from the tree or search (Epic 5 links)
  evidence: The address carries them; links built by Epic 5 should pass `step` and `p.` keys through unchanged and never add keys of their own with those names.
- source_spec: `spec-2-8-reset-all-marked-terms-and-language-switch-on-a-topic.md`
  summary: Review the Urdu strings added for Reset all and the term sheet
  evidence: `topic.reset*` and `topic.term*` in `ur.json` are AI drafts; the term definitions in the section fixture are too.
- source_spec: `spec-3-1-2d-graphs-canvas2d.md`
  summary: Make the `Canvas2D` clip-path id unique per instance and share the stroke tables with the legend
  evidence: `idPrefix` defaults to `c2d`; two graphs on one page (a thumbnail grid in Epic 5) would share a clip id. The legend in `Canvas2DViewer` repeats `STROKE`.
- source_spec: `spec-3-1-2d-graphs-canvas2d.md`
  summary: Review the Urdu strings in `canvas.*` and the graph fixture
  evidence: AI drafts in `ur.json` and `alg-quadratic-graph.json`.
- source_spec: `spec-3-2-2d-geometry.md`
  summary: Draw the labels of polygons, circles and angles in the picture, avoid overlapping measure texts, and mark right angles with a square
  evidence: `ShapeView` draws a label only for lines; `Canvas2D` places each measure at a fixed offset from its anchor.
- source_spec: `spec-3-2-2d-geometry.md`
  summary: Review the Urdu strings in `canvas.measure.*`, `canvas.image` and the triangle fixture
  evidence: AI drafts in `ur.json` and `geo-triangle-transform.json`.

