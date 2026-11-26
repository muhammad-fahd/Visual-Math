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
