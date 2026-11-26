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
