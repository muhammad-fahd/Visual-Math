# Epic 1 Context: Foundation: site shell, languages, hosting, admin login

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give every later epic a deployable, secure shell: the Quiet Study theme with dark mode, English and Urdu routing with right-to-left layout, a database with the math-tree tables, and an admin login protected by a second step. Version 1 of Visual Math is a free public site with no visitor accounts and one admin.

## Stories

- Story 1.1: Project setup, CI and the first spikes
- Story 1.2: Theme tokens, dark mode and fonts
- Story 1.3: Locale routing, language switch and right-to-left shell
- Story 1.4: Admin sign-in with a second step, and the audit writer
- Story 1.5: Database, math tree tables and seed
- Story 1.6: Security baseline

## Requirements & Constraints

- Visitors never log in and are never asked for personal data; the server stores nothing about them.
- Site is English and Urdu from day one; all interface text lives in message files; Urdu mirrors layout but formulas, axes and numbers stay left-to-right.
- Admin signs in with email, password and an authenticator code; all admin actions are audit-logged.
- HTTPS everywhere; rate limits on logins, contact and report posts.
- Supported: latest two versions of Chrome, Edge, Firefox, Safari; phones from 360 px wide.
- Every story has acceptance tests; code follows a written standard and passes automated checks before merging.

## Technical Decisions

- One TypeScript package, modular monolith, layers `lib / scenes / features / server / db / app`, dependency direction enforced by `eslint-plugin-boundaries`. No Server Actions; mutations are `/api` Route Handlers.
- Stack pinned: Node 24 LTS, TypeScript 6.0.x, Next.js 16.4.6, React 19.3.1, KaTeX 0.19.1, next-intl 4.16.2, Zod 4.6.7, Tailwind 4.3.5, supabase-js 2.119.2 / ssr 0.12.7, Vitest 5.1.2, fast-check 4.11.0, Playwright 1.65.1, three 0.187.0 / r3f 9.8.2 / drei 10.7.9.
- One `browserslist` (`chrome 111, edge 111, firefox 128, safari 16.4, ios_saf 16.4, samsung 22`) drives build targets and the Playwright device matrix.
- Hosting: Vercel Pro (functions in `fra1`) and Supabase Pro `eu-central-1`. Environments: local (Supabase CLI), preview (throwaway schema, no production keys), production. Secrets only in Vercel and Supabase; only an allowlist of `NEXT_PUBLIC_` variables; typed `env.ts` validated with Zod.
- Forward-only SQL migrations; every table has row level security with no policy for `anon` or `authenticated`; the browser has no database access; server uses the service role through repositories.
- Admin auth is Supabase Auth with TOTP; every admin route requires an `aal2` session and an `admin_user` row.
- Theme: DESIGN.md frontmatter generates `tokens.css` and `tokens.ts`; no hex outside the generated files; theme, language and digit set applied before paint by one constant inline script.
- Routing: static pages per locale under `/en` and `/ur`; `/` redirects by `Accept-Language`; admin is a separate dynamic route group; CI fails if a visitor route turns dynamic.
- CSP: `script-src 'self'` plus sha256 for owned inline scripts; no third-party requests; no `unsafe-inline` in scripts.
- Fonts self-hosted: Latin system stack, KaTeX fonts, Noto Nastaliq Urdu subset (loaded on `/ur` only, fallback first).
- Spikes before dependent stories: mid-range phone rendering, Supabase CDN delete and cache behavior, SRI-only CSP on static pages, static pages with next-intl root params, Nastaliq subset size, Supabase TOTP `aal2`.
- Repo needs `docs/coding-standard.md`, `AGENTS.md`, `docs/spikes.md`.

## UX & Interaction Patterns

- Quiet Study palette, light default, full dark mode; toggle Light, Dark, System with no reload or flash.
- Mobile-first; Urdu mirrors page chrome and the value slider track; scenes and numbers do not mirror.

## Cross-Story Dependencies

- 1.1 first: everything builds on its CI and skeleton; its spikes gate later stories (CSP spike gates 1.6, TOTP spike gates 1.4, root-params spike gates 1.3).
- 1.2 and 1.3 share the pre-paint script and layout; 1.5 needs 1.1's migrations setup; 1.4 needs 1.5's tables for `admin_user` and `audit_log`.
- Epics 2 to 6 use fixture topics seeded by a dev script and do not wait for the admin UI.
