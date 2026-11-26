---
title: 'Story 1.3: Locale routing, language switch and right-to-left shell'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '269dd488d4773f74146dc748cecea7696db70d1b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/spikes.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Visual Math-2026-11-26/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The site has one hard-coded English page: no language in the URL, no Urdu, no right-to-left layout, and interface strings sit in components.

**Approach:** Put every visitor page under `/en` and `/ur` (static, next-intl with root params, as spiked), redirect `/` by `Accept-Language`, set `lang` and `dir` on `<html>`, move all interface text to message files with a lint rule that blocks literals, and add a language switcher that keeps the visitor's place.

## Boundaries & Constraints

**Always:** A link's language wins over any saved or browser language. Page routes are statically generated for `en` and `ur`; any other first segment is a 404. Message files are the only home of interface text; Urdu keys must exist for every English key. Locales come from one `LOCALES` list; a new locale needs no code change outside it and its message file. Formulas, axes and numbers are never mirrored (later stories); chrome mirrors through logical CSS only. Numbers and dates use `Intl` for the locale, Western digits by default.

**Never:** No topic content, nav bar or search yet. No third-party i18n scripts. Do not read `localStorage` or cookies on the server in static pages. Urdu strings written here are AI drafts: mark them for the admin check, do not claim they are reviewed.

**Decision (owner, 2026-11-26):** The saved language is a first-party functional cookie `vm-locale` (value `en` or `ur`, set only when the visitor presses the language switcher, one year, `SameSite=Lax`, `Path=/`, no personal data). The proxy honors it when redirecting `/`: cookie, then `Accept-Language`, then English. A link's language still wins. AD-17 is amended and the Privacy page (Story 6.5) must name the cookie.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Urdu browser | `GET /`, `Accept-Language: ur-PK,en;q=0.5` | redirect to `/ur` | N/A |
| Unsupported | `GET /`, `Accept-Language: fr-FR` or none | redirect to `/en` | N/A |
| Saved choice | `GET /`, cookie `vm-locale=ur`, `Accept-Language: en` | redirect to `/ur` | invalid cookie value ignored |
| Weighted | `en;q=0.4, ur;q=0.9` | `/ur`; `q=0` entries ignored | malformed header falls back to `/en` |
| Direct link | `GET /ur` or `/en` | 200, static HTML, `lang` and `dir` set (`ur` is `rtl`) | N/A |
| Unknown locale | `GET /fr` | 404 page | no crash |
| Switch | on `/en?step=2#a`, choose Urdu | `/ur?step=2#a`, page mirrors, theme kept | works without JavaScript to the bare path |
| Missing Urdu key | key in `en`, absent in `ur` | test fails naming the key | runtime falls back to English |
| Fake locale | `xx` added to the list in a test | resolves, routes and falls back to English messages | N/A |
| Literal string | `<p>Hello</p>` in a component | lint error | CI red |
| Numbers | `formatNumber(1234.5, locale)` | locale grouping, Western digits | non-finite renders an em dash |

</frozen-after-approval>

## Code Map

- `src/app/layout.tsx`, `src/app/page.tsx` -- current root layout (html, prepaint script) and home; move under `src/app/[locale]/`.
- `src/features/theme/ThemeToggle.tsx` -- has English literals and `aria-label`; move to messages.
- `next.config.ts` -- add the next-intl plugin (`./src/i18n/request.ts`); `experimental.rootParams` is not needed in 16.4.
- `docs/spikes.md` section 4 -- working pattern: root layout in `[locale]`, `locale()` from `next/root-params`, `generateStaticParams`.
- `eslint.config.mjs` -- add the literal-string rule; boundaries: `src/proxy.ts` and `src/i18n` are outside the six layers, classify them.
- `tests/e2e/theme.spec.ts`, `tests/e2e/home.spec.ts` -- use `/`; update to the redirect.

## Tasks & Acceptance

**Execution:**
- [x] `src/i18n/locales.ts`, `src/lib/i18n/` (`negotiate.ts`, `locale-support.ts`, which also holds the path swap) -- LOCALES list, Accept-Language negotiation, directions, locale swap in a path -- pure and testable
- [x] `src/i18n/messages/en.json`, `ur.json`, `src/i18n/request.ts`, `next.config.ts` -- messages with English fallback per key; next-intl wiring -- FR-6.5
- [x] `src/proxy.ts` -- redirect `/` per the Decision above; `Vary` header -- FR-6.3
- [x] `src/app/[locale]/layout.tsx`, `page.tsx`, `src/app/global-not-found.tsx` -- html `lang`/`dir`, prepaint script, provider, 404 for unknown locales, Urdu font preload on `/ur` only -- FR-6.2, 6.6
- [x] `src/features/i18n/LanguageSwitcher.tsx`, `ThemeToggle.tsx` -- switcher with endonyms; theme labels from messages -- FR-6.1, 2.7 shell
- [x] `src/lib/format/index.ts` -- `formatNumber`, `formatDate`, `formatPercent` via `Intl` -- NFR-7.2
- [x] `eslint.config.mjs`, `eslint-rules/no-literal-text.mjs` -- block literal user text and text attributes in components -- FR-6.5
- [x] `scripts/check-static-routes.mjs`, `package.json` -- fail the check if `/en` or `/ur` is not prerendered -- AD-10
- [x] `tests/unit/*`, `tests/e2e/i18n.spec.ts` -- matrix rows, parity, fake locale; e2e redirect, rtl, switch -- AC proof

**Acceptance Criteria:**
- Given a first visit with Urdu preferred, when `/` loads, then the visitor lands on `/ur` with `dir="rtl"`.
- Given any page, when the switcher is used, then the path, query and hash are kept and no strings are English-only literals.
- Given a locale added to the list, when the app builds, then no code outside the list and its messages changes.

## Implementation Notes

- Direct implementation (no subagent). Structure: pure logic in `src/lib/i18n` (negotiation, directions, path swap, takes the locale list as a parameter) and `src/lib/format`; `src/i18n` holds the list, messages, request config; `src/proxy.ts` redirects `/`; root layout now lives in `src/app/[locale]/layout.tsx`.
- `src/i18n` became a boundary element (importable by app, features, server). The `no-literal-text` rule is a local ESLint rule (regex selectors cannot carry the Unicode escapes).
- Finding: the Urdu word in the language switcher made English pages download the 124 KB Nastaliq file. Fixed by giving `html:lang(en) :lang(ur)` a system-font stack; the test now asserts English pages (including the switcher) never request it and `/ur` does. Trade-off: the "اردو" label on English pages is not in Nastaliq.
- Preload: `react-dom` `preload()` instead of a JSX `<link>`, which React emitted twice.
- Cookie `vm-locale` per the owner decision; AD-17 amended in the spine; Story 6.5 now requires the Privacy page to name it.
- Added `experimental.globalNotFound` and `src/app/global-not-found.tsx` (bilingual) for `/fr`. `check` now ends with `scripts/check-static-routes.mjs`.
- Existing theme e2e tests were unchanged apart from the font test (see above); `/` now redirects to `/en`.
- Urdu strings in `ur.json` are AI drafts for the admin check (NFR-6.4). After review fixes: 153 unit and 28 e2e tests (Chromium) pass.
- Not covered: Firefox, WebKit, Edge e2e (CI only); switching language on pages beyond the home page (no other pages exist yet; the path swap is unit-tested).

## Spec Change Log

## Review Triage Log

Three reviewers (blind, edge-case, verification-gap), claims checked against the repo:

| Finding | Verdict | Evidence / action |
| --- | --- | --- |
| Missing-Urdu-key fallback not really tested | medium | Real: the old test passed with or without the merge. Fixed: `merge` exported, partial-override test, `__proto__` and array handling, parity failure now names the keys. |
| Static-route guard hard-codes `en`/`ur`; entry check brittle; CLI untested | medium | Real. Fixed: reads `src/i18n/locales.ts`, `pathToFileURL` entry check, tests spawn the script (exit 0, 1 with named route, 1 without a build). |
| 404 page has no theme script and hard-codes languages | medium | Real (the old root layout's script was lost for it). Fixed: prepaint script, languages from `LOCALES` and `i18n.direction`; e2e checks dark theme on `/fr`. |
| `html:lang(en) :lang(ur)` removes Nastaliq from all Urdu text on English pages | medium | Real. Narrowed to `a[hreflang='ur']` (the switcher label). |
| Switcher hijacks Ctrl/Cmd/Shift/middle clicks; active link rewrites cookie | medium | Real. Fixed; e2e for new-tab click and the active link. |
| `no-literal-text` misses ternary, `&&`, `+`, templates with expressions, `aria-valuetext` | medium | Real. Rule is now recursive; tests added. `.ts` files stay out of scope (no JSX). |
| No page `<title>` | medium | Real (WCAG 2.4.2). `generateMetadata` uses `site.name`; e2e in both languages. |
| Long `Accept-Language` ignored instead of cut | low | Fixed with a slice and a test. |
| Invalid Intl option value re-throws in the fallback | low | Fixed; returns an em dash; test added. |
| Cookie attributes and `Max-Age` unverified; hard-coded `localhost:3000` in e2e | low | Fixed: attributes asserted, `baseURL` used. |
| Placeholder parity not checked; confusing describe title; weak `ur` date test | low | Fixed. |
| AD-17 still lists language as a `localStorage` key; storage notice story silent on the cookie | low | Spine and Story 6.5 amended. |
| `paths.ts` named in tasks but absent; "per the Open Question" wording | low | Spec text corrected. |
| `.claude/settings.json` plugin change in the diff | false | Not part of this story; made outside it. Left out of the commit. |
| `q=0` should exclude a broader tag | rejected | Rare; the cost is more parser logic than the harm. |
| `numberingSystem` and `timeZone` overridable by callers | rejected | Intentional: the Eastern-digit option later needs the override. |
| `rootLocale()` fallback should `notFound()` | rejected | Unreachable: `dynamicParams = false`; `/fr` is covered by an e2e. |
| Whole catalog sent to every client | defer | Pass only the namespaces clients use when messages grow. |
| No-JS switch does not save the cookie | defer | Needs a small route handler; revisit with Story 1.6 (handler rules). |
| `/EN`, `/ur-PK` URL variants 404 | defer | Add a proxy redirect for case and region variants. |
| `hreflang` alternates, canonical URLs | defer | Needs the product domain (Story 9.8). |
| Urdu "AI draft" marked only by a comment | rejected | Handled by the admin check process (NFR-6.4, Story 9.3). |

## Design Notes

A change of locale changes the root layout (`lang`, `dir`), so Next performs a full navigation; viewer state survives later because it lives in the URL (AD-6). The switcher renders plain links so it works without JavaScript.

## Verification

**Commands:**
- `npm run check` -- expected: exit 0 (includes the static-route check)
- `npx playwright test --project=chrome-111` -- expected: all pass
