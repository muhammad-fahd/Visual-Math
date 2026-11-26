---
title: 'Story 1.5: Database, math tree tables and seed'
type: 'feature'
created: '2026-11-26'
status: 'done'
baseline_commit: '7b3323e7dda1effa8b3c787ddd5ee7f127983257'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-admin-sign-in-with-a-second-step-and-the-audit-writer.md'
  - '{project-root}/docs/coding-standard.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The only tables are the admin ones. Content has no home: no math tree, no topics or versions, no rule that stops two published versions, and nothing in CI that stops a table shipping without row level security.

**Approach:** Add migrations for the tree (`category`, `subcategory`, `chapter`) and content (`topic`, `topic_version`, a slug reservation), seed the twelve categories with English and Urdu names, and add a CI check that applies every migration on a real Postgres (PGlite) and fails on a table without RLS or any grant to `anon` or `authenticated`. Add the environment guard so preview uses a throwaway schema and production keys cannot be configured for it.

## Boundaries & Constraints

**Always:** Forward-only SQL in `supabase/migrations/`. Every table has row level security and no policy; default privileges for `anon` and `authenticated` are revoked; only `service_role` is granted access, and only what it needs. Names are snake_case, singular. Slugs are lowercase letters, digits and hyphens. Both languages are required on every tree name. `published_hash` is the only publication state and must reference a version of the same topic. The seed never overwrites an admin's later edit.

**Never:** No other AD-22 tables (`content_upload`, `setting`, `problem_report`, `contact_message`, `publish_job`, `rate_limit`, `error_log`, `usage_counter`, `topic_prerequisite`): they arrive with the stories that use them. No subcategories or chapters seeded (Story 7.5). No topic upload, no repositories. No editing of an applied migration: `0001` stays as it is.

**Decisions:** Urdu category names are AI drafts for the admin check (NFR-6.4). Preview environment is declared by `APP_ENV=preview`, which requires a schema named `preview_*` and refuses the production schema; production requires `public`. The key itself is scoped in Vercel (owner step, recorded in `docs/environments.md`): code cannot tell which project a key belongs to.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seed | all migrations applied | 12 categories in SRS 5.2 order, ids are slugs, `name_en` and `name_ur` set (Urdu script) | N/A |
| Re-apply seed | admin renamed a category, seed runs again | the rename stays; no duplicate | N/A |
| One published version | set `published_hash` to a version of the same topic | allowed; exactly one per topic by construction | a hash of another topic or a missing hash is refused |
| Unpublished | `published_hash` null | allowed | N/A |
| Delete rule | `deleted_at` set while `published_hash` is set | refused | check constraint |
| Slug reuse | topic hard-deleted, same slug inserted again | refused | slug stays reserved |
| Version edit | change `doc`, `content_hash`, `seq` of a stored version | refused; only `published_at` may change | trigger |
| Version identity | same `(topic_id, content_hash)` or `(topic_id, seq)` twice | refused | primary key / unique |
| Bad values | slug with capitals, level not in the three, hash not `sha256:` + 64 hex, empty name | refused | check constraints |
| Browser roles | `anon` or `authenticated` reads, writes or calls anything | refused | no privilege |
| CI check | a migration adds a table without RLS, or grants to `anon` | `npm run check` fails and names the table | script exit 1 |
| Preview env | `APP_ENV=preview` with schema `public` | env invalid, admin disabled | fails closed |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0001_admin_and_audit.sql` -- exists; the pattern: RLS, revokes, `service_role` grants, `security definer` + `set search_path = ''`. Do not edit.
- `tests/unit/audit-migration.test.ts` -- PGlite harness with stubbed roles and Supabase default privileges; hard-codes the four tables, must become "contains".
- `src/db/env.ts` -- Zod env; add `APP_ENV` and `SUPABASE_DB_SCHEMA`; `src/db/admin.ts` passes the schema.
- `package.json` `check` script and `scripts/check-static-routes.mjs` -- pattern for a CI script with exported functions and a CLI entry.
- AD-19, AD-22, AD-24, SRS 5.2, `docs/spikes.md`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0002_math_tree_and_topics.sql` -- default-privilege revokes, tree tables, `topic`, `topic_version`, `topic_slug`, triggers, RLS, grants
- [x] `supabase/migrations/0003_seed_categories.sql` -- the twelve categories, idempotent
- [x] `scripts/check-migrations.mjs` -- apply all migrations on PGlite; fail on RLS, grant, policy and view problems; exports functions for tests
- [x] `src/db/env.ts`, `src/db/admin.ts` -- `APP_ENV`, schema rules, schema passed to the client
- [x] `tests/unit/{math-tree-migration,migration-check,db-env}.test.ts`; update `audit-migration.test.ts`
- [x] `docs/environments.md`, `.env.example`, `package.json` (`check` runs the script), `docs/coding-standard.md`, `deferred-work.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given the migrations, a table without row level security fails CI, and `anon` and `authenticated` have no table privileges.
- Given the seed, the 12 categories exist with names in English and Urdu, and no subcategory or chapter exists.
- Given `topic` and `topic_version`, a second published version of one topic is not representable.
- Given the preview and production environments, preview uses a schema named `preview_*` and production `public`; a mismatch disables the admin.


## Review Triage Log

Three reviewers (blind, edge-case, verification-gap). Claims checked against the code.

| Finding | Verdict | Route / evidence |
| --- | --- | --- |
| `service_role` kept TRUNCATE (and the 0001 tables full access); TRUNCATE skips the immutability triggers | high | patch: revoke all, grant only what is needed, also for the 0001 tables; tests |
| `adminClient` passing the schema is untested; a regression would put a preview on `public` | medium | patch: `db-admin.test.ts` |
| A preview deployment without `APP_ENV` parses as development on `public` | medium | patch: `VERCEL_ENV` must agree with `APP_ENV`; tests |
| Entry-point test can silently skip the whole check | medium | patch: compare real paths; the script is also run first in `npm run check` |
| Misnamed or duplicate-numbered migration files skipped by CI but applied in production | medium | patch: refused with a clear error; tests |
| `forSchema` blind replace (`mypublic.`, quoted names, `on schema public`) | medium | patch: word-boundary regex, `on/in schema`; tests |
| Security definer function without a fixed `search_path` not checked | medium | patch: new check; test |
| Preview recipe incomplete (grants, exposed schemas) and key advice unrealistic | medium | patch: `--emit` command, docs rewritten, separate preview project recommended |
| Preview name limit 40 in code, 63 in Postgres | low | patch: 55 shared; tests |
| PGlite instance leaked on a SQL error | low | patch: closed |
| Tests depend on earlier tests' rows; assert only "throws" | low | patch: own setup, `permission denied` matched |
| `npm run check` runs the migration check last | low | patch: moved before the tests |
| Misc docs: pending steps not pointed to from spikes.md; upsert and `published_at` wording | low | patch |
| Alter default privileges for `supabase_admin` | medium | defer: cannot run on PGlite; owner step on the real project (below) |
| No uniqueness on positions within a parent | low | defer: Story 7.5 designs reordering (deferrable unique) |
| `published_at` can disagree with `published_hash`; versions deletable | low | defer: the publish saga (Story 7.x) owns `published_at`; deleting a topic must still cascade |
| Rejected environment gives no reason | low | defer: report through `/api/log` (Story 1.6) |
| Column-level grants to anon not checked | low | defer: unlikely with default-privilege model; add with the Supabase-run check |
| Re-running the seed brings back a deleted category | low | rejected: migrations run once; only a manual re-run |
| Check duplicated between the test and `npm run check` | low | rejected: both are cheap; the script is the CI gate, the test proves it fails correctly |
| `as unknown as SupabaseClient` cast | low | rejected: schema is a run-time value, the cast is commented |
| `topic_slug.slug` has no format check; `latest_hash` seq ordering | low | rejected: slugs only enter through `topic`'s checked id; ordering is the upload service's rule (Story 7.2) |

## Implementation Notes
- After review fixes: 295 unit tests. `0002` also tightens the 0001 tables (`service_role` keeps only SELECT on `admin_user`) because 0001 is not deployed anywhere yet and Supabase's default grants include TRUNCATE.
- Owner step on the real project: run `alter default privileges for role supabase_admin in schema public revoke all on tables, sequences, functions from anon, authenticated;` (PGlite has no such role).
