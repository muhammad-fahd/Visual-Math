---
title: Visual Math Experience (version 1)
status: final
updated: 2026-11-26
sources:
  - docs/srs.md
  - _bmad-output/planning-artifacts/prds/prd-Visual Math-2026-11-26/prd.md
supersedes: first EXPERIENCE spine built on the Axiora SRS (kept in _bmad-output/_superseded-axiora-srs/)
---

# Visual Math: Experience Spine, version 1

> Paired with DESIGN.md (visual identity, unchanged). This spine owns behavior; where they differ on looks, DESIGN.md wins. Both spines win on any conflict with a mock or the theme file. Inferred decisions are tagged [ASSUMPTION].

## Foundation

Form factor: a mobile-first web app, 360 to 1920 px, one codebase. Two audiences share it: visitors (everything public) and one admin (laptop first). Languages: English (LTR) and Urdu (RTL). No external UI system: components are built in-house from DESIGN.md tokens. Light mode is the default and dark mode is fully supported, via a toggle or follow-system, remembered on the device. There is no sign-in for visitors, no account, no class and no quiz in version 1. Privacy-first: no ads, no third-party tracking, plain simple language (NFR-3.4).

Browser support follows NFR-4.1 to 4.3. Where WebGL is missing or the device is weak, a light 2D mode is used (State Patterns).

Visual references (illustration only, drawn before the SRS update; ignore their quiz button, Present mode and sign-in elements): palette [color-themes-1.html](.working/color-themes-1.html); mocks [topic on a phone](.working/key-lesson-phone.html) and [library on a phone](.working/key-library-phone.html).

## Information Architecture

| Screen (SRS 7.1) | Reached from | Purpose |
|---|---|---|
| 1 Home | App open; the site name in the top bar | Three-line explanation, search box, the 12 categories, featured topics, Start button, language switch |
| 2 Category and subcategory pages | Home category; nav "Topics" | Subcategories and chapters with topic counts |
| 3 Chapter page | Category page; topic path | Topic cards with level, summary and viewed mark |
| 4 Topic page | Chapter card; search result; map node; shared link; Continue; Previous and Next | Scene, controls, live formulas, steps, worked example, Try this, Previous and Next, Report a problem |
| 5 Search results | Search box (Home, top bar) | Results with category path; filters by category and level |
| 6 Learning map | Nav "Map"; topic page "What to learn before and next" | One graph per category with prerequisites and viewed marks |
| 7 My progress | Nav "My progress"; Home "Continue" | Viewed topics per category, Continue, Clear progress |
| 8 Help | Nav "More"; first-visit hint; footer | How to use the viewer, short pictures; FAQ (S) |
| 9 About, Privacy, Terms | Footer; nav "More"; storage notice | Static pages |
| 10 Contact | Nav "More"; footer | Contact form |
| 11 Plans | Footer; nav "More" | "Visual Math is free for now"; waiting-list form if built (S) |
| 15 Admin: dashboard | Admin sign-in | Counts, feature flags, recent problems, usage numbers |
| 16 Admin: topics | Admin nav | List with status and language completeness; open, preview, publish, unpublish, restore a version, delete |
| 17 Admin: upload | Admin nav | Choose files; list of problems; draft created |
| 18 Admin: preview | Topics list row | The topic page as visitors will see it, in either language, phone and laptop frame |
| 19 Admin: math tree | Admin nav | Create, rename and reorder categories, subcategories, chapters; load a tree file |
| 21 Admin: reports and messages | Admin nav; a report links to its topic | Problem reports and contact messages, mark handled |
| 22 Admin: audit log | Admin nav | Who changed what and when |

Screens 12 to 14 and 20 (free topics used, sign up and login, account, admin subscribers) are version 2 and not designed here.

Navigation model. Phone: a bottom `nav-bar` of four labelled items: Home, Topics, Map, My progress; a fifth "More" opens a bottom sheet with Help, Contact, About, Privacy, Terms, Plans, language and theme. No hamburger drawer. Tablet and up: the same items in a top bar, with the search box. The topic page hides the bottom nav to give the scene room and shows a Back arrow with the word "Back" and a "Menu" button; sheets stack one level deep. Admin screens use a side list on laptop and an "Admin" bottom-sheet menu on phone; admin is built for laptop first, phone only needs to work. [ASSUMPTION: the nav labels and the "Topics" item; the SRS lists screens, not navigation.]

Direct links. A topic link opens the topic page directly, no login, in the language in the link; with none, the saved language, else the browser language, else English (FR-1.6, 6.3, 6.6). The "Start" button opens the category list. [ASSUMPTION: Start opens "Topics".]

Home and topics layout (mock: [library on a phone](.working/key-library-phone.html)): categories as plain section headings with the topic count ("Geometry (4 topics)"), each followed by its `topic-card` list; search field at the top; filter chips (category, level) on the search results and list screens (S). Categories are not collapsible cards or tabs.

## Voice and Tone

Microcopy only; brand voice is in DESIGN.md. Short sentences, everyday words, no jargon without a pop-up, no exclamation marks, no shaming. Errors say what happened and what to do. Urdu is written natively, not word by word.

Length rules (NFR-3.4): Foundation sentences are 12 words or fewer, one idea per sentence; Intermediate up to 18; Advanced up to 25. Hard words get a plain alternative first ("slice" before "cross-section").

| Moment | English | Urdu (draft) |
|---|---|---|
| Start | "Start" | "شروع کریں" |
| Step | "Step 2 of 5" | "مرحلہ 2 از 5" |
| Slider range error | "Pick a number from 1 to 10." | "1 سے 10 کے درمیان عدد چنیں۔" |
| Nothing found | "Nothing found. Try another word or clear the filters." | "کچھ نہیں ملا۔ کوئی اور لفظ آزمائیں یا فلٹر ہٹائیں۔" |
| Topic not available | "This topic is not available. Try another topic." | "یہ موضوع دستیاب نہیں ہے۔ کوئی اور موضوع آزمائیں۔" |
| First-time hint | "Drag to turn the picture. Pinch to zoom." | "تصویر گھمانے کے لیے کھینچیں۔ بڑا کرنے کے لیے دو انگلیوں سے پھیلائیں۔" |
| Report sent | "Thank you. We will check it." | "شکریہ۔ ہم اسے دیکھیں گے۔" |
| Free plan | "Visual Math is free for now." | "ویژول میتھ فی الحال مفت ہے۔" |
| Privacy | "No ads. We do not sell your data." | "کوئی اشتہار نہیں۔ ہم آپ کا ڈیٹا فروخت نہیں کرتے۔" |
| Progress saved on device | "Your progress is saved on this device only." | "آپ کی پیش رفت صرف اسی ڈیوائس پر محفوظ ہے۔" |
| No WebGL | "Your device can't show the 3D picture. Showing a simple picture instead." | "آپ کی ڈیوائس 3D تصویر نہیں دکھا سکتی۔ سادہ تصویر دکھائی جا رہی ہے۔" |

Don't: "Oops! Something went wrong!", "Error 500", streak or praise popups. The Urdu column is draft only: the real strings live in the i18n source, are written natively and checked by the admin (NFR-6.4). Admin screens are English only. [ASSUMPTION]

## Component Patterns

Behavioral. Visual specs are in DESIGN.md.Components. Names match the YAML names there.

| Component | Use | Behavioral rules |
|---|---|---|
| `button-primary` | One main action per view | Never disabled without a visible reason line. Foundation uses `button-primary-foundation`. Shows "Working..." and ignores repeat taps while a request runs. |
| `button-secondary` | Second action beside a primary (Back, Cancel) | Same size variants. Never the only action in a view. In a pair it sits on the leading side (the right in Urdu). |
| `button-text` | Low-weight actions: Retry, Clear filters, Report a problem, Cancel | Underlined; 44px target. Never starts a destructive action alone. |
| `button-destructive` | Delete topic, Clear progress | Always opens a `dialog` first. Never the default-focused button. |
| `text-input` and form field | Contact form, admin sign-in, tree editor, typed slider value | Visible label always; help line under the field. Validates on blur and on submit, never per keystroke. On submit with errors: a summary banner at the top lists each problem as a link to its field, focus moves to the first bad field. Errors say the fix. Entered text is kept after an error. Admin password has a "Show password" toggle with a word. Required fields are labeled "(required)". Paste is always allowed. |
| `search-field`, `filter-chip` | Home, search results, topic lists | Search runs on Enter or after a 400 ms pause; results count announced ("12 topics found"); answers within 1 second (FR-1.4). Chips toggle on Space or Enter, are multi-select within a group, show a check when on. "Clear filters" resets all and keeps the search text. State survives Back from a topic. |
| `topic-card` | Chapter page, search results, Home, map | Whole card is one tap target to the topic. Shows title, summary, level badge, minutes and the viewed mark. Foundation cards use the larger target and type. |
| `dashboard-card` | My progress, admin dashboard | Heading plus one number or list; read-only except a single "View" text button. Progress as bar plus text. Loading shows `skeleton`. |
| `data-table` | Admin topics, reports, messages, audit log, upload results | Real column headers; sort buttons announce "sorted ascending". Row actions are text buttons with the row name in the accessible name ("Preview Unit circle"). Pagination at 25 rows. On phone rows stack. |
| `banner` | Storage notice, upload result, admin session ending, offline | Stays until the condition ends or the user taps Dismiss; error banners are announced (`role="alert"`), others politely. Never auto-dismiss. |
| `dialog` | Delete topic, Unpublish, Clear progress | Opens with focus on the safe button (Cancel); focus trapped, page behind inert; Esc and Cancel close it and return focus. Heading says exactly what will happen. Not used for information. |
| `upload-zone` | Admin upload, tree file load | "Choose files" button opens the picker (drag and drop is extra). Accepts JSON or MD; several files at once (FR-9.2). Shows each file's name and size, progress as text, and Remove. Checks type and size (1 MB) before upload. Results are a `data-table` with passed or failed per file and, for each problem, the file, field and message (FR-9.3). A failed file saves nothing. |
| `skeleton` | Any list or card still loading | Shows after 300 ms with visible text such as "Loading topics". Replaced in place without layout shift. Static under reduced motion. |
| `scene-frame` | Topic page | Holds one scene. Never traps keyboard focus (Tab leaves, Esc moves to the toolbar). Visible caption plus a "More about this picture" disclosure with the long description (FR-3.29). Shows the first-time hint once (FR-2.8). |
| `toolbar-button` | Reset view, Full screen, view toggles, Zoom in, Zoom out, Move picture | Icon plus visible word always. Zoom and Move picture are the non-drag alternative to pinch and drag. |
| `slider` | Topic page | Updates scene and formulas in under 100 ms. Typed value accepted (either digit set, normalized); out-of-range rejected with a message, old value kept (FR-3.7). Arrow keys step by the declared step; PageUp and PageDown by 10 steps; Home and End jump to min and max. Foundation uses `slider-foundation`. |
| `step-bar` | Topic page | Next and Back never lose slider values; focus stays on the pressed button and the new step title is announced. The worked example has editable inputs with the same typed-value rules; its lines recompute live (FR-4.4). The language switch keeps the step (FR-2.7). |
| `bottom-sheet` | Marked-term explanation (FR-2.6), Report a problem, language, theme, More | Close button, swipe down, Esc. Focus trapped, page behind inert, returns focus to the trigger. |
| `toast` | Report sent, link copied, saved | One at a time, 8 seconds, pauses on hover and focus, also written to the live region, never the only signal of an error. |
| `level-badge-*` | Cards, topic header | Display only. |
| `nav-bar` | Whole visitor site except the topic page | Current item has `aria-current`. |

### Confirm and undo

- **Unpublish** (admin): dialog "Unpublish this topic? Visitors will see 'This topic is not available.'" After: toast with "Publish again".
- **Delete a topic** (admin, only when unpublished): dialog "Delete this topic? You can restore it for 30 days." After: toast with Undo; the topic list shows it under "Deleted" until the 30 days end (FR-9.11).
- **Clear my progress** (visitor): dialog "Clear your progress on this device? This cannot be undone." No undo (FR-5.4).
- **Publish** needs no dialog (it is reversible by Unpublish). Switching a feature flag asks for confirmation because it changes behavior for all visitors later.
- Easy-to-reverse actions (language, theme, filters) have no dialog.

### Form validation

Validate on blur for format and on submit for everything; show errors in the field and in the top summary; never clear a field. Server errors that are not about a field show in a `banner-error` above the submit button. A long request shows "Working..." on its button and stays editable only when the request fails. The contact form has a honeypot and a minimum fill time, with no CAPTCHA; a message that looks like spam is accepted silently and not shown to the admin.

## State Patterns

| State | Where | Treatment |
|---|---|---|
| Loading topic | Topic page | Page shell, path and steps show first as text. The scene frame shows a calm `skeleton` and "Loading the picture". Usable in 3 s on 4G (NFR-1.1). Past 8 s, offer the light 2D mode. [ASSUMPTION: 8 s threshold.] |
| Loading list | Home, topics, map, search | `skeleton` cards; no spinner-only screens. After 10 s: `banner-error` "This is taking longer than usual" with Retry. |
| Empty | Search, lists (FR-1.10) | "Nothing found. Try another word or clear the filters." Button: Clear filters; a link to Topics. |
| Empty | My progress | "You have not viewed any topic yet. Pick your first one." Link to Topics. |
| Empty | Admin lists | "Nothing here yet." plus the one action that fills it (Upload a topic); for reports "No reported problems." |
| Not available | A link to an unpublished or deleted topic (FR-1.9) | Friendly page: "This topic is not available. Try another topic." with a link to its chapter or to Topics. Same page for a wrong link. |
| Error | Any fetch | Plain message, cause if known, and Retry; the rest of the page stays usable. |
| Offline | Any | A new page cannot load: the Error state with Retry. Already loaded topics keep working because the scene runs in the browser; Report and Contact show "No internet. Try again when you are back online." Offline mode is out of scope. |
| No WebGL or weak device | Topic page | Message "Your device can't show the 3D picture. Showing a simple picture instead." with a static 2D image (FR-3.14) and, where the scene has it, the light 2D mode. Steps, formulas and worked example still work. A "Try 3D again" link is offered. |
| Phone landscape | Topic page, phone | The scene is not sticky; scene and panel sit side by side (scene 60%, panel 40%, panel scrolls). Full screen is the preferred way to see the scene large. [ASSUMPTION: split values.] |
| Urdu font loading | Urdu pages | Fallback font shows at once; the swap moves text by no more than one line (NFR-1.6). |
| Storage notice | First visit, where required | A `banner` lists what is stored (language, theme, hint, progress) with "Save my progress on this device" on or off; Privacy link. Declining turns progress off and removes the saved marks; everything else is essential. Whether it shows at all is a setting, decided by the legal review (NFR-2.10). |
| Progress off | My progress | "Progress is off. Turn it on to see what you have viewed." with a button. |
| Report a problem | Every topic page | A "Report a problem" text button opens a bottom sheet: reason (Wrong math, Wrong picture, Urdu mistake, Other), a short note (max 500 characters), Send. No login. Result: toast "Thank you. We will check it." [ASSUMPTION: the reason list; the SRS only requires the topic id and a short note.] |
| Missing translation at runtime | Any topic string | Cannot occur for published topics (FR-6.4). If a string is missing anyway, show English in its own LTR line with `lang="en"` and log the error. |
| Upload in progress | Admin upload | File rows show progress ("3 of 10 files"); the result table fills as each file finishes; Cancel stops the rest. Closing the page warns. Finished: "8 saved as drafts, 2 not saved" in a banner with the table below. |
| Admin sign-in failure | Admin sign-in | Banner "That email or password is not right, or the code is wrong." Same message for every cause. After repeated failures the form locks with the wait shown as text (NFR-2.8). |
| Admin session ending | Admin screens | A `banner` 2 minutes before expiry with "Stay signed in"; if it ends, a dialog "You were signed out. Sign in to carry on." and the user returns to the same screen. |
| Publish in progress | Admin topics | Row shows "Publishing..." then "Published" within a minute; if the background step fails, the row shows "Needs retry" with a Retry button (FR-9.7). |

## Interaction Primitives

- **Drag to rotate** (one finger or mouse): rotates the 3D scene; 2D scenes drag-pan where the scene allows. Page scroll is not hijacked on phones: the sticky scene takes drags inside its frame, and the area beneath scrolls as normal.
- **Pinch, wheel, two-finger** zoom (FR-3.2). Two-finger drag or right-drag pans where allowed (FR-3.3, S). Every drag, pinch and wheel gesture also has a button in the scene toolbar (Zoom in, Zoom out, Move picture), so nothing needs a gesture.
- **Slider**: drag the thumb, tap the track, or type the exact value. Values snap to step.
- **Reset view**: one tap returns the camera to the topic's start view (FR-3.4). **Reset all** (FR-2.5, S) also restores sliders and the example inputs.
- **Focus order on the topic page** (DOM order, the same in English and Urdu): skip link "Skip to topic", Back, Menu, scene frame, scene toolbar, sliders and typed values, step bar (Back, Next), formulas, worked example inputs, Try this, Previous and Next topic, Report a problem.
- **Keyboard alternatives** (NFR-3.1, 3.2): Tab reaches the scene frame; when focused it shows the visible line "Arrow keys turn the picture. Esc leaves." Arrow keys rotate by 5 degrees, Shift plus arrows by 15, + and - zoom, 0 resets. Tab always leaves the scene frame. **Esc** moves focus from the scene frame to the first toolbar button; Esc from the toolbar moves to the first slider; Esc inside a sheet, dialog or tooltip closes only that layer and returns focus to its trigger. The scene frame has `role="application"` only while focused. Slider: arrows, PageUp, PageDown, Home, End; in RTL the slider follows the visual direction (Left toward the end on the left, Right toward the end on the right; Up and Down always increase and decrease). Step buttons flip in RTL; arrow-key rotation of the scene is never flipped.
- **Full screen** (FR-3.15, S): the browser Fullscreen API with a maximized-frame fallback; Esc exits. The topic page layout is kept.
- **Reduced motion** (`prefers-reduced-motion`, plus an in-app "Reduce motion" switch in More that follows the OS value by default, NFR-3.3): no auto-rotate, no easing on camera moves (jump to the reset view), fill, unfold and sine-wave animations show the finished state with a Play button ("Play the drawing"), sheets and dialogs appear without sliding, skeletons are static, step changes are instant. Any motion that runs for more than 5 seconds has a Pause button. Meaning never depends on motion.
- **First-time hint** (FR-2.8): a short line over the scene on the first topic opened on a device; dismissible with a "Got it" button and not shown again (remembered on the device).
- **Banned**: gesture-only actions with no button, hover-only information, icon-only buttons, time limits, auto-playing sound, streak or badge popups.

## Accessibility Floor

Behavioral. The contrast table and every ratio are in DESIGN.md.Colors. Target: WCAG 2.1 AA (NFR-3.1). Text 4.5:1; controls, focus rings and scene lines 3:1; any new color pair is added to the DESIGN.md table first.

- Every interactive element has an accessible name, role and state. No icon-only buttons.
- **Scene for assistive tech** (FR-3.29, NFR-3.2). The scene container has `role="img"` with an accessible name (the topic title plus "interactive picture") and `aria-describedby` pointing to the visible caption; a "More about this picture" disclosure holds a longer description (what the shape is, what each slider changes, what to notice). While focused for rotating it switches to `role="application"` and shows the visible hint line. Camera rotation is not announced; meaningful state changes (a new view, a reset) are.
- **Live region.** One polite region for the topic page. Slider and formula changes are announced after the user stops for 500 ms (debounced), as plain words with units: "Angle 30 degrees. Sine equals 0.5." Typed values announce on Enter. Sliders carry `aria-valuetext` with the unit. Formulas expose KaTeX's MathML output.
- **Toasts and banners.** A toast lasts 8 seconds, pauses on hover and focus, and is written to the live region. Anything that reports an error or that the user must act on is a persistent banner or field message, never a toast alone. Error banners use `role="alert"`.
- Feedback never by color alone: errors and notes carry a word and an icon and a 2px border style (DESIGN.md.Components).
- Keyboard-only use covers every screen; arrow-key rotation works in every 3D scene. Visible 3px focus ring with the mandatory 2px offset. Bottom sheets and dialogs trap focus and make the background inert. `scroll-padding-top` keeps a focused control out from under the sticky scene.
- Touch targets at least 44 px (48 px for Foundation topics), 8 px apart. SRS 7.2: buttons at least 44 px tall.
- **Zoom and reflow.** Text resizes to 200% without loss. At 320 CSS px wide, at 400% zoom, or when the viewport is under 480 CSS px wide or under 400 CSS px tall, the sticky scene stops being sticky and scrolls with the page, with a "Back to picture" jump link in the panel (WCAG 1.4.10). Heights are minimums and type is in rem. Test list: 320 px at 400%, phone landscape at 200%, Urdu at 200%.
- **Cognitive load for children.** Foundation: one idea per step, no more than 3 controls visible in a step besides Back and Next, no timers, sentences of 12 words or fewer, a picture or pop-up for every hard term; icons always have words.
- Language and direction attributes are set per element: the page `lang` and `dir` follow the chosen language; formulas and the scene are `dir="ltr"`; foreign-language spans carry their own `lang`; the language switcher shows "English" and "اردو" each in its own language.
- No time limits; no flashing content. Dark and light modes meet the same checks.

## Responsive & Platform

| Form | Behavior |
|---|---|
| Phone, 360 to 767 | Bottom nav bar. Topic page (mock: [topic on a phone](.working/key-lesson-phone.html)): scene sticky in the top half, sliders directly beneath (SRS 7.2), then steps, formulas, worked example and Try this. Gutter `{spacing.gutter-mobile}`. Topics are single-column lists under plain category headings. Landscape: scene not sticky, split layout. Below 480 CSS px effective width (zoom) the scene is not sticky. |
| Tablet, 768 to 1023 | Top bar. Topic page two columns in landscape (scene 2/3, panel 1/3), phone layout in portrait. [ASSUMPTION] |
| Laptop, 1024 to 1439 | Scene left two thirds; right third holds step text, sliders and formulas (SRS 7.2). Topic lists in a 2 to 3 column grid. Admin screens are designed here first. |
| Wide and projector, 1440 to 1920 | Same two-thirds and one-third layout; content max width 1200 px outside the topic page. Full screen gives the scene the whole window. |

RTL mirroring rules (Urdu), one principle: things that show **order or sequence** of the interface mirror; things that show a **quantity, a position in the math or a code** never mirror (SRS 7.2: "the viewer and formulas keep their own direction").
- Mirrored: page chrome, nav bar order, text panel position, step Back and Next arrows, list alignment, form labels, the **value slider track** (min on the right), step and progress bars, chevrons and back arrows.
- Never mirrored: the scene and its camera controls, axes and labels, formulas (KaTeX), numbers and units (including the slider's typed-value box and value label), graph direction, number lines and the unit circle, the arrow-key rotation mapping, media icons.
- [DECISION by the facilitator, to confirm with Urdu users: the value slider track mirrors with the page in Urdu while the numbers it shows and the scene's own axes do not. If Urdu users find the mismatch confusing, the fallback is a non-mirrored slider; the rest does not change.]
- Mixed text: inline formulas are isolated with `<bdi>` or `unicode-bidi: isolate` and `dir="ltr"`, holding the whole formula, its units and any trailing punctuation, with a real minus sign (U+2212). The typed-value box accepts both digit sets and normalizes them.
- Urdu line height is larger (DESIGN.md.Typography); cards and buttons grow in height rather than clip text.

Dark mode: follows the system by default; a toggle in More offers Light, Dark, System, remembered on the device. Switching is instant with no reload and no scene reset; the scene recolors with the `-dark` tokens. The scene frame keeps its `{colors.surface-dark}` background. No flash of the wrong theme on load.

## Key Flows

### Flow 1: A shared link, in Urdu, on a phone (UJ-1)

1. A friend sends a link on WhatsApp. It opens the unit-circle topic in Urdu, no login, no install.
2. The page shell, path and steps appear first in the fallback Urdu font; the scene follows. A short hint says drag to rotate and pinch to zoom; the visitor taps "Got it".
3. They drag the point round the circle; the sine wave draws itself beside it and the live formula changes. Scene and formula stay LTR.
4. They tap Next through the steps and try the "Try this" prompts.
5. **Climax:** the sine wave they made is on screen, the formula shows the numbers for their angle, and the topic is marked viewed on their phone.

Failure: no WebGL, so they get the static picture and the steps still work. A wrong Urdu word can be reported in two taps.

### Flow 2: A beginner finds fractions (UJ-2)

1. Home: the visitor reads three lines, sees the 12 categories and taps Start.
2. Topics: Arithmetic and Numbers, then the chapter, then "Fractions as bars and on a number line". Its "what you need first" box is empty.
3. They drag fraction bars until 2/4 and 1/2 line up; the Foundation type and 48 px controls are used.
4. They open My progress: the topic is marked, and Continue takes them back to it.
5. **Climax:** two bars of different cuts end at the same length, and the live formula says 2/4 = 1/2.

### Flow 3: Search and language switch

1. The visitor types "circle" in the search box. Results appear in under a second, each with its category path; they filter by level.
2. They open a topic in English, tap the language switch, and the page changes to Urdu and mirrors, on the same step with the same slider values.

### Flow 4: The admin publishes a topic (UJ-3)

1. The admin signs in with email, password and the authenticator code (first time: a setup screen with a QR code and recovery codes).
2. Admin upload: they choose three JSON files; one fails with "trig-radians.json#/formulas/1/latex [E_LATEX_PARSE] ..." and saves nothing; two become drafts.
3. In Admin topics they open Preview for a draft, switch English and Urdu, and switch phone and laptop frames; they check the math and the Urdu text.
4. They press Publish; within a minute the row says "Published" and the topic is in the tree, in search and open by link.
5. Later a visitor's problem report arrives in Admin reports; its link opens the topic in admin.
6. **Climax:** one tap on Unpublish (and Confirm) removes the reported topic from visitors; a visitor's link now shows "This topic is not available." The admin fixes it, uploads a new version (the old stays live until the new is published), previews and publishes it.

Second beat: the admin opens Admin math tree to rename a chapter, and the dashboard to read usage numbers and see both feature flags off.

Failure: an invalid file lists the file, field and message and saves nothing; published topics never change from a failed upload (NFR-5.3).

### Flow 5: A visitor reports a problem and contacts the owner

1. On a topic the visitor taps "Report a problem", picks "Wrong math", adds a note, taps Send; a toast says "Thank you. We will check it."
2. From More they open Contact, fill the form and send; the message is stored and emailed to the owner.

## Open items

Surface closure: every SRS 7.1 screen for version 1 appears in the Information Architecture and in a flow or state; version 2 screens are marked. Inline [ASSUMPTION] tags are inferred defaults; only these are open:

1. Urdu text in this spine and in the flows is AI-drafted; the admin checks it (NFR-6.4).
2. The Urdu slider decision (above) needs confirming with Urdu users before the slider story is built.
3. Whether the waiting-list form on Plans is built (PRD section 14 item 4); it is not designed here.
4. Whether the storage notice is shown at all, by country (NFR-2.10).
5. Whether Start opens "Topics" or a first topic (assumed "Topics").
