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
- source_spec: `spec-3-3-number-and-fraction-models.md`
  summary: Add browser tests and a fixture topic for the place-value, ten-frame, area-model, percent-grid, fraction-circle and number-line models
  evidence: `models.spec.ts` covers only the fractions fixture; the other six kinds are covered by unit tests of the controls and sentences, and share the one handle component.
- source_spec: `spec-3-3-number-and-fraction-models.md`
  summary: Limit a place-value column handle to digits the bound parameter can reach
  evidence: `toParam` is clamped by the parameter's range afterwards, so with a parameter max of 999 the thousands handle snaps back; `buildModel` does not know the parameter's range.
- source_spec: `spec-3-3-number-and-fraction-models.md`
  summary: Document `marker` and the per-kind fields of `number-model` in topic-format 2.6 and diff them in `topic-format-doc.test.ts`
  evidence: the doc test only checks the one field `model`; `marker` on `numberLine` is not in the document (joins the topic-format reconciliation of the Epic 2 retro).
- source_spec: `spec-3-3-number-and-fraction-models.md`
  summary: Announce what changed instead of every sentence, and consider zoom for dense models (100-cell grids, 24 parts)
  evidence: `spokenOf(readouts, sentences)` repeats the whole description on each change; the frame has zoom off for this scene type and 11px labels shrink on a 320px screen.
- source_spec: `spec-3-3-number-and-fraction-models.md`
  summary: Review the Urdu strings in `models.*` and the fractions fixture; ask whether the "jump" sentence reads naturally
  evidence: AI drafts in `ur.json` and `num-equivalent-fractions.json`; `jump` ends with a fragment.
- source_spec: `spec-3-4-algebra-tools.md`
  summary: Check that a step solver's `reveal` names a real parameter, with the other id checks of stage S2
  evidence: `checkSolverLines` only evaluates lines; a topic whose `reveal` is not a parameter shows one line and never more.
- source_spec: `spec-3-4-algebra-tools.md`
  summary: Add browser tests for the algebra tiles and the function machine, and fit long rules and large outputs in the machine picture
  evidence: only the balance scale and the solver have fixtures and e2e tests; the machine cuts a rule at 18 characters and does not shrink a large output.
- source_spec: `spec-3-4-algebra-tools.md`
  summary: Document the nested `tool: {kind, ...}` of `algebra-tool` (and `model` of `number-model`) in topic-format 2.6 and 2.7 and diff the kinds in `topic-format-doc.test.ts`
  evidence: the doc test only checks the one field `tool`; the tables per tool in 2.7 are not diffed (joins the topic-format reconciliation).
- source_spec: `spec-3-4-algebra-tools.md`
  summary: Review the Urdu strings in `algebra.*` and the two algebra fixtures
  evidence: AI drafts in `ur.json`, `alg-balance-scale.json` and `alg-solve-steps.json`.
- source_spec: `spec-3-5-trigonometry-scenes.md`
  summary: Say something when a trig scene has nothing to draw (an angle or sides that cannot be computed), and check at upload that `angle` and the `given` names exist (stage S2)
  evidence: `buildUnitCircle` and `buildTriangle` return no prims and no sentences for NaN input, so the visitor sees an empty frame; an unknown parameter id gives NaN silently.
- source_spec: `spec-3-5-trigonometry-scenes.md`
  summary: Isolate left-to-right math inside Urdu sentences (`<bdi>`), make the touch target of the angle and model handles at least 24 CSS pixels on a 320px screen, and review the Urdu strings in `trig.*` and `trig-right-triangle.json`
  evidence: `ratioSin` and the exact forms put "3 / 5 = 0.6" and "(\u221a3/2)" inside Urdu text; the handle hit radius is 14 picture units (about 22px at 320px); the Urdu `handle` string keeps "Page Up" in English; "\u0628\u0627\u0644\u0645\u0642\u0627\u0628\u0644" for "over" may read as "versus".
- source_spec: `spec-3-5-trigonometry-scenes.md`
  summary: Run the migration tests (PGlite) with a longer `beforeAll` timeout or a shared database
  evidence: four migration test files timed out in `beforeAll` (10s) in one `npm run check` run on a busy machine and passed on the rerun.
- source_spec: `spec-3-6-statistics-and-probability.md`
  summary: Add the probability tree, draggable scatter points and a stats `topic-format` 2.11 reconciliation (`dotPlot`, `sim`, `sectors`, nested `chart`) with a doc diff test
  evidence: both are in 2.11 but left out of this version by the spec; the doc test checks only the one field `chart`.
- source_spec: `spec-3-6-statistics-and-probability.md`
  summary: Add fixtures and browser tests for the histogram, box plot, scatter, bar, binomial and uniform charts
  evidence: only the normal distribution and the die have a fixture and e2e tests; the other charts are unit-tested through `buildChart` and the shared renderer.
- source_spec: `spec-3-6-statistics-and-probability.md`
  summary: Validate literals that are clamped silently (bins, trials, sectors, binomial n, a negative `sd` in `gen`) at upload, and label the axes with a title and unit
  evidence: the schema accepts `bins: 90` or `trials: 5000` and the chart clamps it; axes carry numbers only; the Urdu `fit` sentence mixes Latin letters and a minus sign without bidi isolation.
- source_spec: `spec-3-6-statistics-and-probability.md`
  summary: Announce a short summary instead of every outcome line when a simulation slider moves, and review the Urdu strings in `stats.*` and the two stats fixtures
  evidence: `spokenOf(readouts, sentences)` reads up to 8 sentences per change; AI drafts in `ur.json`, `stats-normal-distribution.json` and `stats-dice.json`.
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Check at upload that ids in geometry elements refer to real points and parameters (segment, line, circle, angle, polygon, transform, `drag`), and that a solver's `reveal` and `variable` exist (stage S2, Story 7.1)
  evidence: a mistyped id passes the schema and draws nothing; the tests pin that runtime behavior.
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Make the solver check prove more: the last line is `variable = solution`, the displayed `latex` matches `lhs` and `rhs`, and a line that is true for every value (`x = x`) is refused
  evidence: `checkSolverLines` only evaluates `lhs` and `rhs` at the solution, so a wrong intermediate line that holds there, or LaTeX that differs from what was verified, passes E_SOLVER_LINE.
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Sampler edge cases: a pole with the same sign on both sides (1/x^2) draws a clamped spike, a very steep continuous line can be cut once, and a long `domain` spreads the samples thin
  evidence: `lib/graph/sample.ts` breaks a line only when a jump changes sign; the header comment promises "never draws a spike".
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Let a step hide a point's marker and keep its shapes (today hiding a point hides every segment, polygon and angle built on it), and document the author constraint
  evidence: `buildDrawables` collects only visible points; `graph-geometry.test.ts` asserts it as intended.
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Algebra tool polish: show a long machine rule in math notation and scale it to the box, tell the author when a count is clamped, label tiles smaller than 12 units, and make `expand` and `factor` draw different pictures
  evidence: `buildTool` cuts the rule at 18 characters and prints raw syntax (`2*x + 1`), clamps counts silently, drops tile labels under 12 units; the two modes differ only by sentence.
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Accessibility of the graph handles and trace: a 44px touch target, a value text for both x and y, Home and End, and a quieter live region while the trace slider moves
  evidence: `Handles.tsx` hit radius 11 picture units; `aria-valuenow` carries x only; the trace slider announces on every step.
- source_spec: `retro of Epic 3 (reviews of 3.1, 3.2, 3.4)`
  summary: Reserve the plot variable names (`x`, `t`) from parameter ids, or give `program.fn` a variable no parameter can have, and narrow the `as unknown as ComponentType` casts of `viewers.tsx`
  evidence: a topic parameter named `x` is overwritten by the graph variable inside `f(x)`; Story 3.6 avoided it with a long free-variable name; each viewer is widened because `scene` is `unknown`.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-catalog-and-tree-pages.md`
  summary: Enforce `RESERVED_SLUGS` where categories, subcategories and chapters are created (tree upload, admin editing, a check constraint or `buildCatalog`), and check slugs are non-empty and URL-safe
  evidence: a category with id `search` or `map` builds a catalog and `treeHref` emits `/en/map`, shadowing a real page; nothing creates categories before Story 7.5.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-catalog-and-tree-pages.md`
  summary: Proxy: list each new top-level route that has no language prefix (`/auth/callback`, `/sitemap`...) in the matcher exclusions, and answer a dotted single segment (`/foo.bar`) with a 404 instead of the home page
  evidence: the third matcher entry rewrites every other path to a 404 target; `/[locale]` matches `foo.bar`, so it renders the English home page.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-catalog-and-tree-pages.md`
  summary: Check what a no-JavaScript visitor or crawler gets from a `notFound()` page: the raw HTML is Next's error shell and the real content arrives with the client
  evidence: seen in dev and production for the tree 404; status is 404; the e2e test only reads the hydrated page.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-catalog-and-tree-pages.md`
  summary: Viewed marks: refresh in the same tab after Story 6.1 writes (a custom event, since `storage` does not fire in the writing tab) and share one store instead of one subscription and parse per card
  evidence: `ViewedMark` listens to `storage` only; every card parses the same value.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-catalog-and-tree-pages.md`
  summary: Page metadata for the tree pages: description, canonical and `hreflang` alternates between `/en` and `/ur`
  evidence: pages set only a title.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-1-catalog-and-tree-pages.md`
  summary: Catalog size budget (150 KB gzip), caching, and tag revalidation (`catalog`, `topic:{id}`) when Story 7.3 writes `catalog.json`
  evidence: `getCatalog` rebuilds once per request and per `generateStaticParams`; pages never refresh until a rebuild; no size is measured.
- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-home-page-and-the-not-found-page.md`
  summary: Mark text that falls back to English inside an Urdu page (a topic title or a tree name with no Urdu) with `lang="en"`, on cards, tree links and the home page
  evidence: `loc()` returns the English value without telling the page, so a screen reader pronounces it with Urdu rules; it applies to the 5.1 cards too.
- source_spec: `epic 5 review (three reviewers over stories 5.1 to 5.5)`
  summary: Search and map: follow an address that changes while the page is open (a link to `/search?q=x` or `/map?cat=y` from the same page), instead of reading it once at mount
  evidence: both components seed their state from `useSearchParams` once and write with `replaceState`; today no link on the page leads to another address of the same page.
- source_spec: `epic 5 review (three reviewers over stories 5.1 to 5.5)`
  summary: Search folding of Urdu heh forms (Arabic heh U+0647, heh doachashmee U+06BE, teh marbuta U+0629) and an undocumented NFKD effect (alef-madda becomes plain alef)
  evidence: AD-21 names only yeh and kaf; folding U+06BE would merge distinct aspirated letters, so it needs the owner or a linguist to decide.
- source_spec: `epic 5 review (three reviewers over stories 5.1 to 5.5)`
  summary: Learning map nodes for Urdu: measured widths or wrapping and a larger minimum font, instead of a 22-character cut at 13 px
  evidence: Nastaliq is taller and wider per character; the list carries full titles, but the picture is the weakest part for Urdu.
- source_spec: `epic 5 review (three reviewers over stories 5.1 to 5.5)`
  summary: A friendly not-found page for addresses deeper than any route (`/en/a/b/c/d`), and a sturdier target for the proxy rewrite of unsupported languages
  evidence: those paths match no route and get the global 404 without the search box; the rewrite target works only while no page is five segments deep (a test checks the depth).
- source_spec: `epic 5 review (three reviewers over stories 5.1 to 5.5)`
  summary: Share: `navigator.share` on phones, and feedback when the toast timer is cut short by a second press
  evidence: only the clipboard path exists.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-space3d.md`
  summary: At upload (S2), check that a `space3d` derived element names earlier vectors (an `op` or a `dot` whose `of`, `a` or `b` is missing or comes later), and (S3) that the expressions of scene fields parse
  evidence: today a bad reference or expression only leaves the element out of the picture with a sentence saying so (`skipped`); an author gets no upload error.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-space3d.md`
  summary: Fat lines for dashed vectors and the axes in the 3D picture (Tier A draws only solid weight-2 lines as prisms; dashed and thin lines are one pixel)
  evidence: the flat picture draws them at their weight; only the three.js picture is thinner for a dashed projection arrow.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-space3d.md`
  summary: `space3d` elements that the architecture planned and Story 4.1 did not build: `segment3`, `polygon3`, `box3` (determinant as volume, Story 4.4), `text3`, and dragging a point
  evidence: editing is by sliders and typed boxes by decision; a 3D drag needs depth rules and its own keyboard nudging.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-space3d.md`
  summary: Label placement in `space3d`: labels can overlap each other and the axis letters (a and b near the origin, plane and line labels near the axes)
  evidence: labels sit beside the tip with a halo; there is no collision avoidance.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-complex-plane.md`
  summary: At upload (S2), check that a `complexOp` names `complex` ids or other ops that exist, with the right count, and (S3) that the expressions of scene fields parse
  evidence: today a bad reference or expression leaves the element out of the picture with a sentence saying so (`skipped`); an author gets no upload error. Same gap as the `space3d` references.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-complex-plane.md`
  summary: Argand diagram polish: labels of the modulus and the argument can sit on each other and on the arrows; a number far from the origin has no arrow head; no complex-valued functions or domain colouring
  evidence: `texts` are placed at fixed fractions of the arrow with a halo; there is no collision avoidance.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-complex-plane.md`
  summary: Powers and roots of a number given by a slider are re-listed in the text on every change; for n above 8 the roots are not listed
  evidence: the sentence names the circle and the angle only; a list for larger n would need a collapsed block.
- source_spec: none
  summary: Solids of revolution in 3D (`revolution3d`, FR-3.25): a curve revolved about an axis with disk or shell slicing, a sweep angle, a highlighted slice and a 2D profile; its own spec and story, to take straight after 4.3
  evidence: split from Story 4.3 at the owner's choice (2026-11-28): the 2D calculus elements (tangent, derivative graph, secant, limit, Riemann sums, area) cover the four Calculus launch topics; a new 3D scene is an independent deliverable that no launch topic needs yet. Planned in topic-format 2.10.
- source_spec: spec-4-3-calculus-scenes.md
  summary: The tangent drag works along x only and a `derivative` marker is not draggable; the limit decision uses a fixed h/1000 and a 1e-3 tolerance, and the jump test a 0.01 relative step, so a very fast oscillation (sin(1000x)) can be called a jump or a limit wrongly
  evidence: Story 4.3 numerics in src/lib/graph/calculus.ts (slopeAt, limitOf); topic-format scales and tolerances were chosen for the launch curves, not proven for every expression
- source_spec: spec-4-4-matrix-transform.md
  summary: The matrix scene has no visual check yet (screenshots of the F, grid, eigen lines and cube in both languages), no 3D eigenvectors, no way to drag the basis arrows, and the 2D window does not auto-fit a large matrix (entries are clamped, the picture is cropped)
  evidence: Story 4.4 reviewers and behavior check wait for the end of Epic 4; eigen3 and arrow dragging were left out of the spec on purpose (Never list); range is author-set (default 4) in src/lib/matrix/build.ts
