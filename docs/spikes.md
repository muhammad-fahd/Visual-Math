# First-story spikes (AD-29)

Run 2026-11-26 for Story 1.1 on Windows, Node 26.4, Next.js 16.4.6. Throwaway code was deleted after measuring; the results are the record. A failed or pending spike blocks only the stories named in "Gates".

| # | Spike | Result | Gates |
| --- | --- | --- | --- |
| 1 | 3D and KaTeX on the build target and on devices | Bundle half **done**; device half **pending owner** | Stories 2.3, 2.4 |
| 2 | Supabase CDN: immutable headers, delete, `max-age=30` | **pending owner** | Story 7.3 |
| 3 | Static pages under a script-src that is SRI/hash only | **FAIL as assumed; owner chose `'self' 'unsafe-inline'`; built in Story 1.6** | none |
| 4 | Static topic pages with next-intl root params | **PASS** | Story 1.3 |
| 5 | Noto Nastaliq Urdu subset against 150 KB | **Decided: regular 400 only, 124 KB (Story 1.2 shipped it)** | none |
| 6 | Supabase TOTP, `aal2` on admin routes | **pending owner**; Story 1.4 is built behind the `AdminAuth` port and tested with fakes | Verify before the admin goes live |

Other pending owner steps (Vercel key scoping, a preview Supabase project, Urdu category names, running migrations 0001 to 0003) are in `docs/environments.md`.

## 1. Bundle sizes (done) and devices (pending owner)

A page with a lazy `@react-three/fiber` canvas (cone, `OrbitControls`, `frameloop="demand"`) and a server-rendered KaTeX formula, built with `next build`:

- The 3D chunk is **240 KB gzip** and is not in the initial HTML. Budget 450 KB: fits.
- Chunks referenced by the initial HTML: **172 KB gzip** with no application code yet (React and Next runtime). Budget 200 KB: only about 28 KB of headroom. Finding: the 200 KB seed budget is tight; decide in Story 9.1 whether to raise it. KaTeX renders on the server, so its JS is not in that number; its CSS and fonts are extra.
- KaTeX `strict: 'error'` rejected a malformed formula at build time, as the format relies on.

**Owner steps (devices).** After Story 2.4 exists, open `/en` of a preview build on a mid-range Android phone (Chrome) and an iPhone (Safari 16.4 or later): the cone must rotate by touch and pinch-zoom, KaTeX must render, and `chrome://gpu` or `about:support` must show WebGL 2. Record phone model, browser version and result here.

## 2. Supabase CDN (pending owner)

Needs a Supabase project in `eu-central-1` (not created yet).

1. Create a public bucket `topics`. Upload `topics/test/abc.json` with `Cache-Control: public, max-age=31536000, immutable`, then `curl -I` its public URL: expect that header returned and a CDN cache header.
2. Request it twice; expect a cache hit on the second. Delete the object; request again from the same network and from a second location (phone on mobile data). Record how long until it returns 404 everywhere (target: under 60 s).
3. Upload `catalog.json` with `max-age=30`; overwrite it; record how long the old copy is served.

If deletion takes longer than 60 s, Story 7.3 must purge by a different route (signed URLs or an uncached API route); tell me the numbers.

## 3. CSP and inline scripts (FAIL as assumed; decided, built in Story 1.6)

Built a static `[locale]` page with `experimental.sri` (sha256). Findings on `/en`:

- 15 `<script>` tags: 7 external (5 got an `integrity` attribute) and **8 inline**: the Turbopack bootstrap and several `self.__next_f.push([...])` calls that carry the page's own render data.
- The inline data scripts differ on every page and change when a topic is revalidated. So `script-src 'self'` plus a fixed hash list would block them and break hydration, and per-page hashes cannot be known ahead for pages created on demand.

**Decision (owner, 2026-11-26): option 1.** AD-17 is amended; Story 1.6 implements it. Options were:

1. **`script-src 'self' 'unsafe-inline'`** with every other directive strict (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `connect-src` limited). Risk is moderate here: visitors have no accounts, no untrusted HTML is ever rendered (AD-14), and topics are validated data. Keeps pages static. **Chosen.**
2. Nonce-based CSP: strictest, but forces every page dynamic, losing static delivery and the 3 s page target margin.
3. Hash allowlist generated per page at build and per revalidation: strict and static, but needs custom build and revalidation machinery for every published topic; fragile.

## 4. next-intl root params (PASS)

`/[locale]` and `/[locale]/topic/[id]` with `generateStaticParams` and `dynamicParams = true`, next-intl 4.16.2 reading the locale from `next/root-params`:

- Build output: `/en`, `/ur`, `/en/topic/a`, `/ur/topic/a` prerendered as SSG.
- `<html lang dir>` correct (`en`/`ltr`, `ur`/`rtl`).
- Topics not in `generateStaticParams` (`/en/topic/zzz`, `/ur/topic/new1`) render on demand with HTTP 200 and are then cached (`x-nextjs-cache: HIT`).
- Note: `experimental.rootParams` is no longer needed in 16.4; it prints a warning. Do not set it.

## 5. Noto Nastaliq Urdu subset (measured; decided)

**Decision (owner, Story 1.2):** regular weight 400 only, 124 KB, shipped in `public/fonts/`. The measurements below show why.

Font: Noto Nastaliq Urdu variable TTF from the google/fonts repository (OFL), 690 KB. Subsets used Arabic block U+0600-06FF, digits and basic punctuation, ZWNJ, with all layout features kept, as WOFF2:

| Subset | WOFF2 |
| --- | --- |
| Variable, tight (Arabic block + digits) | 195 KB |
| Variable, wider (adds Latin, presentation forms) | 219 KB |
| Static weight 400, tight | 125 KB |
| Static weight 700, tight | 121 KB |

Budget is 150 KB. One static weight fits; the variable font and 400 plus 700 (about 246 KB) do not. DESIGN.md uses regular for body and bold for Urdu headings. Options for Story 1.2: (a) body in 400 only, headings use the same weight with larger size, no bold file (fits, 125 KB) / (b) 400 first, load 700 later after first paint (about 246 KB total, but not on the critical path) / (c) raise the budget to about 250 KB. Fallback text shows first in every case. Tell me which; the design colors and sizes are unchanged by this.

Commands used (run in an empty scratch folder; needs `uv`):

```
curl -sL -o font.ttf "https://github.com/google/fonts/raw/main/ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf"
uv run --with fonttools --with brotli python -m fontTools.varLib.instancer font.ttf wght=400 -o w400.ttf
uv run --with fonttools --with brotli python -m fontTools.subset w400.ttf --unicodes="U+0600-06FF,U+0020-0039,U+060C,U+061F,U+200C" --layout-features='*' --flavor=woff2 --output-file=w400-tight.woff2
```

The bundle spike was a Next page with `dynamic(() => import('./Scene3D'), { ssr: false })` around an `@react-three/fiber` `Canvas`, `katex.renderToString` on the server, and `next build`; sizes are gzip of `.next/static/chunks/*.js`, initial set = chunks referenced by the built `index.html`. The CSP spike was `experimental: { sri: { algorithm: 'sha256' } }` and counting `<script>` tags in `.next/server/app/en.html`.

## 6. Supabase TOTP and `aal2` (pending owner)

Needs the same Supabase project as spike 2.

1. In the dashboard, enable MFA (TOTP) under Authentication. Create one admin user by SQL or dashboard (no sign-up).
2. In a scratch script with `supabase-js`, sign in with password, call `mfa.enroll({factorType: 'totp'})`, verify a code from an authenticator app, then confirm `getAuthenticatorAssuranceLevel()` returns `currentLevel: 'aal2'` and that a session without the code stays `aal1`.
3. Confirm a server route can read the level from the verified JWT claims (`aal` claim).

Story 1.4 shipped before this ran (owner decision 2026-11-26). The code to check is `src/server/admin/supabase-adapters.ts`: `getClaims()` must return `aal`, `email` and `sub`; `mfa.enroll`, `mfa.challengeAndVerify` and `auth.admin.mfa.deleteFactor` must behave as used. Also run the migration on the project (`supabase/migrations/0001_admin_and_audit.sql`), insert your user into `admin_user`, and sign in end to end. Also prove the takeover case: with only the password (aal1) and one verified factor, call `mfa.enroll` and `mfa.challengeAndVerify` for a second factor directly against the Auth API. Supabase must refuse, or the session must stay aal1. If it grants aal2, the admin is not safe until that is closed. Set the JWT expiry short (about 1 hour) in the dashboard. Record pass or fail. If the `aal` claim is not available server-side as assumed, Story 1.4 must check factors through the Auth API instead.
