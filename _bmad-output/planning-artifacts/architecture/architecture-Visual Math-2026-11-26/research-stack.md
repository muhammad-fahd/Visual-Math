# Stack research for Visual Math (verified 2026-11-26)

> **Update 2026-11-26 (SRS change).** This research was done for the Axiora SRS. Version numbers, hosting, font and rendering findings still stand and feed the Stack table. The student-login, class-code, school-isolation and per-student sections no longer apply: version 1 has no visitor accounts, only one admin (Supabase Auth with TOTP). Sections on synthetic student emails, anonymous sign-in and custom access-token claims are kept only as history.


Method: npm registry (/latest), GitHub releases API, and official docs fetched today. Items marked UNVERIFIED were not confirmed from a primary source in this pass.

## 1. Next.js and React
- Next.js 16.4.6 is npm "latest" (GitHub release 2026-11-09, a bug-fix backport). 16.5.0 canaries run daily through 2026-11-23, so it is actively maintained. 15.x is only on backport tags (15.5.29).
- React 19.3.1 is latest (2026-10-14); 19.2.9, 19.1.10 and 19.0.9 patch releases shipped the same day.
- Next 16 requires Node 20.9+. middleware.ts is deprecated in favour of proxy.ts, which runs on the Node runtime only (no edge). A codemod is available.
- Static export (output: 'export') does NOT support: cookies, redirects/rewrites/headers, Proxy, ISR, Server Actions, the default image loader, dynamic routes without generateStaticParams.
- Caveat: "mostly static plus auth" means choosing one of two shapes. Either (a) full static export with client-side Supabase auth and RLS (host anywhere, e.g. Cloudflare Pages or any CDN), or (b) the Node server / Vercel runtime with proxy.ts and cookie sessions via @supabase/ssr. Pick (b) only if SSR auth or per-tenant server rendering is needed.
- Verdict: OK.
- Sources: https://registry.npmjs.org/-/package/next/dist-tags ; https://api.github.com/repos/vercel/next.js/releases/tags/v16.4.6 ; https://api.github.com/repos/facebook/react/releases ; https://nextjs.org/docs/app/guides/static-exports ; https://nextjs.org/docs/messages/middleware-to-proxy

## 2. three.js, @react-three/fiber, drei
- three 0.187.0 (r187, 2026-10-30). Monthly cadence: r186 on 2026-09-24, r185 on 2026-07-01. Maintained.
- @react-three/fiber 9.8.2 (2026-10-15). Peer: react >=19 <19.4, three >=0.156. A v10 alpha exists (10.0.0-alpha.6); not for production.
- @react-three/drei 10.7.9 (2026-09-25). Peer: react ^19, three >=0.159, fiber ^9. A v11 alpha exists.
- Compatibility: fiber 9 and drei 10 need React 19, so they fit React 19.3.1 and Next 16. The pin range <19.4 means watch for a React 19.4 bump.
- Mobile performance (30 fps on a 3 GB Android):
  - frameloop="demand" with invalidate(), since math scenes are mostly static.
  - Cap dpr at about [1, 1.5]. Use drei PerformanceMonitor to lower dpr on decline. Use regress() during interaction.
  - Reuse geometries and materials. Use instancing and keep draw calls in the low hundreds (the r3f docs say well under 1000, ideally a few hundred).
  - Avoid heavy postprocessing and shadows. Dispose on unmount.
  - Lazy-load the 3D chunk (dynamic import, ssr:false) so 2D-only lessons stay light. Provide a 2D fallback or lower-quality mode. Handle WebGL context loss.
  - Test on a real low-end device. No official 30 fps guarantee exists, so budget it yourself.
- Verdict: OK. Caveat: pin versions, since r3f and drei majors are in alpha and peer ranges are strict.
- Sources: https://registry.npmjs.org/three/latest ; https://registry.npmjs.org/@react-three/fiber/latest ; https://registry.npmjs.org/@react-three/drei/latest ; https://api.github.com/repos/mrdoob/three.js/releases ; https://api.github.com/repos/pmndrs/react-three-fiber/releases ; https://api.github.com/repos/pmndrs/drei/releases ; https://r3f.docs.pmnd.rs/advanced/scaling-performance

## 3. Safe expression evaluator
- mathjs 15.3.0 (2026-11-23) is latest. 15.2.0 (2026-04-07) fixed two High (CVSS 8.8) arbitrary-JS-execution flaws via the expression parser:
  - CVE-2026-41139 (GHSA-5v89-rwgr-qj6g), unsafe array index getter. Affects >=13.1.0 <15.2.0. Published 2026-04-17. A further "array index getter" advisory, GHSA-jvff-x2qm-6286, was published 2026-04-10 (not opened).
  - CVE-2026-40897 (GHSA-29qv-4j9f-fjw5), unsafe object property setter. Affects 13.1.1 to <15.2.0.
  - No workaround other than upgrading.
- Three High advisories in one month means the parser sandbox is not a trust boundary for hostile input.
- mathjs official security page: it no longer uses eval (v4+), but unknown vulnerabilities may remain. Recommendations:
  - Disable import, createUnit, reviver, and also evaluate, parse, simplify, derivative and resolve by overriding them with throwing functions.
  - Run in a Web Worker or child process and kill it on timeout or memory overrun (workerpool suggested). No numeric limits are provided, and huge matrices can pin the CPU.
- expr-eval (silentmatt): CVE-2025-12735 (critical RCE, CERT/CC VU#263614, Nov 2025) affects <=2.0.2. CVE-2025-13204 (prototype pollution) is reported unfixed in the original. The fork expr-eval-fork 3.0.1 is reported as fixing it (not re-verified on npm). The GitHub advisory page lists none, and the original looks effectively unmaintained. Avoid it.
- Recommendation: for AI-authored, unreviewed input, prefer a small custom parser (Pratt or shunting-yard) with a whitelist grammar (numbers, variables, + - * / ^, a fixed function set), node-count and depth caps, and a step budget. It is roughly 150 lines, has no property access by construction, and is easy to fuzz. Compile to an AST or closure that uses Math.* only. If mathjs is wanted for features, use >=15.3.0 with restricted scope plus a worker plus a timeout, and validate the parsed AST against an allow-list (SymbolNode, ConstantNode, OperatorNode, FunctionNode with whitelisted names; reject AccessorNode, ObjectNode, AssignmentNode, FunctionAssignmentNode). Re-check advisories on each release.
- Verdict: mathjs = caveat. expr-eval = avoid. Custom whitelist parser = recommended.
- Sources: https://mathjs.org/docs/expressions/security.html ; https://github.com/josdejong/mathjs/security/advisories ; https://github.com/josdejong/mathjs/security/advisories/GHSA-5v89-rwgr-qj6g ; https://github.com/josdejong/mathjs/security/advisories/GHSA-29qv-4j9f-fjw5 ; https://raw.githubusercontent.com/josdejong/mathjs/develop/HISTORY.md ; https://kb.cert.org/vuls/id/263614 ; https://nvd.nist.gov/vuln/detail/CVE-2025-12735 ; https://github.com/silentmatt/expr-eval/security/advisories

## 4. KaTeX and 2D alternatives
- KaTeX 0.19.1 (2026-10-23; 0.19.0 on 2026-10-01). Maintained, still 0.x.
- RTL/Urdu caveats:
  - KaTeX has no native RTL or Arabic-script math. Issue #3550 "Equation should be properly rendered in RTL context" is closed. Open #1934 "Port arabic-mathjax" is not implemented.
  - Rendered math inherits the surrounding direction, which misaligns display equations in an RTL page. Workaround: wrap math in dir="ltr" (CSS: .katex-display>.katex>.katex-html { direction: ltr }) and use unicode-bidi: isolate. (Source for the CSS tip is a community post, not KaTeX docs.)
  - Urdu words inside \text{} will not be shaped or ordered reliably. Keep Urdu text in surrounding HTML and keep math LTR. Arabic/Persian numerals and letters in math are not natively supported (issues #212, #729, #476 closed).
  - Urdu school math usually uses Western numerals anyway.
- JSXGraph 1.14.3 (2026-11-06). Very active (three releases in about two weeks). A full-featured 2D geometry and graph library. Heavy, and not React-native, so wrap it in a ref. Labels are SVG/canvas text, so RTL labels need testing. Licence is LGPL/MIT dual (from memory, UNVERIFIED).
- function-plot 1.26.0 (2026-10-11). Maintained but slower cadence (1.25.4 on 2026-04-26, 1.25.3 on 2026-01-03). Built on d3, function graphs only. Check how it evaluates strings before feeding it untrusted expressions; pass it your own safe compiled function instead.
- Verdict: KaTeX ok with caveat (math stays LTR, Urdu prose outside). JSXGraph ok for interactive geometry, at a bundle cost. function-plot caveat: narrow scope.
- Sources: https://api.github.com/repos/KaTeX/KaTeX/releases ; https://github.com/KaTeX/KaTeX/issues?q=is%3Aissue+rtl+OR+arabic ; https://community.openai.com/t/request-to-fix-katex-rendering-issues-for-rtl-languages/1117054 ; https://api.github.com/repos/jsxgraph/jsxgraph/releases ; https://api.github.com/repos/mauriciopoppe/function-plot/releases

## 5. Supabase
- Plans (pricing page):
  - Free: $0. 50,000 MAU. 500 MB DB. 5 GB egress. 1 GB storage. Project paused after 1 week of inactivity. No backups. Shared CPU, 500 MB RAM. 2 active projects.
  - Pro: from $25/month. 100,000 MAU included, then $0.00325 per MAU. 8 GB disk. 250 GB egress. 100 GB storage. Never paused. Daily backups kept 7 days. $10 compute credit covers a Micro instance (1 GB RAM). Spend cap on by default.
  - Thousands of students fit within MAU on either tier. For production schools use Pro (pausing and no backups rule out Free).
- EU regions (choose a specific one, not the generic "Europe" option, which can land on London or Zurich): eu-central-1 Frankfurt, eu-west-1 Ireland, eu-west-3 Paris, eu-north-1 Stockholm. The region cannot be changed later (migrate to a new project). Supabase says region choice "is a data-location control, not proof of regulatory compliance", so a DPA and GDPR review are still needed.
- Auth: email (password, magic link, OTP), phone (needs an SMS provider), social, SAML SSO, anonymous sign-ins, third-party JWT. RLS is Postgres-native and is the main tenancy tool.
- Login by code or username without email (custom patterns, not first-class):
  - Anonymous sign-in: a real authenticated user with an is_anonymous claim. Linking to a permanent identity is manual. Identity is lost on sign-out or cleared storage. IP rate limit 30 per hour by default (adjustable). CAPTCHA/Turnstile recommended. No auto-cleanup. Weak fit for classroom codes on shared school Wi-Fi unless the limit is raised.
  - Synthetic email pattern: a generated address per student (for example a username at a reserved domain) with signInWithPassword, email confirmation off, or admin createUser with email_confirm via the service role in a server route. The fetched docs do not describe this explicitly, so UNVERIFIED as a documented pattern, though it works technically. Use strong generated passwords for children.
  - Custom Access Token hook (Free and Pro) can inject claims such as school_id and role for RLS. Before User Created hook is also on Free and Pro.
  - Alternative: mint your own JWT signed with the project secret from a server route after verifying a class code. Powerful, but you own the security.
  - Phone + password is possible, but Supabase discourages it because of recycled numbers.
- Verdict: ok with caveat. No native username login, so use the synthetic-email or custom-JWT pattern, and pin the EU region at creation.
- Sources: https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/regions ; https://supabase.com/docs/guides/auth ; https://supabase.com/docs/guides/auth/auth-anonymous ; https://supabase.com/docs/guides/auth/passwords ; https://supabase.com/docs/guides/auth/auth-hooks

## 6. next-intl
- next-intl 4.16.2 (2026-11-25), with releases on three consecutive days, so very active. The de-facto App Router i18n library.
- Supports App Router, Server Components, locale-based routing, and locale detection in the proxy. The configuration docs call setRequestLocale legacy (requestLocale is preferred), so check the current static-rendering guidance.
- RTL and fonts: next-intl does NOT handle them. Set <html lang dir> in the locale layout (dir="rtl" for ur) and switch fonts via CSS variables or next/font per locale. Use CSS logical properties and Tailwind rtl: variants.
- The locale proxy needs a Node server. Under a static export, use locale-prefixed routes with generateStaticParams and no proxy (UNVERIFIED in this pass; check next-intl's static export docs).
- Verdict: ok.
- Sources: https://api.github.com/repos/amannn/next-intl/releases ; https://next-intl.dev/docs/usage/configuration

## 7. Urdu fonts
- Noto Nastaliq Urdu: notofonts/nastaliq latest release NotoNastaliqUrdu-v4.000 ("a major re-engineering"; the page shows "17 Jul" without a year). Licence is SIL OFL 1.1 (standard for Noto fonts; not shown on the fetched release page, so confirm in the repo LICENSE). Free for commercial use and self-hosting.
- Google Fonts: available (Fontsource also serves it as variable-weight WOFF2 in subsets). The Google specimen page returned no details in this pass.
- File size: no official figure found. One Pakistani source (propakistani.pk) reports about 290 KB TTF and about 117 KB WOFF2 (anecdotal, possibly an older version). v4 may be larger, so measure it. Nastaliq fonts are heavy because of ligature and positioning tables.
- Approach:
  - Self-host via next/font/local or Fontsource (no runtime Google request, GDPR-friendly).
  - Subset with pyftsubset to the Arabic/Urdu ranges (U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F, plus Latin digits and punctuation) and keep layout features (--layout-features='*'). Do not strip GSUB/GPOS or Nastaliq shaping breaks. Output WOFF2.
  - Load only on the ur locale with font-display: swap and a Naskh fallback. Nastaliq needs generous line-height (about 2 or more).
- Verdict: ok. Caveat: measure the real subset size and do not over-subset.
- Sources: https://github.com/notofonts/nastaliq/releases ; https://fontsource.org/fonts/noto-nastaliq-urdu/cdn ; https://web.dev/articles/reduce-webfont-size ; https://propakistani.pk/?p=85730

## 8. Hosting
- Vercel: Hobby is free (100 GB Fast Data Transfer, 1M CDN requests, 1M function invocations, 4 Active CPU-hours, function max 300 s, 100 deployments per day). Vercel's terms restrict Hobby to personal/non-commercial use (from memory, UNVERIFIED: the fetched pages did not show the wording), so a commercial school product should assume Pro. Pro is $20/month per developer seat with $20 usage credit, 1 TB transfer, function max 800 s.
- Regions: 19 compute regions including fra1 (Frankfurt), cdg1 (Paris), dub1, lhr1, arn1 and bom1 (Mumbai). Functions DEFAULT to iad1 (Washington), so set the function region to fra1 (next to a Supabase Frankfurt project) for EU residency. 126 PoPs serve cached content globally, so "EU region" covers compute only, not where cached responses are served from.
- Alternative 1, Cloudflare: static assets are free and unlimited on Pages/Workers. Next.js on Workers via @opennextjs/cloudflare supports Next 16 and the latest 15, but it targets Node runtime with proxy.ts only experimental, Windows is not guaranteed (use WSL), the Workers bundle limit is 3 MiB free / 10 MiB paid compressed, and image optimization needs Cloudflare Images. A static export on Cloudflare Pages avoids all of that.
- Alternative 2, an EU VPS (e.g. Hetzner) running Node with Cloudflare in front: cheap and fully EU, but you own ops, patching and scaling (a cost for a solo developer).
- Latency: Cloudflare has had data centres in Karachi, Lahore and Islamabad since 2018 (a 2020 Internet Society measurement showed about 3 ms from a Pakistani network; current 2026 status UNVERIFIED, check Cloudflare's network map). Pakistan to Frankfurt round trips are typically 150-250 ms (typical figure, not measured here), so keep lessons static and edge-cached, avoid chatty API calls, and cache client-side. Cloudflare in front of Vercel is possible but Vercel does not recommend a reverse proxy (per Vercel's China-access doc). Cloudflare as primary static host, or in front of a VPS, does help Pakistan.
- Verdict: Vercel ok with caveat (Pro for commercial use, set region to fra1). Cloudflare Pages static export is the strongest fit for Pakistan latency. Choose one deliberately.
- Sources: https://vercel.com/pricing ; https://vercel.com/docs/plans/hobby ; https://vercel.com/docs/limits ; https://vercel.com/docs/regions ; https://opennext.js.org/cloudflare ; https://developers.cloudflare.com/pages/functions/pricing/ ; https://www.internetsociety.org/blog/2020/04/why-is-so-much-internet-traffic-leaving-pakistan/ ; https://propakistani.pk/2018/12/29/cloudflare-launches-three-data-centers-across-pakistan-for-faster-internet/

## 9. Validation
- Zod 4.6.7 (2026-10-12), with frequent releases through Sept and Oct. Actively maintained. TypeScript-first, good for typed lesson schemas with discriminated unions. Zod 4 has z.toJSONSchema (from memory, UNVERIFIED here) for handing a schema to the AI author.
- Ajv 8.20.0 (2026-04-24). Maintained, slower cadence. Best if the lesson schema must be a language-neutral JSON Schema consumed by the AI generator. Ajv compiles schemas with generated code, so only compile your own schemas, never untrusted ones.
- Recommendation: Zod as the source of truth with strict objects (reject unknown keys), string length and array size limits, a depth cap, and refine hooks that run the expression whitelist from section 3 at import time.
- Verdict: ok.
- Sources: https://api.github.com/repos/colinhacks/zod/releases ; https://api.github.com/repos/ajv-validator/ajv/releases

## Unverified items to re-check
- Vercel Hobby commercial-use wording.
- Noto Nastaliq Urdu v4 file size and licence text; Google Fonts specimen page.
- Cloudflare Pakistan PoPs in 2026.
- Whether expr-eval-fork 3.0.1 is on npm and fixed.
- next-intl static export guidance.
- Supabase synthetic-email login (works technically, not explicitly documented in fetched pages).
- npm publish dates for items where only GitHub release dates were found (mathjs 15.3.0 date comes from HISTORY.md).
