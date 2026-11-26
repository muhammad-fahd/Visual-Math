---
title: Visual Math Design
status: final
updated: 2026-11-26
change-note: Colors, type, spacing and shape tokens are unchanged. Components for features not in version 1 (quiz, code fields, math keyboard, Present mode variants) were removed after the SRS update.
sources:
  - _bmad-output/planning-artifacts/prds/prd-Visual Math-2026-11-26/prd.md
  - docs/srs.md
  - .working/color-themes-1.html
name: Visual Math
description: A calm, paper-and-ink learning surface with one steady blue. Light by default, full dark mode, English LTR and Urdu RTL, readable from a phone to a laptop screen.
colors:
  bg: '#F6F4EE'
  surface: '#FFFFFF'
  text: '#1F2933'
  muted: '#52606D'
  primary: '#2B4A8B'
  on-primary: '#FFFFFF'
  accent: '#8A4B08'
  border: '#CFC9BA'
  border-strong: '#8C8673'
  focus: '#1D4ED8'
  success: '#1B6B3A'
  error: '#B3261E'
  hint: '#8A5A00'
  link: '#1F4FA8'
  axis: '#1F2933'
  grid: '#8F8A78'
  curve-1: '#2B4A8B'
  curve-2: '#B3541E'
  fill: '#7C94C6'
  selected: '#C9D5EE'
  edge: '#2B4A8B'
  section: '#A8740A'
  track: '#8C8673'
  thumb: '#2B4A8B'
  level-foundation: '#2E7D4F'
  level-intermediate: '#2B4A8B'
  level-advanced: '#7A3E9D'
  scrim: '#1F293399'
  bg-dark: '#12161C'
  surface-dark: '#1B2129'
  text-dark: '#E8EAED'
  muted-dark: '#A6B0BC'
  primary-dark: '#9DB5F0'
  on-primary-dark: '#0E1626'
  accent-dark: '#E0B060'
  border-dark: '#3A4452'
  border-strong-dark: '#728095'
  focus-dark: '#8FB0FF'
  success-dark: '#6FD39A'
  error-dark: '#FF8A80'
  hint-dark: '#F0C060'
  link-dark: '#9DB5F0'
  axis-dark: '#E8EAED'
  grid-dark: '#6E7A8C'
  curve-1-dark: '#9DB5F0'
  curve-2-dark: '#F0A070'
  fill-dark: '#5774B8'
  selected-dark: '#2C3E66'
  edge-dark: '#9DB5F0'
  section-dark: '#F0C060'
  track-dark: '#728095'
  thumb-dark: '#9DB5F0'
  level-foundation-dark: '#6FD39A'
  level-intermediate-dark: '#9DB5F0'
  level-advanced-dark: '#C79BE8'
  scrim-dark: '#000000B3'
typography:
  display:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 32px
    fontWeight: 700
    lineHeight: 40px
  h1:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
  h2:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
  body:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-foundation:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 20px
    fontWeight: 400
    lineHeight: 30px
  meta:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  button:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
  formula:
    fontFamily: 'KaTeX_Main, Latin Modern Math, STIX Two Math, Cambria Math, serif'
    fontSize: 20px
    fontWeight: 400
    lineHeight: 28px
  present-body:
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif'
    fontSize: 32px
    fontWeight: 500
    lineHeight: 44px
  present-formula:
    fontFamily: 'KaTeX_Main, Latin Modern Math, STIX Two Math, Cambria Math, serif'
    fontSize: 44px
    fontWeight: 400
    lineHeight: 56px
  urdu-body:
    fontFamily: 'Noto Nastaliq Urdu, Jameel Noor Nastaleeq, Noto Naskh Arabic, Segoe UI, Tahoma, serif'
    fontSize: 18px
    fontWeight: 400
    lineHeight: 36px
  urdu-body-foundation:
    fontFamily: 'Noto Nastaliq Urdu, Jameel Noor Nastaleeq, Noto Naskh Arabic, Segoe UI, Tahoma, serif'
    fontSize: 24px
    fontWeight: 400
    lineHeight: 48px
  urdu-heading:
    fontFamily: 'Noto Nastaliq Urdu, Jameel Noor Nastaleeq, Noto Naskh Arabic, Segoe UI, Tahoma, serif'
    fontSize: 24px
    fontWeight: 700
    lineHeight: 48px
  urdu-meta:
    fontFamily: 'Noto Nastaliq Urdu, Jameel Noor Nastaleeq, Noto Naskh Arabic, Segoe UI, Tahoma, serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 32px
  urdu-present-body:
    fontFamily: 'Noto Nastaliq Urdu, Jameel Noor Nastaleeq, Noto Naskh Arabic, Segoe UI, Tahoma, serif'
    fontSize: 36px
    fontWeight: 400
    lineHeight: 72px
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
  gutter-mobile: 16px
  gutter-desktop: 24px
  touch-min: 44px
  touch-foundation: 48px
  touch-present: 64px
  touch-gap: 8px
  scene-ratio-phone: 50vh
  panel-width-desktop: 33.333%
  panel-width-present: 40%
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
    padding: '{spacing.4}'
  button-primary-foundation:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.body-foundation}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-foundation}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    borderColor: '{colors.primary}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  button-secondary-foundation:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    borderColor: '{colors.primary}'
    typography: '{typography.body-foundation}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-foundation}'
  button-text:
    textColor: '{colors.link}'
    typography: '{typography.button}'
    minHeight: '{spacing.touch-min}'
  button-destructive:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.error}'
    borderColor: '{colors.error}'
    typography: '{typography.button}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  toolbar-button:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    borderColor: '{colors.border-strong}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  text-input:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border-strong}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
    padding: '{spacing.3}'
  text-input-error:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.error}'
    textColor: '{colors.text}'
    iconColor: '{colors.error}'
  text-input-disabled:
    backgroundColor: '{colors.bg}'
    borderColor: '{colors.border}'
    textColor: '{colors.muted}'
  search-field:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border-strong}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.full}'
    minHeight: '{spacing.touch-min}'
  filter-chip:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border-strong}'
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    minHeight: '{spacing.touch-min}'
  filter-chip-selected:
    backgroundColor: '{colors.selected}'
    borderColor: '{colors.primary}'
    textColor: '{colors.text}'
  topic-card:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '{spacing.4}'
  dashboard-card:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '{spacing.4}'
  data-table:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border}'
    textColor: '{colors.text}'
    headerColor: '{colors.bg}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  banner:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.primary}'
    textColor: '{colors.text}'
    iconColor: '{colors.primary}'
    rounded: '{rounded.md}'
    padding: '{spacing.3}'
  banner-error:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.error}'
    textColor: '{colors.text}'
    iconColor: '{colors.error}'
  banner-success:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.success}'
    textColor: '{colors.text}'
    iconColor: '{colors.success}'
  dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    scrimColor: '{colors.scrim}'
    rounded: '{rounded.lg}'
    padding: '{spacing.5}'
  upload-zone:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border-strong}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    minHeight: '{spacing.8}'
  skeleton:
    backgroundColor: '{colors.border}'
    rounded: '{rounded.sm}'
  slider:
    trackColor: '{colors.track}'
    fillColor: '{colors.primary}'
    thumbColor: '{colors.thumb}'
    focusColor: '{colors.focus}'
    thumbSize: '{spacing.touch-min}'
    trackHeight: 6px
  slider-foundation:
    trackColor: '{colors.track}'
    fillColor: '{colors.primary}'
    thumbColor: '{colors.thumb}'
    focusColor: '{colors.focus}'
    thumbSize: '{spacing.touch-foundation}'
    trackHeight: 8px
  step-bar:
    backgroundColor: '{colors.surface}'
    activeColor: '{colors.primary}'
    doneColor: '{colors.success}'
    idleColor: '{colors.track}'
    typography: '{typography.label}'
    minHeight: '{spacing.touch-min}'
  step-bar-foundation:
    backgroundColor: '{colors.surface}'
    activeColor: '{colors.primary}'
    doneColor: '{colors.success}'
    idleColor: '{colors.track}'
    typography: '{typography.body-foundation}'
    minHeight: '{spacing.touch-foundation}'
  scene-frame:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border}'
    rounded: '{rounded.lg}'
    axisColor: '{colors.axis}'
    gridColor: '{colors.grid}'
  nav-bar:
    backgroundColor: '{colors.surface}'
    borderColor: '{colors.border}'
    activeColor: '{colors.primary}'
    idleColor: '{colors.muted}'
    minHeight: 56px
  bottom-sheet:
    backgroundColor: '{colors.surface}'
    scrimColor: '{colors.scrim}'
    rounded: '{rounded.lg}'
    padding: '{spacing.4}'
  toast:
    backgroundColor: '{colors.text}'
    textColor: '{colors.bg}'
    rounded: '{rounded.md}'
    padding: '{spacing.3}'
  level-badge-foundation:
    textColor: '{colors.level-foundation}'
    borderColor: '{colors.level-foundation}'
    rounded: '{rounded.full}'
    typography: '{typography.label}'
  level-badge-intermediate:
    textColor: '{colors.level-intermediate}'
    borderColor: '{colors.level-intermediate}'
    rounded: '{rounded.full}'
    typography: '{typography.label}'
  level-badge-advanced:
    textColor: '{colors.level-advanced}'
    borderColor: '{colors.level-advanced}'
    rounded: '{rounded.full}'
    typography: '{typography.label}'
---

## Brand & Style

Visual Math looks like a well-lit library desk: warm paper, dark ink and one steady blue. The page is quiet so the scene can be loud. The student's eye should go to the shape they are dragging and the number that changes, not to the interface. No ads, no streak confetti, no gamified noise; the tone is calm and trustworthy, including for children and their families (NFR-3.4).

The product is a learning surface for ages from primary school to adult, in English and Urdu, on a cheap phone or a laptop. So the style is plain: big type, clear edges, generous touch targets, and words next to every icon. Foundation topics get larger type and bigger targets; the style itself does not turn childish. [ASSUMPTION: no mascot, illustration style or playful decoration is in version 1; confirm.]

Fonts are system or open fonts only, nothing that needs a paid licence. Latin text uses the device system font stack. Math uses KaTeX's open fonts. Urdu uses Noto Nastaliq Urdu (SIL Open Font License, free), self-hosted and subset, with Jameel Noor Nastaleeq if installed and Noto Naskh Arabic as the fallback shown first while the heavy file loads (NFR-1.6). The fallback `@font-face` sets `size-adjust` and `ascent-override` so the swap moves text by less than one line. Latin words inside Urdu text use the Latin stack at about 0.9em so the line does not look loose. [ASSUMPTION: Noto Nastaliq Urdu is the chosen Urdu face because it is open and free; the PRD only says "heavy Nastaliq-style font".]

Visual references. The palette comes from variation 1, Quiet Study, in [color-themes-1.html](.working/color-themes-1.html). Two mocks show the intended look: [topic on a phone](.working/key-lesson-phone.html) and [library on a phone](.working/key-library-phone.html). The mocks are illustrations only and were drawn before the SRS update: ignore the quiz button and any sign-in or class elements in them; version 1 has none of those. The Present-mode mock was removed with that feature. **This spine wins on any conflict with a mock or with the theme file**, including where this spine changed a helper color to meet contrast.

## Colors

The theme is Quiet Study, with its main colors unchanged (bg, surface, text, primary, accent, link, feedback, curves, levels). Only helper tokens that failed the 3:1 non-text floor were darkened: `track`, `grid`, `fill`, `section`, and their dark twins; a new `border-strong` handles control edges and a new `selected` keeps the old pale tint for selected states. Every role has a light value and a `-dark` twin. Light is the default; dark is a full theme chosen by a toggle or by following the system, and remembered per user. Naming rule: `{colors.role}` is light, `{colors.role-dark}` is dark. In `components`, only light names are written; in dark mode each reference resolves to its `-dark` twin.

- **Surfaces.** `{colors.bg}` is the page (paper). `{colors.surface}` is cards, sheets, the nav bar and the scene frame. They differ by tone and a hairline `{colors.border}`, not by shadow.
- **Two border tokens.** `{colors.border}` is the decorative hairline for cards, the scene frame, the nav bar and table rules (the thing it frames is identified by its content, so 3:1 is not required). `{colors.border-strong}` is for every edge that identifies a control: text inputs, search field, filter chips, outlined toolbar buttons, the upload zone. It reaches at least 3:1 on both `{colors.surface}` and `{colors.bg}`.
- **Text.** `{colors.text}` for all body text. `{colors.muted}` for secondary text, meta and idle icons. Never use muted for the only label of a control.
- **Primary.** `{colors.primary}` (steady blue) is the main action, active step, slider fill and links' companion. `{colors.on-primary}` is text on it. Only one primary button is visible per view.
- **Accent.** `{colors.accent}` (warm brown) is reserved for highlights inside the scene: the value being predicted, the "Try it yourself" marker. It is not a second button color.
- **Link.** `{colors.link}` for inline links, always underlined.
- **Focus.** `{colors.focus}` is the focus ring: 3px, with a **mandatory 2px offset**, and an inner 2px `{colors.surface}` gap ring so it stays visible on any background, including the scene and dark mode. The ring is tested against the page, not against the control (a ring drawn flush on a primary button is only 1.28:1 and fails). Used on every interactive element and never removed.
- **Feedback.** `{colors.success}` correct, `{colors.error}` wrong, `{colors.hint}` hint. Each is always paired with an icon and a word (the stated minimum), and with a 2px border in a different style (solid for correct, dashed for wrong, dotted for hint), never color alone (NFR-3.1).
- **Scene colors.** `{colors.axis}` for axes and labels; `{colors.grid}` for grid lines (3:1 on the scene surface, drawn 1px thin so the scene stays quiet); `{colors.curve-1}` and `{colors.curve-2}` for the two main curves or shapes; `{colors.fill}` for the 3D solid fill and filled areas; `{colors.edge}` for shape edges on the plain surface; `{colors.section}` for the cross-section plane and cut marks; `{colors.track}` and `{colors.thumb}` for slider parts. These scene roles are drawn by the scene renderer, not by interface components, which is why some have no component entry. Rules: where a shape edge sits on `{colors.fill}`, it is drawn in `{colors.axis}` (edge on the darkened fill is only 2.1:1; axis on fill is 4.9:1). The two curves are only 1.7:1 apart in luminance, so a curve that carries meaning always differs by dash pattern and marker shape and label, not hue (this holds in dark too, where the two curves are about equal in luminance).
- **Selected.** `{colors.selected}` is the pale tint behind a selected filter chip. It carries no meaning alone: the `{colors.primary}` border, a check icon and text do (text on selected is 10.00:1).
- **Levels.** `{colors.level-foundation}` green, `{colors.level-intermediate}` blue, `{colors.level-advanced}` purple. A level is always shown as a word badge; the color only supports it. [ASSUMPTION: level colors are taken from the Quiet Study set (confirmed in .memlog);]
- **Scrim.** `{colors.scrim}` dims the page behind a bottom sheet or dialog. [ASSUMPTION: scrim is not in the theme file; a 60% ink (light) and 70% black (dark) overlay is inferred.]

Not allowed: gradients, decorative color, red for anything but errors, green for anything but correct or Foundation.

### Contrast table

Computed with the WCAG 2.x relative-luminance formula by script (python -I). Thresholds: 4.5:1 for text, 3:1 for icons, control edges and scene lines. Any new color pair is added here and checked before use.

| Pair (foreground on background) | Light | Dark | Need |
|---|---|---|---|
| text on bg | 13.42 | 15.06 | 4.5 |
| text on surface | 14.76 | 13.44 | 4.5 |
| muted on bg | 5.87 | 8.26 | 4.5 |
| muted on surface | 6.46 | 7.37 | 4.5 |
| on-primary on primary | 8.55 | 8.87 | 4.5 |
| primary on surface | 8.55 | 7.95 | 4.5 |
| link on bg | 6.96 | 8.90 | 4.5 |
| accent on surface | 6.79 | 8.14 | 4.5 |
| success on surface | 6.54 | 8.84 | 4.5 |
| error on surface | 6.54 | 7.10 | 4.5 |
| hint on surface | 5.93 | 9.58 | 4.5 |
| level-foundation on surface | 5.05 | 8.84 | 4.5 |
| level-advanced on surface | 6.99 | 7.16 | 4.5 |
| text on selected | 10.00 | 8.76 | 4.5 |
| curve-2 on surface | 5.00 | 7.69 | 3 |
| focus ring on bg | 6.09 | 8.49 | 3 |
| focus ring on surface | 6.70 | 7.58 | 3 |
| thumb on surface (2px surface ring separates it from the track) | 8.55 | 7.95 | 3 |
| border-strong on surface | 3.64 | 4.04 | 3 |
| border-strong on bg | 3.31 | 4.53 | 3 |
| track on surface | 3.64 | 4.04 | 3 |
| track on bg | 3.31 | 4.53 | 3 |
| grid on surface | 3.46 | 3.72 | 3 |
| fill on surface | 3.04 | 3.55 | 3 |
| section on surface | 4.06 | 9.58 | 3 |
| axis on fill (shape edge on solid) | 4.85 | 3.79 | 3 |

Before this pass the failing values were border 1.65, track 1.84, grid 1.42, fill 1.48, section 2.19 (light) and border, track, grid, fill about 1.3 to 1.6 (dark). `{colors.border}` and `{colors.border-dark}` are unchanged because they are decorative only. The thumb is not read against the track (2.35 light, 1.97 dark); its 2px `{colors.surface}` ring and its position on the fill separate it, and it passes against the surface.

## Typography

Type roles, one ramp for every screen. Sizes are authored in rem so browser text-size settings scale them; line heights are unitless multiples on the container, so wrapped labels grow instead of clipping. Layouts survive the WCAG text-spacing overrides (line height 1.5, paragraph spacing 2x, letter spacing 0.12em; Urdu is exempt from letter spacing).

- **Latin UI.** `{typography.body}` 16/24 is the floor; never go below 14 (`{typography.meta}`, `{typography.label}`). Headings are `{typography.display}`, `{typography.h1}`, `{typography.h2}`. Buttons use `{typography.button}`.
- **Foundation.** `{typography.body-foundation}` 20/30 replaces body in Foundation topics. In Urdu, `{typography.urdu-body-foundation}` 24/48 does the same, so Urdu Foundation is never smaller than English Foundation.
- **Math.** `{typography.formula}` through KaTeX, always left-to-right, even inside Urdu text. Live numbers in formulas use tabular figures so they do not jitter while a slider moves. The minus sign is U+2212 (not a hyphen), inside the LTR isolate.
- **Projecting.** Full screen (FR-3.15) uses the normal type ramp. The `present-*` type and `touch-present` tokens stay defined, unchanged, for a possible projector option later; version 1 does not apply them.
- **Urdu.** `{typography.urdu-body}`, `{typography.urdu-body-foundation}`, `{typography.urdu-heading}`, `{typography.urdu-meta}` (now 16/32), `{typography.urdu-present-body}`. Nastaliq needs tall lines, so line height is about twice the font size and sizes run 2px larger than the Latin equivalents. No letter spacing, no italic, no faux bold on Urdu; weight comes from the font. Fallback text shows first and swaps when the font arrives, with no layout jump larger than one line (line height is set on the container). Digits are Western by default; Eastern Arabic-Indic digits are an option on Urdu (NFR-7.2).
- Never use all caps, never justify text, line length 45 to 75 characters on desktop.

## Layout & Spacing

Scale: 4, 8, 12, 16, 24, 32, 48, 64 px (`{spacing.1}` to `{spacing.8}`). Gutter is `{spacing.gutter-mobile}` on phone and `{spacing.gutter-desktop}` from 768px up. Targets are at least `{spacing.touch-min}` (44px); Foundation uses `{spacing.touch-foundation}` (48px); `{spacing.touch-present}` is reserved and not applied in version 1. Adjacent targets are at least `{spacing.touch-gap}` (8px) apart. All component heights are minimums (`minHeight`), never fixed, so wrapped or Urdu labels grow the control. Inline underlined links inside a sentence are exempt from the 44px rule (WCAG 2.5.8 inline exception) but are never the only way to reach an action.

Breakpoints [ASSUMPTION: values inferred from the 360 to 1920 range]: phone 360 to 767, tablet 768 to 1023, laptop 1024 to 1439, wide and projector 1440 to 1920.

Topic page grid, fixed by the SRS (7.2):
- Phone portrait: the scene frame is sticky in the top half (`{spacing.scene-ratio-phone}`), sliders directly beneath, then steps, formulas, the worked example and the Try this prompts. `scroll-padding-top` equals the sticky scene height so a focused control is never hidden under it.
- Phone landscape: the scene is not sticky (50vh would leave under 180px). Scene and panel sit side by side (scene 60%, panel 40%, panel scrolls on its own).
- Reflow: at 320 CSS px wide, at 400% zoom, or when the effective viewport is under 480 CSS px wide or under 400 CSS px tall, the scene stops being sticky and scrolls with the page, with a "Back to picture" jump link at the top of the panel. The scene is the only content allowed to pan in two dimensions.
- Laptop and projector: scene on the left two thirds, a right panel of one third (`{spacing.panel-width-desktop}`) holding steps, sliders, formulas and the worked example.
- Urdu mirrors the text panel and page chrome. The scene frame, axes, formulas, numbers and value sliders keep their LTR direction, so on Urdu laptop the panel sits on the left and the scene on the right while the scene content itself is unmirrored. See EXPERIENCE.md for the slider decision.

Single column everywhere except the topic page and tables. Content max width 1200px outside the topic page. Motion values: state changes 150ms, sheets 250ms ease-out, toast 6s minimum (see Toast); all become instant under reduced motion.

## Elevation & Depth

Tonal layering, almost no shadow. `{colors.surface}` on `{colors.bg}` plus a 1px `{colors.border}` gives depth. Bottom sheets, toasts and dialogs are the only elevated layers; they get one soft shadow (0 4px 16px, 12% ink in light, none in dark where the `{colors.scrim}` and border do the work). The sticky scene frame does not cast a shadow; it ends in a 1px border so scrolling steps do not look like they run under it.

## Shapes

`{rounded.sm}` 6px for badges' inner parts, inputs' inner marks, and chips. `{rounded.md}` 10px for buttons, inputs, cards, banners, toasts. `{rounded.lg}` 16px for the scene frame, bottom sheets, and dialogs. `{rounded.full}` only for level badges, the search field and the slider thumb. Edges of scene shapes are sharp; the interface is soft, the math is exact.

## Components

All sizes are minimums. Dark mode swaps colors only. Control edges use `{colors.border-strong}`; state borders (selected, correct, wrong, hint, error) are 2px. Every interactive component shows the focus ring from Colors. Icon-only buttons are not allowed anywhere: every icon has a visible word (see Scene toolbar).

- **Button primary** (`button-primary`): filled `{colors.primary}`, text `{colors.on-primary}`, 44px high; 48px in Foundation (`button-primary-foundation`). Pressed: darker by tone step; disabled: `{colors.border}` fill with `{colors.muted}` text and a visible reason nearby. Focus: 3px `{colors.focus}` ring with 2px offset (mandatory). Always has a text label; an icon may precede it.
- **Button secondary** (`button-secondary`, `-foundation` 48px): `{colors.surface}` fill, 2px `{colors.primary}` outline, text `{colors.primary}`. Used for the second action in a pair (Cancel next to Save, Back next to Next). Never placed beside another filled primary of equal weight. Pressed: `{colors.selected}` fill. Disabled: `{colors.border}` outline, `{colors.muted}` text.
- **Button text** (`button-text`): text only in `{colors.link}`, underlined, 44px target height (the underline is not removed on hover or focus). For low-weight actions: Cancel in a form, Retry, Clear filters, Report a problem, Show next step. Never the only way to do something destructive.
- **Button destructive** (`button-destructive`): outlined `{colors.error}` with the verb in text ("Delete my data", "Remove"). It is never filled and never the default focused button in a dialog.
- **Text input and form field** (`text-input`, `text-input-error`, `text-input-disabled`): a field is a visible label above (`{typography.label}`, never placeholder-only), the input (44px min, 16px text so phones do not zoom, `{colors.border-strong}` edge, `{rounded.md}`), and a help or error line beneath (`{typography.meta}`). Focus: ring plus the edge becomes `{colors.primary}`. Error: 2px `{colors.error}` edge, an error icon, and the message in `{colors.text}` with the word "Error" or the fix (not red text alone). Required fields say "(required)" in the label, not an asterisk alone. Disabled uses `{colors.bg}` fill, `{colors.border}` edge, `{colors.muted}` text, and a reason in the help line. The typed-value box beside a slider is this component, narrower, with a unit suffix.
- **Search field and filter chips** (`search-field`, `filter-chip`, `filter-chip-selected`): the search field is a pill with a visible magnifier icon, the word "Search" as its label, and a Clear button (word "Clear") once it has text. Chips are 44px, `{rounded.sm}`, `{colors.border-strong}` edge, label in `{typography.label}`. Selected chip: `{colors.selected}` fill, 2px `{colors.primary}` border and a check icon before the word. Chips wrap to the next line; they do not scroll sideways. A "Clear filters" text button appears when any chip is on.
- **Topic card** (`topic-card`): `{colors.surface}`, 1px `{colors.border}`, thumbnail on top (2D image), title in `{typography.h2}`, the short summary (FR-1.3), a row with level badge, minutes and a viewed mark (the word "Viewed" with a check icon; nothing is shown for a topic not yet viewed). The mark is a word plus an icon, never color alone (FR-1.3). Foundation cards are larger (48px minimum for the whole-card target and bigger type), not picture-led.
- **Library category heading**: categories in the Library are plain section headings in `{typography.h2}` with the topic count after the name (for example "Geometry (12 topics)"), as in the library mock, followed by that category's cards. They are not cards, chips or tabs.
- **Dashboard card** (`dashboard-card`): `{colors.surface}`, 1px `{colors.border}`, a `{typography.h2}` heading, one big number or short list, and a progress bar made of `{colors.primary}` fill on `{colors.track}`, always with the value as text ("3 of 5 topics"), never a color only. Used on My progress and the admin dashboard. Cards stack on phone and sit in a 2 or 3 column grid on laptop.
- **Data table** (`data-table`): header row on `{colors.bg}` in `{typography.label}`, rows 44px minimum with a 1px `{colors.border}` rule, no zebra color. Status cells are word plus icon. Sort buttons are text buttons in the header with an arrow icon and "sorted ascending" state. On phone a table becomes a stacked list of rows (label and value pairs) rather than scrolling sideways; admin tables on laptop may scroll inside their frame but keep the first column fixed. Row actions are labelled text buttons.
- **Banner** (`banner`, `-error`, `-success`): an inline block at the top of its section, `{colors.surface}`, 2px colored border, an icon and a word ("Note", "Error", "Done"), message in `{typography.body}`, and an optional text-button action (Retry). It is persistent until the condition ends or it is dismissed; it does not auto-dismiss. Used for offline, sync failed, session ending, missing translation and import results. Info uses `{colors.primary}`, error `{colors.error}` with a dashed border, success `{colors.success}` with a solid border.
- **Dialog** (`dialog`): centered over `{colors.scrim}`, `{rounded.lg}`, a heading, one or two sentences, and two buttons in a row: a secondary or text "Cancel" and the confirming action. Max width 480px; on phone it is a full-width card near the bottom. Used for confirm and destructive actions only; informational choices use the bottom sheet. Has a visible Close button.
- **Import and upload** (`upload-zone`): a dashed `{colors.border-strong}` zone with an icon, the words "Choose a file" (a real button that opens the file picker, so drag and drop is optional) and the accepted types (JSON or MD). After choosing: a file row with name, size, a progress bar with a percentage as text, and a Remove text button. Results show in a `data-table` of files or rows with passed or failed words and messages.
- **Skeleton** (`skeleton`): `{colors.border}` blocks in the shape of the content (card, row, scene frame), with a slow shimmer that is replaced by a static block under reduced motion. Skeletons are decorative and hidden from screen readers; the live loading words ("Loading the picture") are visible text.
- **Slider** (`slider`, `slider-foundation`): 6px track in `{colors.track}` (8px Foundation), fill in `{colors.primary}`, a circular thumb of 44px (48px Foundation) with a 2px `{colors.surface}` ring. The current value and unit show in a label above the thumb, with a typed-value box beside it (FR-3.7). Ticks show min and max. Focus ring on the thumb.
- **Step bar** (`step-bar`, `-foundation`): text "Step 2 of 5" plus segmented bar; segments are done (`{colors.success}` with a check), active (`{colors.primary}`, taller and outlined) or idle (`{colors.track}`). Back and Next buttons flank it; they are 44px (48px Foundation) and show words, not arrows alone.
- **Scene frame** (`scene-frame`): `{colors.surface}` canvas with `{rounded.lg}`, a toolbar row and a one-line visible caption below, with a "More about this picture" disclosure holding the long description (FR-3.29).
- **Scene toolbar** (`toolbar-button`): buttons for Reset view, Full screen, view toggles, Zoom in, Zoom out and Rotate left, right, up, down (the last group collapses under one "Move picture" button on phone). Each is an icon with a **visible word** beneath or beside it (`{typography.label}`); the word may be shortened to fit ("Reset", "Zoom +") but is never hidden on phone or Foundation, and a tooltip is only an extra. 44px minimum (48 Foundation), 8px apart. Tooltips also open on keyboard focus, stay while hovered and close with Esc.
- **Nav bar** (`nav-bar`): 56px bottom bar on phone with 4 labelled items (icon plus word); top bar on tablet and up. Active item = `{colors.primary}` icon, bold label and a top indicator bar.
- **Bottom sheet** (`bottom-sheet`): slides up over `{colors.scrim}`, `{rounded.lg}` on top corners, a drag handle, a visible Close button. Used for marked-term explanations, Report a problem, language, theme.
- **Toast** (`toast`): inverted colors (`{colors.text}` on `{colors.bg}`), bottom center above the nav bar and never covering a focusable control, one line, optional single action. A success toast lasts 8 seconds, pauses while hovered or focused, and is also written to the polite live region. An error is never a toast alone: it uses a banner or a field message that stays.
- **Level badge** (`level-badge-foundation`, `-intermediate`, `-advanced`): outlined pill with the level word ("Foundation", "Intermediate", "Advanced") in the matching color; a small icon shape differs per level (circle, square, triangle) so it is not color alone.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Pair every feedback color with an icon and a word | Show correct or wrong by color alone |
| Use `{colors.primary}` for one main action per view | Put two filled blue buttons side by side |
| Use `{colors.border-strong}` for every control edge | Use `{colors.border}` on inputs, options or chips |
| Keep formulas, axes, numbers and value sliders LTR inside Urdu pages | Mirror the scene or reorder digits in formulas |
| Load Urdu with a visible fallback first, fixed line height | Block text until the Nastaliq font arrives |
| Use system and open fonts only | Add a font that needs a paid licence |
| Keep 44px targets (48px Foundation) with 8px gaps | Shrink slider thumbs or toolbar icons to fit |
| Show every icon with a visible word | Ship icon-only buttons or hover-only names |
| Show a 3px focus ring with the 2px offset on every control | Remove outlines, or draw the ring flush on the control |
| Use tone and hairline borders for depth | Add heavy shadows, gradients or decorative color |
| Check dark mode and the contrast table for every new color | Invert light colors by filter or opacity tricks |
| Respect reduced motion with instant state changes | Rely on animation to carry meaning |
