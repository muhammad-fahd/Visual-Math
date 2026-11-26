---
title: Visual Math PRD (version 1)
status: final
created: 2026-11-26
updated: 2026-11-26
source-of-truth: docs/srs.md (dated Nov 25, 2026; saved 2026-11-26 12:04)
supersedes: the first PRD, built on the Axiora SRS (kept in _bmad-output/_superseded-axiora-srs/)
---

# Visual Math PRD, version 1

Owner: Fahd · Source of truth: `docs/srs.md`. Requirement IDs (FR-x.y, NFR-x.y) are the SRS IDs, unchanged. Where this PRD and the SRS differ, the SRS wins and the difference is listed in section 14.

## 0. At a glance

- **What:** a free web app where every math topic is a 3D or 2D visual a person can drag, rotate, zoom and adjust, with a short explanation beside it. English and Urdu.
- **Who:** anyone. No accounts, classes, teachers, students or schools. Open the site and start.
- **This PRD covers version 1 only.** Version 1 is free, has no visitor account and no limit. Version 2 (free allowance of 3 topics per device, subscriptions) and later work (quizzes, more languages) are out of this build, except the seams listed in section 6.
- **Launch content:** wave 1, 48 topics, 4 per category, in English and Urdu.
- **Built by:** one owner with BMAD agents and AI coding agents. One admin.
- **Biggest risks:** very large scope for one builder; AI-written math and Urdu that the admin alone must check; 3D speed on old phones.

## 1. Vision

Many people meet math only as symbols on a page: flat drawings of 3D objects, graphs that cannot be moved, formulas without a reason. Visual Math gives them a ready-made visual for every idea, so they see why before they memorize the rule.

- A beginner drags fraction bars and sees that 2/4 and 1/2 cover the same length.
- A curious adult drags a point around the unit circle, watches sine and cosine trace a wave, and sees that multiplying a complex number by i is a quarter turn.

**Why not GeoGebra or Desmos:** they are powerful but start blank, so the person must build the scene first. **Why not photo-solver apps:** they give text steps with few interactive visuals. Visual Math offers ready-made visual topics across every area of math, from the first steps to advanced ideas.

## 2. Users

| User | What they do | Notes |
| --- | --- | --- |
| Visitor | Opens any published topic, explores the visual, reads the steps, changes language | No account, no login anywhere. Low technical skill, often a mid-range phone, sometimes a child |
| Admin | Uploads topics as JSON or MD, previews, publishes, manages the math tree, reads problem reports and contact messages, switches feature flags | One person in v1. Signs in with email, password and a second step |

There are no teacher, student, parent, school or subscriber roles in version 1. (Subscriber exists from version 2.)

## 3. Release scope

**Priority key (SRS 4):** M = must for v1, S = should for v1 if time allows, V2 = version 2, L = later.

| In this build (v1) | Not in this build |
| --- | --- |
| Visual engine for every area of math (FR-3) | Free allowance of 3 topics per device (FR-7.2 to 7.11) |
| Math tree: 12 categories, subcategories, chapters, topics (FR-1, section 8) | Accounts and subscriptions, payment (FR-8.1 to 8.10) |
| Search, learning map, progress marks on the device (FR-1, FR-5) | Account progress sync (FR-5.5) |
| English and Urdu, ready for more languages (FR-6) | Admin subscription tools (FR-10.1 to 10.4) |
| Help, contact, About, Privacy, Terms, storage notice (FR-12) | Quizzes (FR-11.2, 11.3) |
| Admin panel: upload JSON or MD, validate, preview, publish, versions (FR-9) | Google login (FR-8.12), snapshot download (FR-3.16), new language without code change (FR-6.7) |
| Wave 1 content: 48 topics (section 8) | Waves 2 to 4 (about 550 more topics) |

Out of scope for all of version 1: teachers, classes, students, schools and parents as user types; native mobile apps; AI problem solving from photos; live tutoring; offline mode; content written by visitors; languages other than English and Urdu.

## 4. User journeys

**UJ-1: A shared link, in Urdu, on a phone.** A visitor taps a link a friend sent. The unit-circle topic opens in Urdu, no login, no install. A short hint says drag to rotate. They drag the point round the circle, the sine wave draws itself, and the live formula changes. They tap Next through four steps and try the "Try this" prompts. The topic is marked viewed on their phone.

**UJ-2: A beginner, from the home page.** A visitor opens Home, reads the three-line explanation and taps Start. They pick Arithmetic, then "Fractions as bars and on a number line" (Foundation). Its "what you need first" box is empty. They drag fraction bars until 2/4 and 1/2 line up. Later My progress shows what they have viewed and a Continue button.

**UJ-3: The admin publishes a topic.** The admin signs in with a code from an authenticator app. They upload a JSON file; the check lists a broken formula with file, field and message and saves nothing. They fix it, upload again, and a draft is created. They preview it in English and Urdu, in phone and laptop layout, then press Publish. Within a minute it is in the tree, in search and open by direct link. A visitor's problem report arrives; the admin unpublishes the topic, fixes it and uploads a new version while the old one stays live until the new one is published.

## 5. Features and requirements

M = must, S = should. Every row is version 1. Changes from the SRS text are in section 14.

### 5.1 Browsing and search (FR-1)
- FR-1.1 Home: short explanation, search box, 12 categories, featured topics, Start button; no login asked anywhere [M]
- FR-1.2 Math tree as category, subcategory, chapter, topic, each level with its name and topic count [M]
- FR-1.3 Chapter lists topics as cards: title, summary, level, viewed mark [M]
- FR-1.4 Search by name, summary and tags in the current language; results show category path; under 1 second [M]
- FR-1.5 Filter results and lists by category and level [S]
- FR-1.6 Any published topic opens from a direct link, no login, in the visitor's chosen language [M]
- FR-1.7 Learning map per category: graph of chapters and topics with prerequisites, viewed topics marked [S]
- FR-1.8 Each topic page shows what to learn before it and what next [M]
- FR-1.9 Unpublished topics never appear in lists, search or direct links [M]
- FR-1.10 Friendly page when a link or search finds nothing [M]
- FR-1.11 Share button copies the topic link [S]

### 5.2 Topic page (FR-2)
- FR-2.1 Scene, controls, step-by-step explanation, formulas and worked example, laid out as in section 11 [M]
- FR-2.2 Previous and Next through the chapter's topics [M]
- FR-2.3 Path (category, subcategory, chapter, topic) at the top as links [M]
- FR-2.4 Report a problem button: topic id and a short note to the admin, no login [M]
- FR-2.5 Button that resets all sliders and the camera to the topic's start values [S]
- FR-2.6 Tapping a marked math term shows a short explanation [S]
- FR-2.7 Keeps the visitor's place when the language is switched [M]
- FR-2.8 First-time hint over the scene (drag to rotate, pinch to zoom), dismissible and not shown again [M]

### 5.3 Interactive visual engine (FR-3)
One engine, many scene types, one shared scene format.
- FR-3.1 Draw 3D objects in the browser; rotate by dragging with mouse or one finger [M]
- FR-3.2 Zoom with wheel or two-finger pinch [M]
- FR-3.3 Pan with right-drag or two-finger drag [S]
- FR-3.4 Reset view button [M]
- FR-3.5 Labelled dimensions (r, h, l, a, b, c) attached to the correct edges [M]
- FR-3.6 Sliders per parameter with min, max, step, unit; smooth redraw [M]
- FR-3.7 Typed exact value beside each slider; out-of-range rejected with a short message [M]
- FR-3.8 Formulas with current numbers substituted and the result live [M]
- FR-3.9 View toggles: solid, wireframe, transparent, labels, axes [S]
- FR-3.10 Cross-section tool: movable cutting plane and side panel with the flat shape and its measurements [M]
- FR-3.11 Unfold animation (net) forward and backward [S, required by wave 1, see section 14]
- FR-3.12 Fill animation, such as pouring a cone into a cylinder [S]
- FR-3.13 At least 30 fps on a mid-range phone within the size limits [M]
- FR-3.14 Plain message and static 2D image when WebGL is unavailable [M]
- FR-3.15 Full-screen mode for a larger view or for projecting [S]
- FR-3.17 2D graphs of functions, equations and inequalities: draggable points, sliders, trace, zoom, intercepts, turning points, asymptotes [M]
- FR-3.18 2D geometry: draggable points, lines, circles, polygons; live length and angle; reflect, rotate, translate, scale [M]
- FR-3.19 Number and fraction models: number line, place-value blocks, ten-frames, fraction bars and circles, area models, with drag and drop [M]
- FR-3.20 Algebra tools: balance scales, algebra tiles, function machines, step-by-step equation solver [M]
- FR-3.21 Trigonometry: unit circle with draggable angle showing sine, cosine, tangent and the wave; right triangle with changeable sides [M]
- FR-3.22 3D axes with vectors (add, scale, dot, cross), lines and planes, rotatable and editable [M]
- FR-3.23 3D surfaces z = f(x, y) [S]
- FR-3.24 Complex-number scene: Argand diagram, addition, multiplication as rotation and scaling, polar form, powers and roots of unity [M]
- FR-3.25 Calculus scenes: limit by zooming in, tangent linked to derivative graph, Riemann sums, area under a curve, solids of revolution [M]
- FR-3.26 Statistics and probability: dot plots, histograms, box plots, scatter with fitted line, dice, coin and spinner simulations, normal distribution [M]
- FR-3.27 2x2 or 3x3 matrix applied to a grid or 3D shape; determinant as area or volume [S, required by wave 1, see section 14]
- FR-3.28 KaTeX notation everywhere, including Urdu pages, formulas left-to-right inside right-to-left text [M]
- FR-3.29 Text description and keyboard controls for every scene [S in the SRS table, but NFR-3.2 says "shall": treated as M, see section 14]
- FR-3.30 All scene types use one scene format, so a new scene type needs no topic-page change and a topic is defined entirely by an uploaded package [M]
- (FR-3.16 snapshot download is L, not in this build.)

### 5.4 Topic content and guided steps (FR-4)
- FR-4.1 Each topic has title, level, chapter, summary, learning goal, scene, steps, formulas, worked example, prerequisites, tags, in English and Urdu [M]
- FR-4.2 3 to 6 steps; a step can change parameters, move the camera or highlight part of the scene [M]
- FR-4.3 Next and Back through steps, free exploration at any time [M]
- FR-4.4 Worked example with real numbers the visitor can change [M]
- FR-4.5 Short "Watch out" note for a common mistake [S]
- FR-4.6 Short sentences and plain words for a general reader [M]
- FR-4.7 Each topic ends with 2 to 3 "Try this" prompts [S]

### 5.5 Progress on the device (FR-5)
- FR-5.1 A topic is marked viewed when the visitor interacts with its scene or reaches its last step [M]
- FR-5.2 Viewed marks are stored on the device only; no account, nothing sent to the server [M]
- FR-5.3 My progress page: viewed topics per category and a Continue button for the last topic opened [M]
- FR-5.4 Visitor can clear their progress [M]

### 5.6 Languages (FR-6)
- FR-6.1 Interface and all topics in English and Urdu, switchable any time, choice remembered [M]
- FR-6.2 Urdu uses right-to-left layout and a Nastaliq-style font, formulas left-to-right [M]
- FR-6.3 First language from the browser setting; English if unsupported [M]
- FR-6.4 A topic cannot be published without both English and Urdu text [M]
- FR-6.5 All interface text lives in language files, never in code [M]
- FR-6.6 Language in the page address so links keep it [S]

### 5.7 Free use and feature switches (FR-7.1, FR-10.5)
- FR-7.1 The free-allowance feature sits behind a feature flag that is off in v1, so every topic is free [M]
- FR-10.5 Admin can switch the feature flags (free allowance, subscriptions) and set the number of free topics [M]. In v1 these only store the setting; no visitor behavior depends on them (section 6).

### 5.8 Plans page in v1 (FR-8.11)
- FR-8.11 The Plans page says Visual Math is free for now, and may offer a waiting-list form with consent [S]. The form collects an email, which conflicts with NFR-2.2; see section 14.

### 5.9 Admin: content (FR-9)
- FR-9.1 Admin signs in with email and password; only admins see the panel; a second step (authenticator app code) [M]
- FR-9.2 Upload a content package (JSON or MD) for one topic; several files at once [M]
- FR-9.3 Every upload is checked and each problem listed with file, field and message; an invalid package is not saved [M]
- FR-9.4 A valid upload is saved as a draft with a Preview that looks exactly like the live page, in either language [M]
- FR-9.5 Preview visible only to the admin, never to visitors or search engines [M]
- FR-9.6 Preview also shows phone and laptop layouts [S]
- FR-9.7 Publish makes a draft visible in tree, search and direct links within a minute; Unpublish hides it [M]
- FR-9.8 Uploading a package for an existing topic id keeps the published version live until the new one is published; earlier versions are kept [M]
- FR-9.9 Restore an earlier version [S]
- FR-9.10 Create, rename and reorder categories, subcategories and chapters (names in both languages), or load them from a tree file [M]
- FR-9.11 Delete a topic only when unpublished; recoverable for 30 days [M]
- FR-9.12 List all topics with status, last change and language completeness [M]
- FR-9.13 Audit log of who uploaded, published, unpublished or deleted what and when [M]
- FR-9.14 Accept images referenced by a package, up to the size limit [S]
- FR-9.15 Every upload is data: only the fields and scene types in the format are accepted; no code in a package is ever run [M]
- FR-9.16 Export all content as packages, as a backup [S]

### 5.10 Admin: system (FR-10)
- FR-10.5 see 5.7
- FR-10.6 Admin sees problem reports and contact messages and marks each handled [M]
- FR-10.7 Simple usage numbers with no personal data: visitors per day, topics opened, most opened topics, language split [S]

### 5.11 Content format seam (FR-11.1)
- FR-11.1 The content package format reserves an empty `quiz` field, ignored in v1 [M]

### 5.12 Help, contact and pages (FR-12)
- FR-12.1 Help page: how to use the viewer (drag, zoom, sliders, steps) with short pictures [M]
- FR-12.2 Contact form with spam protection; messages stored and emailed to the owner [M]
- FR-12.3 About, Privacy policy and Terms pages [M] (the refund and cancellation policy is v2)
- FR-12.4 Notice about browser storage where the law requires it; visitor can decline what is not essential [M]
- FR-12.5 Short FAQ page [S]

## 6. What v1 builds for version 2 (seams only)

The SRS says subscriptions, the allowance and payment hooks "exist from the start but are switched off." In this build that means only:

- A `feature_flag` / settings store with the allowance and subscriptions flags and the free-topic count, editable by the admin (FR-7.1, FR-10.5). No visitor code reads them yet.
- Data and routes are designed so a random device id and a server-side topic count can be added later without a rebuild.
- The `quiz` field in the package format (FR-11.1).
- No device id is created, no account table is shipped, no payment code is written in v1.

## 7. Non-functional requirements (v1)

IDs are the SRS IDs. Wording is the SRS wording, shortened.

**Performance (NFR-1)**
- NFR-1.1 Topic page usable within 3 s on a mid-range phone on 4G
- NFR-1.2 Scenes at 30 fps or better on a mid-range phone
- NFR-1.3 The 3D engine and each scene type load only when needed
- NFR-1.4 Package at most 1 MB; image at most 2 MB (assumptions to confirm)
- NFR-1.5 Search answers within 1 s
- NFR-1.6 Urdu font loads without blocking text; fallback font shows first

**Security and privacy (NFR-2)**
- NFR-2.1 HTTPS everywhere
- NFR-2.2 Visitors are never asked for personal data; nothing about them is stored on the server
- NFR-2.4 Passwords stored only as strong hashes (admin)
- NFR-2.6 Admin uses a second step at login; admin actions are logged
- NFR-2.7 Uploaded packages are validated and treated as data; no uploaded code runs
- NFR-2.8 Rate limits on repeated requests, login attempts and contact-form posts
- NFR-2.10 Legal review of privacy and consumer rules in each target country before launch
- (NFR-2.3, 2.5, 2.9 are version 2.)

**Usability and accessibility (NFR-3)**
- NFR-3.1 Aim for WCAG 2.1 AA: contrast, keyboard use, focus marks, text size
- NFR-3.2 Every scene has a text description and keyboard controls
- NFR-3.3 Animations respect reduced-motion
- NFR-3.4 Simple interface text; short sentences in topics
- NFR-3.5 A first-time visitor can open and use a topic without explanation (tested with real people)

**Compatibility (NFR-4)**
- NFR-4.1 Latest two versions of Chrome, Edge, Firefox, Safari
- NFR-4.2 Phones from 360 px wide, tablets, laptops
- NFR-4.3 Without WebGL, fall back to 2D views and images

**Reliability (NFR-5)**
- NFR-5.1 Aim for 99.5% availability each month (assumption)
- NFR-5.2 Daily database backups with a tested restore
- NFR-5.3 A failed upload never changes published content
- (NFR-5.4 payment-provider outage is version 2.)

**Maintainability and content quality (NFR-6)**
- NFR-6.1 Written code standards and automated checks before merging
- NFR-6.2 Formulas and calculations in scenes tested against known values by automated tests
- NFR-6.3 Every topic checked for accuracy by a qualified person before publishing: the admin (SRS 11.3)
- NFR-6.4 Every Urdu text checked by a fluent speaker before publishing: the admin (SRS 11.3)
- NFR-6.5 Every story has acceptance tests

**Localization (NFR-7)**
- NFR-7.1 All interface text from language files
- NFR-7.2 Numbers, dates and prices follow the visitor's language and country format
- NFR-7.3 Right-to-left layout supported from the start
- NFR-7.4 A new language needs only new language files and translated content

## 8. Math catalog

Four levels: category, subcategory, chapter (usually 2 to 3 topics), topic (one idea, 10 to 15 minutes). 12 categories: Arithmetic and Numbers, Algebra, Geometry, Trigonometry, Coordinate Geometry, Functions and Graphs, Vectors, Complex Numbers, Calculus, Series and Discrete Maths, Statistics and Probability, Linear Algebra. Subcategories are the owner's to define with AI help (SRS 5.2 gives example chapters). Full coverage would be about 12 / 60 / 250 / 600; v1 ships a small part of it.

**Levels:** Foundation (starts from zero, pictures and objects), Intermediate (core methods and why they work), Advanced (deeper topics, proofs, first university-level ideas). Levels describe difficulty, not school year. Some categories, such as Complex Numbers, start at Intermediate.

**Prerequisites** advise and never lock a topic. They run inside and across categories; example: Riemann sums points back to Area of a rectangle (Geometry), What is a function (Functions and Graphs) and Sigma notation (Series and Discrete Maths).

**Rules for every topic (SRS 5.8):** prerequisites shown at the top; placed after them in category order, easy to hard; one idea; a scene, 3 to 6 steps, formulas, a worked example, Try this prompts; one chapter, one level; English and Urdu before publishing; checked for math accuracy and Urdu text by the admin; formulas covered by automated tests.

### 8.1 Wave 1: the 48 launch topics (SRS 5.6)

F = Foundation, I = Intermediate, A = Advanced. Order is easy to hard inside each category; the first topic of a category needs no prior knowledge. Chosen for strong visual impact.

| Category | Four launch topics |
| --- | --- |
| Arithmetic and Numbers | Place value blocks (F); Fractions as bars and on a number line (F); Percent and ratio with bar models (I); Powers and roots on a number line (I) |
| Algebra | Balance-scale equations (F); Algebra tiles: expand and factor (I); Quadratics: roots and vertex with sliders (I); Polynomial roots and graphs (A) |
| Geometry | Shapes and symmetry (F); Area by cutting and moving shapes (F); Nets, surface area and volume (I); Cone, sphere and cross-sections (I) |
| Trigonometry | Right-triangle ratios with a slider (I); Unit circle and the sine wave (I); Radians and arc length (A); Trig identities as shapes (A) |
| Coordinate Geometry | Points and distance on a grid (F); Gradient and y = mx + c (I); Circles and their equations (I); Ellipse and parabola from a cone cut (A) |
| Functions and Graphs | Function machines (F); Linear graphs from tables (F); Transformations of graphs (I); Exponential and logarithm graphs (A) |
| Vectors | Arrows as vectors in 2D (I); 3D vectors: add and scale (A); Dot product and angle (A); Lines and planes in 3D (A) |
| Complex Numbers | The imaginary unit and the number plane (I); Argand diagram: plot and add (A); Multiplication as rotation and scaling (A); Roots of unity and De Moivre (A) |
| Calculus | Rates of change as slope (I); Limits by zooming in (A); Derivative as the slope of a tangent (A); Riemann sums and the integral (A) |
| Series and Discrete Maths | Patterns and skip counting (F); Arithmetic and geometric sequences (I); Counting with permutations and combinations (I); Proof by induction (A) |
| Statistics and Probability | Pictograms and bar charts (F); Mean and median on dot plots (I); Dice and coin experiments (I); The normal distribution (A) |
| Linear Algebra | Systems of equations as lines and planes (I); Matrices as transformations of the plane (A); Determinant as area (A); Eigenvectors on a grid (A) |

The SRS says to refine the 48 with AI help during the PRD step. No change is proposed here; the one finding is that three of the 48 need scene types the SRS marks S (section 14).

### 8.2 Content package (SRS 5.7)

One file per topic, JSON or MD, both read into one internal form. Fields: `id`, `path` (category, subcategory, chapter), `title`, `summary`, `goal` (English and Urdu), `level`, `tags` (both languages), `prerequisites`, `scene` (type, parameters with name, label, min, max, step, unit, default; camera start; options), `steps` (3 to 6), `formulas` (LaTeX with a label in both languages), `example`, `tryThis` (2 to 3), `quiz` (reserved, empty in v1). Ids never change once published. A package with an unknown field or scene type is rejected (FR-9.3, FR-9.15). The exact schema is fixed in `architecture/.../topic-format.md`.

## 9. Data (SRS 6, version 1 entities)

Category, Subcategory, Chapter (names in English and Urdu, order); Topic (chapter, title and summary in both languages, level, status draft or published, current version, content wave); TopicVersion (topic, package content, created at and by, published at); TopicPrerequisite; ContentUpload (file, accepted or rejected, problems, who, when); Asset; FeatureFlag and Setting; ProblemReport (topic id, note, created at, handled); ContactMessage (optional email, message, created at, handled); AdminUser (email, password hash, second-step secret); AuditLog. Version 2 adds Device, User, Plan, Subscription, PaymentEvent, ProgressRecord.

Rules: a visitor's progress lives only in the browser and the server holds no personal data about visitors; published topics are never edited in place, a new version is made and published; deleted topics stay recoverable for 30 days; daily database backups kept at least 30 days (assumption).

## 10. Screens (SRS 7.1, version 1)

Visitor: Home; category and subcategory pages; chapter page; topic page; search results; learning map; My progress; Help; About, Privacy, Terms; Contact; Plans (free for now, optional waiting list). Admin: dashboard (counts, flags, recent problems); topics list; upload; preview; math tree; reports and messages; audit log. Version 2 screens (free topics used, sign up and login, account, admin subscribers) are not built.

## 11. Topic page layout (SRS 7.2, fixed)

The topic page decides whether the product feels good.
- **Laptop and projector:** viewer on the left two thirds; step text, sliders and formulas in the right third.
- **Phone, portrait:** viewer in the top half and kept visible while the page below scrolls; sliders directly under it.
- **Controls:** buttons at least 44 px tall; slider handles large enough for a finger.
- **Urdu:** the whole layout mirrors; the viewer and formulas keep their own direction.

## 12. Success measures (SRS 9.3)

Free period: visitors per week, topics opened per visit, share of visitors who come back, most opened topics. No numeric targets are set. Version 2 measures (share reaching the fourth topic, share who subscribe) are not part of this build.

## 13. Risks

| Risk | Response |
| --- | --- |
| Scope is large: 12 categories, basics to advanced, two languages | Release in waves; 48 topics at launch; epics split into small stories |
| About 600 topics eventually; content cost exceeds software cost | Package format and admin tools let AI-drafted topics be uploaded fast |
| AI-written math may contain mistakes; Urdu text may be wrong | The admin checks every topic's math and Urdu before publishing (NFR-6.3, 6.4); automated formula tests (NFR-6.2); Report a problem plus instant unpublish. One person is the only gate, accepted for v1 |
| 3D is slow on old phones | 2D fallback, size limits, tests on a mid-range phone |
| Urdu and right-to-left are hard to get right with math | Build right-to-left from day one; real-device checks |
| The name "Visual Math" is generic, hard to trademark and to find | Check domain and trademark before buying the address |
| Visitors may include children | Store almost nothing; legal review before launch |
| One admin is a single point of failure | Accepted for v1; backups and the audit log |

## 14. Where this PRD departs from or interprets the SRS

1. **S items that wave 1 needs.** Three launch topics depend on features the SRS marks S: "Nets, surface area and volume" needs FR-3.11 (unfold); "Matrices as transformations of the plane", "Determinant as area" and "Eigenvectors on a grid" need FR-3.27 (matrix transformations). The SRS also puts all 48 in v1. Decision: treat FR-3.11 and FR-3.27 as required for launch. Alternative if time runs out: swap those topics for others (the owner may).
2. **FR-3.29 versus NFR-3.2.** The FR is S, the NFR says "shall". Treated as M.
3. **FR-9.1 versus NFR-2.6.** FR says the second step "should" be required, NFR says admin accounts "shall" use one. Treated as M.
4. **FR-8.11 waiting list versus NFR-2.2.** A waiting-list form stores an email. It is an S item; if built, it needs explicit consent text and a place in the privacy policy. Left to the owner.
5. **Browser floor.** The SRS says the latest two versions. The stack's build targets are wider than that, so no conflict.
6. **Content review.** The SRS makes the admin the accuracy and Urdu check (SRS 11.3). The first PRD had no reviewer, a second Claude pass and 120 launch lessons by owner decision; those are superseded by the SRS.
7. **Terms.** The SRS word is "topic"; the first PRD used "lesson".

## 15. Open items for the owner

1. Domain and trademark check for "Visual Math" (SRS 1.6).
2. Confirm the suggested services (SRS section 3) in the architecture; the architecture records its choices and one deviation (first-party analytics and error log instead of Plausible and Sentry).
3. Whether to build the waiting-list form (item 4 above).
4. Confirm package (1 MB) and image (2 MB) limits against real scenes (SRS 11.2).
5. Legal review of privacy and consumer rules per target country before launch (NFR-2.10).
6. Success targets with numbers (the SRS sets measures only).

## 16. Glossary

Terms follow SRS 1.4: Visitor, Admin, Category, Subcategory, Chapter, Topic, Level, Learning map, Scene, Scene type, Parameter, Content package, Preview, Publish, Device, Content wave, Feature flag, RTL, WebGL.
