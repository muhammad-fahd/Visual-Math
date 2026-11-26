---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
status: complete
updated: 2026-11-26
inputDocuments:
  - docs/srs.md
  - _bmad-output/planning-artifacts/prds/prd-Visual Math-2026-11-26/prd.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Visual Math-2026-11-26/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Visual Math-2026-11-26/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-Visual Math-2026-11-26/topic-format.md
supersedes: first epics document built on the Axiora SRS (kept in _bmad-output/_superseded-axiora-srs/)
---

# Visual Math: Epic Breakdown, version 1

## Overview

Epics and stories for **version 1 only** (free, no visitor account, English and Urdu, one admin, 48 launch topics). The epic structure follows SRS 10.1 (E1 to E9). SRS epics E10 to E12 (version 2 allowance, accounts and subscriptions, admin subscription tools, quizzes) are out of this build and are listed at the end. Requirement IDs are the SRS IDs. "AD-n" refers to ARCHITECTURE-SPINE.md and "UX" to DESIGN.md and EXPERIENCE.md. Every story carries acceptance tests (NFR-6.5); each acceptance line below is a test.

Priority: M = must, S = should. S items listed in a story are built in that story if time allows, except FR-3.11, FR-3.27 and FR-3.29, which are required for launch (PRD section 14).

Build order rule: epics 2 to 6 do not wait for Epic 7. Until upload and publish exist, stories use fixture topics (the topic-format worked example plus one fixture per scene type) loaded by a dev-only seed script that writes the same rows and snapshots Epic 7 later produces. Nothing in epics 2 to 6 may depend on the admin UI.

Story rule for UI stories: the story is not done until it works in English and Urdu (right-to-left), in light and dark mode, on a 360 px phone, and by keyboard.

## Requirements Inventory

The full requirement text is in the PRD (section 5 for FR, section 7 for NFR). This list names every in-scope ID so coverage can be checked.

**FR in scope:** FR-1.1 to 1.11; FR-2.1 to 2.8; FR-3.1 to 3.15, 3.17 to 3.30; FR-4.1 to 4.7; FR-5.1 to 5.4; FR-6.1 to 6.6; FR-7.1; FR-8.11 (S); FR-9.1 to 9.16; FR-10.5 to 10.7; FR-11.1; FR-12.1 to 12.5.
**NFR in scope:** NFR-1.1 to 1.6; NFR-2.1, 2.2, 2.4, 2.6, 2.7, 2.8, 2.10; NFR-3.1 to 3.5; NFR-4.1 to 4.3; NFR-5.1 to 5.3; NFR-6.1 to 6.5; NFR-7.1 to 7.4.
**Not in this build:** FR-3.16 (L); FR-6.7 (L); FR-7.2 to 7.11, 8.1 to 8.10, 5.5, 10.1 to 10.4 (V2); FR-8.12 (L); FR-11.2, 11.3 (L); NFR-2.3, 2.5, 2.9 and NFR-5.4 (V2).

**Architecture requirements (AR):** AR-1 modular monolith and layer rules (AD-1); AR-2 scene registry and contract (AD-2); AR-3 one expression module (AD-3); AR-4 upload pipeline (AD-4); AR-5 i18n shape (AD-5); AR-6 viewer store (AD-6); AR-7 delivery and storage (AD-7); AR-8 admin access, TOTP, RLS deny-all (AD-8); AR-9 mutation path (AD-9); AR-10 static rendering and routes (AD-10); AR-11 theme tokens (AD-11); AR-12 direction and fonts (AD-12); AR-13 performance tiers (AD-13); AR-14 untrusted text (AD-14); AR-15 scene frame (AD-15); AR-16 flags and seams (AD-16); AR-17 privacy, CSP, storage notice (AD-17); AR-18 progress on device (AD-18); AR-19 versions and deletion (AD-19); AR-20 catalog and publish saga (AD-20); AR-21 search (AD-21); AR-22 math tree and data model (AD-22); AR-23 hosting (AD-23); AR-24 environments and CI (AD-24); AR-25 backups (AD-25); AR-26 observability and analytics (AD-26); AR-27 quality gates (AD-27); AR-28 operations (AD-28); AR-29 browser support and spikes (AD-29). No starter template: Epic 1 Story 1.1 is a hand-set-up Next.js 16.4 and Supabase project per the Stack table.

**UX requirements (UX-DR):** UX-DR1 Quiet Study tokens, light default and dark (DESIGN.md frontmatter, unchanged); UX-DR2 typography incl. Urdu and Foundation sizes; UX-DR3 theme switching without flash or scene reset; UX-DR4 touch targets 44 px, Foundation 48 px, 8 px gaps; UX-DR5 components and behaviors in EXPERIENCE "Component Patterns"; UX-DR6 information architecture and navigation per EXPERIENCE; UX-DR7 topic page layout per SRS 7.2; UX-DR8 state patterns; UX-DR9 report-a-problem sheet; UX-DR10 interaction and keyboard model; UX-DR11 reduced motion; UX-DR12 accessibility floor, WCAG 2.1 AA; UX-DR13 RTL rules; UX-DR14 Foundation cognitive-load rules; UX-DR15 voice and tone; UX-DR16 key flows 1 to 5 covered by e2e tests.

## FR Coverage Map

| Requirement | Epic.Story |
| --- | --- |
| FR-1.1, 1.2, 1.3, 1.9, 1.10 | 5.1, 5.2 |
| FR-1.4, 1.5 | 5.3 |
| FR-1.6, 1.8, 1.11 | 5.4 |
| FR-1.7 | 5.5 |
| FR-2.1, 2.3, 4.1 to 4.7 | 2.6 |
| FR-2.2 | 2.6, 5.4 |
| FR-2.4 | 2.7 |
| FR-2.5, 2.6, 2.7 | 2.8 |
| FR-2.8 | 2.3 |
| FR-3.1 to 3.4, 3.15 | 2.3 |
| FR-3.5 to 3.9, 3.13, 3.14 | 2.4 |
| FR-3.10 to 3.12 | 2.5 |
| FR-3.17 | 3.1 |
| FR-3.18 | 3.2 |
| FR-3.19 | 3.3 |
| FR-3.20 | 3.4 |
| FR-3.21 | 3.5 |
| FR-3.26 | 3.6 |
| FR-3.22 | 4.1 |
| FR-3.24 | 4.2 |
| FR-3.25 | 4.3 |
| FR-3.27 | 4.4 |
| FR-3.23 | 4.5 |
| FR-3.28 | 2.6 |
| FR-3.29 | 2.3, each scene story |
| FR-3.30 | 2.2 |
| FR-5.1, 5.2, 5.4 | 6.1 |
| FR-5.3 | 6.2 |
| FR-6.1 to 6.3, 6.5, 6.6 | 1.3 |
| FR-6.4 | 7.1 |
| FR-6.2 | 1.2, 1.3 |
| FR-7.1, 10.5 | 7.6 |
| FR-8.11 | 6.6 |
| FR-9.1 | 1.4 |
| FR-9.2, 9.3, 9.15, 11.1 | 7.1 |
| FR-9.4, 9.5, 9.6, 9.8 | 7.2 |
| FR-9.7 | 7.3 |
| FR-9.9, 9.11, 9.12 | 7.4 |
| FR-9.10 | 7.5 |
| FR-9.13 | 1.4, 7.7 |
| FR-9.14 | 7.8 |
| FR-9.16 | 7.7 |
| FR-10.6, 10.7 | 7.6 |
| FR-12.1, 12.5 | 6.3 |
| FR-12.2 | 6.4 |
| FR-12.3, 12.4 | 6.5 |
| Section 5.6 wave 1 (48 topics) | 8.1 to 8.13 |
| NFR-1, 3, 4, 5, 6 (gates) | 9.1 to 9.8 and each story |
| NFR-2.1, 2.4, 2.6, 2.8 | 1.4, 1.6 |
| NFR-2.7 | 7.1 |
| NFR-2.10 | 9.7 |
| NFR-7.1 to 7.4 | 1.3 |

## Epic List

| Epic | Name | Depends on |
| --- | --- | --- |
| E1 | Foundation: site shell, languages, hosting, admin login | none |
| E2 | Scene engine core and topic page | E1 |
| E3 | Scene types for Foundation and Intermediate topics | E2 |
| E4 | Scene types for Advanced topics | E2 |
| E5 | Math tree, search and learning map | E1.5, E2 (uses `rebuildCatalog()` built in 5.1; Epic 7 later calls it) |
| E6 | Progress on the device, help and contact pages | E2 |
| E7 | Admin content tools | E1, E2 |
| E8 | Wave 1 content: 48 topics in English and Urdu | E3, E4, E7 (runs alongside E5 to E7 once scene types exist) |
| E9 | Hardening and launch gates | all above |

## Epic 1: Foundation: site shell, languages, hosting, admin login

Goal: a deployable, secure shell in English and Urdu with the Quiet Study theme and a working admin login, so every later epic has somewhere to land.

### Story 1.1: Project setup, CI and the first spikes
As the builder, I want the repository, pipeline and hosting skeleton in place, so that every later story ships through the same checks.
- Given a fresh clone, `npm run build`, typecheck, lint (layer boundaries, no hex colors, no physical CSS) and Vitest pass in CI and a preview deployment is created (AD-1, AD-24).
- Given the browserslist file, the Playwright matrix is generated from it (AD-29).
- Given the spike list of AD-29, items 1 to 6 are run and each result is written to `docs/spikes.md` with a pass or a decision for the owner. A failed spike blocks only the stories that depend on it.
- Given `docs/coding-standard.md` and `AGENTS.md`, both exist and CI fails when a lint rule they name is broken (NFR-6.1).

### Story 1.2: Theme tokens, dark mode and fonts
As a visitor, I want a calm light theme with a working dark mode and readable Urdu type, so that the site is comfortable on any device.
- Given DESIGN.md, `tokens.css` and `tokens.ts` are generated from its frontmatter and a test fails if a hex literal appears outside the generated files (AD-11, UX-DR1).
- Given the theme toggle (Light, Dark, System), switching never reloads the page and the saved choice is applied before first paint (UX-DR3).
- Given an Urdu page, the fallback font shows first and the Nastaliq subset loads without blocking text; the layout shifts by at most one line (NFR-1.6, AD-12).
- Given the contrast table in DESIGN.md, an automated check confirms every listed pair meets its threshold in light and dark.

### Story 1.3: Locale routing, language switch and right-to-left shell
As a visitor, I want the whole site in English or Urdu with my choice remembered, so that I can read it in my language.
- Given a first visit with a browser language of Urdu, `/` redirects to `/ur`; with an unsupported language it redirects to `/en` (FR-6.3).
- Given any page, the language is in the path and the switcher keeps the visitor's place on the page (FR-6.1, 6.6, 2.7 shell).
- Given `/ur`, `<html lang="ur" dir="rtl">`, chrome mirrors and formulas, axes and numbers stay left-to-right (FR-6.2, UX-DR13).
- Given the message files, no visible string is in code; a lint check fails on a literal user-facing string in a component (FR-6.5, NFR-7.1).
- Given a fake locale added to `LOCALES` in a test, the interface and schema accept it without code changes elsewhere (NFR-7.4).
- Given numbers and dates, they follow the visitor's language format (NFR-7.2).

### Story 1.4: Admin sign-in with a second step, and the audit writer
As the admin, I want to sign in securely so that only I can change content.
- Given a valid email and password, the admin is asked for an authenticator code and reaches the panel only with an `aal2` session (FR-9.1, AD-8).
- Given a visitor or a password-only session, every admin page and `/api/admin/*` handler returns the not-available page or 401 and no data (AD-8).
- Given the first sign-in, a setup screen shows a QR code and recovery codes (EXPERIENCE flow 4).
- Given five wrong attempts, sign-in is locked with the wait shown as text, and the message never says which factor was wrong (NFR-2.8).
- Given any admin write, one `audit_log` row (who, action, target, time) is written in the same transaction; UPDATE and DELETE on `audit_log` fail (FR-9.13, NFR-2.6).
- Given passwords, only Supabase's strong hashes exist; no password is logged (NFR-2.4).

### Story 1.5: Database, math tree tables and seed
As the builder, I want the schema and the twelve categories in place so that content has a home.
- Given the migrations, a table without row level security fails CI, and `anon` and `authenticated` have no table privileges (AD-8).
- Given the seed, the 12 categories exist with names in English and Urdu (SRS 5.2); subcategories and chapters are created by the admin (Story 7.5).
- Given `topic` and `topic_version`, a second published version of one topic is not representable (AD-19).
- Given the preview and production environments, preview uses a throwaway schema and never holds the production service-role key (AD-24).

### Story 1.6: Security baseline
As the owner, I want the site hardened from the start, so that later features cannot loosen it.
- Given the CSP of AD-17, Playwright fails on any third-party request, any CSP violation and any inline script without a hash.
- Given a handler without `requireAdmin()` or `ratelimit()`, lint fails (AD-9).
- Given the built client bundle, a scan finds no service-role key and no `eval` or `new Function` (AD-1).
- Given `/api/health`, an external monitor can read it; a first-party `/api/log` stores a scrubbed error with no IP (AD-26).
- Given HTTPS, all HTTP requests redirect (NFR-2.1).

## Epic 2: Scene engine core and topic page

Goal: one engine and one topic page that can show any topic defined by a package, starting with 3D solids and the common controls.

### Story 2.1: Expression module
As the builder, I want one safe expression evaluator, so that topic data can never run code.
- Given the grammar and whitelist in topic-format section 3, `parse` and `compile` accept every function listed and reject any other name, `__proto__`, and non-ASCII (AD-3).
- Given fuzz and property tests, no input throws; domain errors return NaN; the 20000-step budget is enforced.
- Given the typed value beside a slider, typed mode normalizes Eastern Arabic-Indic digits and rejects anything but one finite number (FR-3.7).
- Given known values (sin 30 = 0.5, nCr(5,2) = 10, normcdf(0) = 0.5), unit tests pass (NFR-6.2).

### Story 2.2: Topic schema, MD parser and scene registry
As the builder, I want the topic format as code, so that one shared scene format drives every topic.
- Given topic-format.md, `lib/topic-schema` validates the worked example (section 6) and a CI check diffs the generated field table against the document (FR-3.30, AD-27).
- Given the MD twin of the example, `parseMd` produces a JSON object equal to the JSON file; duplicate and unmatched headings give E_MD_DUPLICATE and E_MD_PATH (topic-format section 4).
- Given an unregistered `type@v`, validation fails with E_UNKNOWN_SCENE_TYPE; a registered type needs no change to the topic page (FR-3.30, AD-2).
- Given `canonicalize`, golden vectors give stable `sha256` hashes across key order and Unicode forms (AD-19).

### Story 2.3: Scene frame and common controls
As a visitor, I want to rotate, zoom, reset and use the keyboard on any scene, so that every picture behaves the same.
- Given a 3D or 2D scene, one finger or mouse drag rotates, wheel or pinch zooms, two-finger drag or right-drag pans, and Reset view returns the camera to the topic's start (FR-3.1 to 3.4).
- Given the toolbar, Zoom in, Zoom out and Move picture work without any gesture, each with a visible word (UX-DR10).
- Given keyboard focus on the scene, arrows rotate by 5 degrees and Shift plus arrows by 15, + and - zoom, 0 resets, Tab leaves, Esc moves to the toolbar; arrow mapping is not flipped in Urdu (FR-3.29, NFR-3.1).
- Given the first topic opened on a device, a dismissible hint says drag to rotate and pinch to zoom, and is not shown again after "Got it" (FR-2.8).
- Given Full screen, the Fullscreen API is used with a maximized-frame fallback and Esc exits (FR-3.15).
- Given a text description in the topic, "More about this picture" shows it and the scene has an accessible name and caption (FR-3.29).

### Story 2.4: 3D solid scene, sliders, live formulas and tiers
As a visitor, I want to change a solid's measurements and watch the object and the numbers change together.
- Given a `solid3d` topic, labelled dimensions (r, h, l, a, b, c) are attached to the right edges (FR-3.5).
- Given a parameter, a slider with min, max, step and unit redraws the object in under 100 ms and a typed value is accepted; a value out of range is rejected with a short message and the old value kept (FR-3.6, 3.7).
- Given a live formula, substituted numbers update with the result, for example V = (1/3) x pi x r^2 x h = 94.2 cm^3 (FR-3.8).
- Given the view toggles, solid, wireframe, transparent, labels and axes switch without resetting the camera (FR-3.9).
- Given a mid-range phone, the scene runs at 30 fps or better within the size limits (FR-3.13, NFR-1.2).
- Given no WebGL, a plain message and a static 2D image appear and steps and formulas still work; the light 2D mode is offered after 8 s (FR-3.14, NFR-4.3, AD-13).
- Given a 2D-only topic, the 3D chunk is never downloaded (NFR-1.3).

### Story 2.5: Cross-section, unfold and fill
As a visitor, I want to cut a solid, unfold it and pour into it, so that area and volume make sense.
- Given a topic that defines a cross-section, a movable plane shows the flat shape (circle, triangle, rectangle and so on) in a side panel with its measurements (FR-3.10).
- Given a topic with a net, Unfold plays forward and backward and the surface-area formula matches the net (FR-3.11, required for launch).
- Given a topic with a fill animation, pouring a cone into a cylinder shows the one-third relationship (FR-3.12).
- Given reduced motion, animations show the finished state with a Play button (NFR-3.3).

### Story 2.6: Topic page, steps, formulas and worked example
As a visitor, I want a topic page that explains the idea step by step beside the picture.
- Given a topic, the page shows path links, scene, controls, steps, formulas, worked example, Try this and Watch out, laid out as SRS 7.2: laptop two thirds and one third; phone with the viewer sticky in the top half and sliders directly beneath (FR-2.1, 2.3, UX-DR7).
- Given Previous and Next, the visitor moves through the topics of the chapter (FR-2.2).
- Given 3 to 6 steps, Next and Back change parameters, move the camera or highlight parts, and the visitor can explore freely at any time; slider values the visitor changed are kept across steps (FR-4.2, 4.3).
- Given the worked example, the visitor can change its inputs and every line recomputes (FR-4.4).
- Given any math, KaTeX renders it, in Urdu pages left-to-right inside right-to-left text, with a real minus sign (FR-3.28, AD-14).
- Given Watch out and Try this, both render when present (FR-4.5, 4.7). Sentences follow the voice rules of UX-DR15 (FR-4.6).
- Given the page at 200% text size and at 320 px width, nothing is clipped and the scene un-sticks with a "Back to picture" link (UX-DR12).

### Story 2.7: Report a problem
As a visitor, I want to tell the owner about a mistake without signing in.
- Given any topic page, "Report a problem" opens a sheet with a reason and a note (max 500 characters) and Send stores the topic id and note (FR-2.4, UX-DR9).
- Given repeated sends, the limiter slows them and duplicates for one topic are grouped (AD-26, NFR-2.8).
- Given a report, a toast says "Thank you. We will check it." and the admin sees it in Story 7.6.

### Story 2.8: Reset all, marked terms and language switch on a topic
As a visitor, I want to reset my changes, look up a term and switch language without losing my place.
- Given Reset all, sliders, example inputs and camera return to start values (FR-2.5, AD-6).
- Given a marked term, tapping it opens a short explanation in a sheet in the current language (FR-2.6).
- Given the language switch on a topic page, the step and the slider values are kept and the layout mirrors for Urdu (FR-2.7).
- Given a URL with parameters, `parseUrlState` clamps every value to range and drops unknown keys (AD-6).

## Epic 3: Scene types for Foundation and Intermediate topics

Goal: the scene types that the Foundation and Intermediate launch topics need. Each story adds one registry entry, its renderer, its `static2D`, a text description and keyboard controls (FR-3.29), formula tests against known values (NFR-6.2), and one fixture topic.

### Story 3.1: 2D graphs (`canvas2d`)
- Given functions, equations and inequalities, graphs draw with draggable points, parameter sliders, trace and zoom; intercepts, turning points and asymptotes are marked (FR-3.17).
- Given a parametric element, the sine trace and circles draw; NaN breaks the line instead of drawing a spike.
- Given two meaningful curves, they differ by dash and marker, not only color (DESIGN.md).

### Story 3.2: 2D geometry
- Given points, lines, circles and polygons, dragging updates live lengths and angles (FR-3.18).
- Given reflect, rotate, translate and scale, the transformed polygon follows the parameters.

### Story 3.3: Number and fraction models
- Given number line, place-value blocks, ten-frames, fraction bars and circles, and area models, drag and drop works by pointer and by keyboard (FR-3.19).
- Given two fraction bars, an alignment line shows that 2/4 and 1/2 reach the same length.

### Story 3.4: Algebra tools
- Given balance scales, algebra tiles, function machines and the step solver, each move is shown (FR-3.20).
- Given the step solver, every line is true at the solution; an upload with a false line fails with E_SOLVER_LINE.

### Story 3.5: Trigonometry scenes
- Given the unit circle, a draggable angle shows sine, cosine, tangent and the wave they trace, with snapping to special angles (FR-3.21).
- Given the right triangle, changing sides updates the ratios.
- Given angle values 30, 45, 60, 150 and 225 degrees, the displayed values match known values (NFR-6.2).

### Story 3.6: Statistics and probability
- Given dot plots, histograms, box plots and scatter plots with a fitted line, the data and the fit are correct against known data sets (FR-3.26).
- Given dice, coin and spinner simulations with many trials, results use a deterministic generator so the scene stays pure.
- Given the normal distribution, mean and standard deviation sliders reshape it and a shaded probability is shown.

## Epic 4: Scene types for Advanced topics

Goal: the scene types for the Advanced launch topics. Same story rules as Epic 3.

### Story 4.1: 3D axes, vectors, lines and planes (`space3d`)
- Given vectors, add, scale, dot product and cross product update live; lines and planes can be rotated and edited (FR-3.22).

### Story 4.2: Complex plane
- Given an Argand diagram, draggable numbers show addition, multiplication as rotation and scaling, polar form, powers and roots of unity (FR-3.24).

### Story 4.3: Calculus scenes
- Given a limit by zooming in, a tangent line linked to the derivative graph, Riemann sums with an adjustable number of rectangles, area under a curve and solids of revolution in 3D, each works from parameters (FR-3.25).
- Given known integrals (for example the area under x^2 from 0 to 3 is 9), the displayed values match (NFR-6.2).

### Story 4.4: Matrix transformations (required for launch)
- Given a 2x2 or 3x3 matrix applied to a grid or a 3D shape, the transformation and the determinant as area or volume are shown (FR-3.27).
- Given eigenvector topics, the invariant directions can be dragged on the grid.

### Story 4.5: Surfaces z = f(x, y) (S)
- Given a surface, rotation and parameter sliders work (FR-3.23). Built only if time allows and not required by any wave 1 topic.

## Epic 5: Math tree, search and learning map

Goal: visitors can find and move through topics.

### Story 5.1: Catalog and tree pages
- Given published topic rows (fixtures until Epic 7), `rebuildCatalog()` produces `catalog.json` from the database, never patched, and Story 7.3 reuses it (AD-20).
- Given a category, subcategory and chapter, each page shows its name and the number of topics inside, and a chapter lists topic cards with title, summary, level and the viewed mark (FR-1.2, 1.3).
- Given an unpublished or deleted topic, it appears in no list, no search and no link (FR-1.9).

### Story 5.2: Home page and the not-found page
- Given Home, it explains Visual Math in a few lines and shows the search box, the 12 categories, featured topics and Start; no login is asked anywhere (FR-1.1).
- Given a link or search that finds nothing, a friendly page appears with a way back (FR-1.10).

### Story 5.3: Search and filters
- Given the current language, search matches names, summaries and tags and returns in under a second with the category path (FR-1.4, NFR-1.5, AD-21).
- Given Urdu queries, characters are folded so alternate letter forms and digits still match.
- Given the filters, results and lists narrow by category and level and "Clear filters" resets them (FR-1.5, S).

### Story 5.4: Direct links, prerequisites and what is next
- Given a direct link, the topic opens with no login in the link's language (FR-1.6).
- Given prerequisites, the "what you need first" box lists them with links, and the page shows what to learn next (FR-1.8); prerequisites never lock a topic.
- Given the Share button, the topic link is copied and a toast confirms (FR-1.11, S).

### Story 5.5: Learning map (S)
- Given a category, a graph of chapters and topics shows prerequisites across and inside categories with viewed topics marked (FR-1.7).
- Given the map by keyboard and screen reader, a list alternative exists.

## Epic 6: Progress on the device, help and contact pages

### Story 6.1: Viewed marks on the device
- Given a visitor interacts with the scene or reaches the last step, the topic is marked viewed in `localStorage` only (FR-5.1, 5.2).
- Given a test that records network calls, marking a topic viewed makes none (FR-5.2).
- Given "Clear progress" and its confirmation, the key is deleted (FR-5.4).
- Given a corrupt or hostile stored value, it is discarded and the page works (AD-18).

### Story 6.2: My progress page
- Given viewed topics, the page lists them per category with counts and a Continue button for the last topic opened (FR-5.3).
- Given no viewed topics or progress turned off, the empty states of EXPERIENCE appear.

### Story 6.3: Help page and FAQ
- Given the Help page, it explains drag, zoom, sliders and steps with short pictures, in both languages (FR-12.1).
- Given the FAQ page, it answers the common questions (FR-12.5, S).

### Story 6.4: Contact form
- Given a message with an optional email, it is stored first and then emailed to the owner; a mail failure never loses the message (FR-12.2, AD-28).
- Given a spam-like post, the honeypot, minimum fill time and limiter stop it without a third-party CAPTCHA (NFR-2.8).

### Story 6.5: About, Privacy, Terms and the storage notice
- Given the About, Privacy and Terms pages, they exist in both languages (FR-12.3).
- Given the Privacy page, it names the one functional cookie `vm-locale` (the saved language, set only when the visitor presses the language switcher, one year, no personal data) next to the other browser storage (decided in Story 1.3, AD-17).
- Given the storage notice, it lists what is stored (including the `vm-locale` cookie), offers "Save my progress on this device" on or off, and declining removes the saved marks; a setting turns the notice on or off by country (FR-12.4, AD-17).

### Story 6.6: Plans page, free for now (S)
- Given the Plans page, it says Visual Math is free for now (FR-8.11).
- Given the waiting-list form is built, it needs explicit consent text, stores only an email in `waitlist` and is named in the Privacy page; otherwise the page has no form (PRD section 14 item 4).

## Epic 7: Admin content tools

### Story 7.1: Upload and validation
- Given one or several JSON or MD files, each is checked in stages and every problem is listed with file, field and message; an invalid file saves nothing and never touches published content (FR-9.2, 9.3, NFR-5.3).
- Given a package with an unknown field, unknown scene type, code, HTML or a URL, it is rejected (FR-9.15, NFR-2.7).
- Given a missing Urdu text, a broken formula, a parameter out of range or an unknown chapter, each gives its error code (topic-format section 5).
- Given a fixture per error code, every code is produced by exactly its fixture; valid fixtures pass (AD-27).
- Given a non-empty `quiz` field, a warning says it is ignored in version 1 (FR-11.1).
- Given a file over 1 MiB, it is rejected before it is fully read (NFR-1.4).

### Story 7.2: Drafts, versions and Preview
- Given a valid upload, a draft version is saved (FR-9.4).
- Given Preview, the topic page looks exactly like the live page, in either language, with phone and laptop frames; it is visible only to the admin, sends `noindex` and `no-store`, and is not in any public bucket (FR-9.4 to 9.6, AD-7).
- Given an upload for an existing id, a new version is saved and the published one stays live until the new one is published; earlier versions are kept (FR-9.8).

### Story 7.3: Publish, unpublish and the catalog
- Given Publish on a valid draft with both languages, the topic is in the tree, in search and open by direct link within 60 seconds; Unpublish hides it within 60 seconds in the page, the JSON URL and the catalog (FR-9.7, AD-20, proven by e2e).
- Given a failed background step, the row shows "Needs retry" and the five-minute job retries with backoff; three failures alert the owner.
- Given Publish and Unpublish run twice at once, they serialize and the end state is consistent.

### Story 7.4: Topics list, delete and restore
- Given the topics list, it shows status (draft or published), last change and language completeness, and filters by status (FR-9.12).
- Given Delete on an unpublished topic, it leaves lists and links and can be restored for 30 days; after that the daily job removes it (FR-9.11); a published topic cannot be deleted.
- Given Restore on an earlier version, a new draft is created from it; publishing stays a separate action (FR-9.9, S).

### Story 7.5: Math tree administration
- Given the tree screen, the admin creates, renames and reorders categories, subcategories and chapters with names in both languages (FR-9.10).
- Given a tree file, it is validated (unique slugs, valid parents, both languages) and loaded atomically.
- Given a change, the catalog is rebuilt through the same saga and an audit row is written.

### Story 7.6: Dashboard, reports, messages, flags and usage
- Given problem reports and contact messages, the admin sees them grouped by topic with counts, opens the topic from a report and marks each handled (FR-10.6).
- Given the feature flags and the free-topic count, the admin edits them with a confirmation; no visitor behavior changes in version 1 (FR-7.1, 10.5, AD-16).
- Given usage numbers, the dashboard shows sessions per day, topics opened, most opened topics and language split with no personal data; the page states that "visitors" are sessions (FR-10.7, S, AD-26).

### Story 7.7: Audit log and export
- Given the audit log screen, it lists who uploaded, published, unpublished, deleted, restored or changed what and when (FR-9.13).
- Given Export, all content downloads as packages as a backup and re-uploading an export reproduces the same hashes (FR-9.16, S).

### Story 7.8: Images (S)
- Given a package that references an image, it is accepted up to 2 MB and shown with alt text (FR-9.14). This is a schema version bump (AD-4) and is built only if time allows.

## Epic 8: Wave 1 content, 48 topics in English and Urdu

Goal: the 48 launch topics of SRS 5.6, each one published. Content is drafted by Claude from per-category prompts and loaded through upload; the admin is the accuracy and Urdu check (NFR-6.3, 6.4).

### Story 8.1: Topic prompts and the Urdu term list
- Given topic-format.md, one prompt per category is written that makes Claude produce 4 valid packages in JSON, with a shared Urdu math-terms list so terms stay consistent across topics.
- Given the prompts, a dry run on one topic passes the upload checks without edits.

### Story 8.2: Publish the Arithmetic and Numbers topics
- Topics: Place value blocks (F); Fractions as bars and on a number line (F); Percent and ratio with bar models (I); Powers and roots on a number line (I). Scene types: number-model.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.3: Publish the Algebra topics
- Topics: Balance-scale equations (F); Algebra tiles: expand and factor (I); Quadratics: roots and vertex with sliders (I); Polynomial roots and graphs (A). Scene types: algebra-tool, canvas2d.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.4: Publish the Geometry topics
- Topics: Shapes and symmetry (F); Area by cutting and moving shapes (F); Nets, surface area and volume (I); Cone, sphere and cross-sections (I). Scene types: canvas2d, solid3d (net, section).
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.5: Publish the Trigonometry topics
- Topics: Right-triangle ratios with a slider (I); Unit circle and the sine wave (I); Radians and arc length (A); Trig identities as shapes (A). Scene types: right-triangle, unit-circle, canvas2d.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.6: Publish the Coordinate Geometry topics
- Topics: Points and distance on a grid (F); Gradient and y = mx + c (I); Circles and their equations (I); Ellipse and parabola from a cone cut (A). Scene types: canvas2d, solid3d (section).
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.7: Publish the Functions and Graphs topics
- Topics: Function machines (F); Linear graphs from tables (F); Transformations of graphs (I); Exponential and logarithm graphs (A). Scene types: algebra-tool, canvas2d.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.8: Publish the Vectors topics
- Topics: Arrows as vectors in 2D (I); 3D vectors: add and scale (A); Dot product and angle (A); Lines and planes in 3D (A). Scene types: canvas2d, space3d.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.9: Publish the Complex Numbers topics
- Topics: The imaginary unit and the number plane (I); Argand diagram: plot and add (A); Multiplication as rotation and scaling (A); Roots of unity and De Moivre (A). Scene types: canvas2d (complex).
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.10: Publish the Calculus topics
- Topics: Rates of change as slope (I); Limits by zooming in (A); Derivative as the slope of a tangent (A); Riemann sums and the integral (A). Scene types: canvas2d (tangent, limit, riemann).
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.11: Publish the Series and Discrete Maths topics
- Topics: Patterns and skip counting (F); Arithmetic and geometric sequences (I); Counting with permutations and combinations (I); Proof by induction (A). Scene types: canvas2d (sequence, bars), stats.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.12: Publish the Statistics and Probability topics
- Topics: Pictograms and bar charts (F); Mean and median on dot plots (I); Dice and coin experiments (I); The normal distribution (A). Scene types: stats.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

### Story 8.13: Publish the Linear Algebra topics
- Topics: Systems of equations as lines and planes (I); Matrices as transformations of the plane (A); Determinant as area (A); Eigenvectors on a grid (A). Scene types: space3d, matrix-transform.
- Done when: all 4 topics are published with both languages, 3 to 6 steps, a worked example and Try this prompts (FR-4.1, 4.2, 4.7); every formula check and identity passes and the example numbers recompute (NFR-6.2); prerequisites resolve, order is easy to hard and each topic is 10 to 15 minutes (SRS 5.8); the admin has checked the math and the Urdu of each topic before Publish (NFR-6.3, 6.4). Method: draft with Claude from the category prompt, upload, fix every reported problem, preview in both languages, publish.

Note for Story 8.11: no discrete-maths scene types exist (spine, Deferred); "Counting" and "Proof by induction" are authored within `canvas2d` and `stats`. If a topic cannot be shown well, the admin may swap it for another topic of the same category and level (PRD section 8.1 allows refining the 48).

## Epic 9: Hardening and launch gates

### Story 9.1: Performance
- Given a mid-range phone on 4G, a topic page is usable within 3 seconds and scenes hold 30 fps; search answers in under 1 second (NFR-1.1, 1.2, 1.5).
- Given the budgets of the spine, CI fails above them; a topic file never exceeds 1 MB (NFR-1.4).

### Story 9.2: Accessibility
- Given an audit against WCAG 2.1 AA with keyboard-only and a screen reader on the topic page, home and admin upload, every finding is fixed or recorded with a decision (NFR-3.1, 3.2, 3.3).

### Story 9.3: Urdu and right-to-left on real devices
- Given a real Android phone and an iPhone, all 48 topics are opened in Urdu; formulas, axes and numbers stay left-to-right, nothing is clipped, and the font swap moves text by one line at most (NFR-7.3, NFR-1.6). This is a release gate.

### Story 9.4: Security review
- Given the spine's security rules, a review checks upload handling, the CSP, admin sign-in with the second step, rate limits and error leakage; findings are fixed (NFR-2.x).

### Story 9.5: Backups and restore drill
- Given the daily encrypted dump kept 30 days, a restore into a scratch project is performed and timed; the restore is documented (NFR-5.2, AD-25). Release gate.

### Story 9.6: Usability test with real people
- Given five first-time visitors, each opens and uses a topic without explanation; failures drive fixes (NFR-3.5).

### Story 9.7: Legal and privacy review
- Given the Privacy and Terms pages and the storage notice, a legal review for each target country is done and its result is applied (NFR-2.10). It is not legal advice from this document.

### Story 9.8: Launch checklist
- Given the domain and trademark check for "Visual Math" (SRS 1.6), the address is bought and set up; availability and uptime monitoring and alerts work; the usage counters work; the 48 topics are published; all gates above are green.

## Out of this build (SRS epics E10 to E12)

| Epic | Name | Requirements |
| --- | --- | --- |
| E10 | Version 2: free allowance, accounts, subscriptions | FR-7.2 to 7.11, FR-8.1 to 8.10, FR-5.5 |
| E11 | Version 2: admin subscription tools | FR-10.1 to 10.4 |
| E12 | Quizzes (later) | FR-11.2, FR-11.3 |

Version 2 switches on when the owner decides (SRS 9.2): provider, prices, legal review and enough topics. The seams in AD-16 are all that version 1 builds for it.
