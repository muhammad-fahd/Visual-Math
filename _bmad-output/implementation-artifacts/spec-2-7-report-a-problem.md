---
title: 'Story 2.7: Report a problem'
type: 'feature'
created: '2026-11-27'
status: 'done'
baseline_commit: '62895d608b201b22278fe04619d6004d641a5cc9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/coding-standard.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-6-security-baseline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A visitor who finds a mistake in a topic has no way to tell the owner, and the owner has nowhere to see it (FR-2.4).

**Approach:** A "Report a problem" button on the topic page opens a sheet with a reason and a note (up to 500 characters). Send posts to a rate-limited public route that stores the topic id, reason and note in a new `problem_report` table, grouping repeats of the same report for one topic; a toast thanks the visitor. The admin list is Story 7.6 and is not built here.

## Boundaries & Constraints

**Always:**
- Public handler rules (AD-26, AD-9): the route calls `ratelimit()` first, validates the body with a strict Zod schema, and returns the error envelope. No Server Action, no cookie, no identifier of the visitor; nothing but topic id, reason, note and time is stored.
- The note is untrusted text: NFC-normalized, control and bidi-override characters removed, whitespace collapsed and trimmed, capped at 500 characters, on the server (the client only counts). It is never rendered as HTML anywhere.
- Same report twice for one topic (same reason and same normalized note, not yet handled) is one row with a repeat count, and the second sender still sees the thanks.
- Database access only through `security definer` functions for `service_role`; row level security on, nothing for `anon` or `authenticated` (AD-8). Reports are kept until handled plus 12 months (AD-17); the purge function exists, the daily job is not scheduled here.
- The sheet is a modal dialog: focus moves in, Tab stays inside, Esc and Cancel close it, focus returns to the button; the toast is a polite live region. Buttons at least 44 px, logical CSS, Urdu mirrors. Strings in `report.*` (Urdu are drafts).

**Never:**
- No admin screen, no email, no admin alert (Story 7.6 and the alerts of Epic 7); no free-text field beyond the note; no email or name field.
- Do not trust the topic id: it must match the topic id format, but no existence check is made (a topic can be unpublished while a page is open).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Send | reason "Wrong math", note "The volume is off", topic `geo-cone-volume` | 204; one row; sheet closes; toast "Thank you. We will check it." | N/A |
| Note too long | 501 characters | the box stops at 500 (counter shows it); the server refuses 501 with 400 | message "The note is too long." |
| Note empty | reason set, no note | accepted for a reason other than "Something else"; for "Something else" a note is required | message names the field |
| Bad characters | note with control and bidi-override characters | they are removed before the length check and storage | N/A |
| Repeat | same reason and note for the same topic, again | no new row, `repeats` +1, still 204 | N/A |
| Different note, same topic | another note | a new row | N/A |
| Too many sends | over the limit from one client | 429 with Retry-After; sheet says to wait and keeps the note | the note is never cleared on an error |
| Server down | no database or an error | 503; sheet says it could not send, keeps the note, Send can be tried again | no detail leaked |
| Bad body | extra key, wrong type, bad topic id, unknown reason | 400 with the envelope | no row |
| Keyboard | open, Tab, Esc | focus stays in the sheet; Esc closes and returns focus to the button | N/A |
| Urdu | `/ur` | sheet and toast in Urdu, mirrored; the note is typed in either direction | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0005_problem_report.sql` (new) -- `problem_report`, `report_problem()` (insert or repeat), `problem_report_purge()`; `scripts/check-migrations.mjs` applies it; the existing migration tests are the pattern.
- `src/lib/report/` (new, pure) -- reasons, `cleanNote`, the Zod body schema shared by the route and the sheet.
- `src/server/reports.ts` (new, `server-only`) -- `saveReport()` through `adminClient().rpc`; `src/app/api/report/route.ts` (new) -- `ratelimit` first, `readBody`, `guarded`; copy the shape of `src/app/api/log/route.ts`.
- `src/features/topic/ReportProblem.tsx` (new), mounted by `TopicPage.tsx`; the native `<dialog>` is used, no new dependency.
- `src/i18n/messages/{en,ur}.json` -- `report.*`.
- `tests/unit/` -- note cleaning, body schema, route (mocked server pieces like `security-routes.test.ts`), migration on PGlite; `tests/e2e/report.spec.ts` (new, harness page) with the route intercepted for failure cases.
- `docs/environments.md`, `docs/coding-standard.md` -- the new table, limits and retention.
- Do not change the limiter, the log route or the topic page layout.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0005_problem_report.sql` and its test -- table, functions, privileges, grouping, purge -- AD-8, AD-17
- [x] `src/lib/report/*`, `src/server/reports.ts`, `src/app/api/report/route.ts` and tests -- clean, validate, limit, store -- AD-14, AD-26, FR-2.4
- [x] `src/features/topic/ReportProblem.tsx`, `TopicPage.tsx`, messages -- sheet, counter, errors, toast, focus -- UX-DR9
- [x] `tests/e2e/report.spec.ts`, docs -- send, errors that keep the note, keyboard, Urdu

**Acceptance Criteria:**
- Given any topic page, when the visitor presses "Report a problem", then a sheet opens with a reason and a note of at most 500 characters, and Send stores the topic id, reason and note.
- Given the same report sent again for one topic, when it arrives, then it is grouped on the existing row and the visitor still sees the thanks.
- Given repeated sends, when the limit is passed, then the route answers 429 and the sheet asks the visitor to wait without losing the note.
- Given a report, when stored, then no address, cookie or identifier of the visitor is stored with it.
- Given `npm run check` and Playwright (Chrome and Edge), when run, then both pass.

## Implementation Notes

- Files: `supabase/migrations/0005_problem_report.sql`, `src/lib/report/{index,schema}.ts`, `src/server/reports.ts`, `src/app/api/report/route.ts`, `src/features/topic/ReportProblem.tsx` (mounted in `TopicPage`), `report.*` messages, docs.
- Decisions: reasons are `wrong-math`, `unclear`, `urdu`, `scene`, `other` ("something else" needs a note); repeats are one row with a count, grouped in the database by a SHA-256 key over a partial unique index; the limit is 6 per 10 minutes per client and 2 per 10 minutes per client and topic; without a database the route says 503 rather than pretend. Nothing leaves with a report but topic id, reason and note.
- Surprises: zod in the browser bundle (found by `check-bundle`, the check earned its place); Playwright treats `aria-disabled` as disabled, a native dialog's Tab can leave to the browser, and the Next route announcer is also `role="alert"`.
- Tests: 1296 unit and 400 browser tests (Chrome and Edge) pass, including the migration on a real Postgres (PGlite), and the route with its real limiter order.
- Not done on purpose: the admin list (Story 7.6), the daily purge job, a per-topic cap on open reports.

## Spec Change Log

## Review Triage Log

Three reviewers (blind, edge-case, verification-gap), each claim checked against the code. One more thing came from running the checks rather than from a reviewer: the bundle scan failed because the first version of `lib/report` imported zod into the visitor's bundle.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| `saveReport` was never run with its real arguments: a renamed `p_topic_id` would fail every real report and nothing would say so | high | patch: `tests/unit/report-store.test.ts` asserts the function and argument names, the SQL signature, error and no-database results |
| `lib/report` imported zod, which shipped in the browser bundle (`new Function(` in a chunk, caught by `check-bundle`) | high | patch: the schema moved to `lib/report/schema.ts` (server only); a test keeps the browser file free of imports |
| The textarea's `maxLength` counts UTF-16 units: 250 emoji filled the box while the counter said 250 of 500 | medium | patch: no `maxLength`; the box keeps 500 characters by code point; e2e with 600 emoji |
| The per-topic limiter name was cut at 60 characters, so two long topic ids with one start shared a bucket | medium | patch: the id is hashed into the name; unit test |
| A refused note (too long, empty "something else") used up the per-topic quota, so the retry got 429 | medium | patch: the note is checked before the topic limit; unit test |
| A `Retry-After` that is not a number showed "NaN minutes" | medium | patch: falls back to 1 minute; e2e |
| U+0085 was deleted, gluing two words; a lone surrogate (valid in JSON) would make the database refuse the text and give a misleading 503; a note of only joiners passed as a note | medium | patch: NEL is a word break, lone surrogates dropped, joiner-only text is an empty note (and "something else" refuses it); unit and e2e tests |
| Esc or Cancel while a report was in flight, then a new draft, then the old answer clearing it | medium | patch: Esc and Cancel wait for the answer |
| A text selection that ends on the backdrop closed the sheet | low | patch: the press must start and end on the backdrop; e2e |
| After a validation error, focus stayed on Send and the error stayed after the fix | low | patch: focus goes to the note, the error clears on an edit or a new reason; e2e |
| The second thank-you was cut short by the first one's timer; the note box had no `dir="auto"`; the counter forced left to right inside an Urdu sentence | low | patch: a counter restarts the timer; `dir="auto"`; the counter follows the text |
| The sheet said nothing about not writing personal details in a stored note | medium | patch: one sentence in the intro, in both languages |
| A cookie would be sent with a report if one existed | low | patch: `credentials: 'omit'` (a report carries no cookie) |
| The topic id is only checked for format, so a sender can store reports for ids that do not exist; open reports are never purged | medium | defer: by the spec ("never") a topic may be unpublished while its page is open; Story 7.6 decides a cap per topic and what to do with reports for unknown topics |
| Retention is not wired: `problem_report_purge()` is called by nothing | low | defer: the daily job (already listed for the other purge functions); documented |
| `lower()` in the note key depends on the database's collation | low | accept: all Supabase databases are `C.UTF-8` or `en_US.UTF-8`; a difference only splits one repeat into two rows |
| "The feature is not wired in", "no report.* keys", "TopicPage does not mount it" | false | the review diff left out the `.json` messages and the `TopicPage` hunk; both are present, and the e2e tests open the sheet on the harness page |
| "Tab stays inside the sheet" is not strict: Tab may leave to the browser's own controls | low | accept: that is how a native modal dialog works and the page behind stays inert; the e2e test says so (the topic page is never reached) |
| The 500-exception test makes `saved.push` throw | low | accept: it drives the route's catch-all through the mocked store; the 500 path of `guarded` is shared and tested elsewhere |

## Design Notes

The sheet is a native `<dialog>` opened with `showModal()`: the browser provides the focus trap, Esc, the backdrop and the inert page behind it. Duplicates are found in the database by a key (SHA-256 of the lower-cased, collapsed note) with a partial unique index over unhandled reports, so two simultaneous identical sends cannot make two rows.
