# Environments (AD-24)

| | Local | Preview (every pull request) | Production |
| --- | --- | --- | --- |
| `APP_ENV` | `development` | `preview` | `production` |
| `SUPABASE_DB_SCHEMA` | `public` | `preview_<name>` (throwaway) | `public` |
| Supabase key | local Supabase CLI stack | the preview project's own key (never the production key) | the production service-role key |
| Data | seed and fixtures | synthetic | real |

The app refuses a mismatch: `APP_ENV=preview` with `public`, or any other environment with a `preview_*` schema, makes the database environment invalid and the admin disabled (`src/db/env.ts`, tested in `tests/unit/db-env.test.ts`).

## Rate limiting and the service key

`ratelimit()` hashes the client address with the service-role key plus the day. Rotating that key changes every bucket (limits start fresh); that is harmless, but know it. On Vercel a missing database configuration makes the limiter answer 503 rather than switch off, and `/api/health` report `down`. The sweeper functions `rate_limit_sweep()` and `error_log_purge()` exist but nothing schedules them yet (deferred: the daily job).

HSTS is sent as `max-age=31536000` without `includeSubDomains`. Raise it (and add `includeSubDomains`) once every subdomain of the final product domain serves HTTPS. `NEXT_PUBLIC_STORAGE_ORIGIN` (the Supabase Storage origin) must be set for production builds, or topic JSON and thumbnails are blocked by the CSP; a build warns when it is set but unusable.

## The preview schema

Every migration is written with `public.` qualified names so it can be retargeted. CI proves the migrations apply cleanly and stay locked down both in `public` and in a `preview_ci` schema (`scripts/check-migrations.mjs`).

To create a preview schema, generate the SQL and run it on the preview database:

```
node scripts/check-migrations.mjs --emit preview_pr12 > preview_pr12.sql
```

Then give the deployment `APP_ENV=preview` and `SUPABASE_DB_SCHEMA=preview_pr12`, and add the schema to **Exposed schemas** under Data API settings in Supabase (without that, `db: { schema }` is refused at run time). Drop the schema (`drop schema preview_pr12 cascade;`) when the pull request closes; nothing does that automatically yet. Never put real data in it. Names are `preview_` plus up to 55 lowercase letters, digits or underscores.

On Vercel, `VERCEL_ENV` is set by the platform and must agree with `APP_ENV`; a preview deployment that forgot `APP_ENV=preview` is refused instead of falling back to `public`.

## Owner steps (not doable from code)

1. In Vercel, scope `SUPABASE_SERVICE_ROLE_KEY` to **Production** only. A Supabase service-role key is a JWT for the `service_role` role and cannot be limited to one schema, so the realistic way to give Preview its own key is a **separate Supabase project** used only for previews (its own URL, anon key and service-role key, with `preview_*` schemas or `public`; if it holds only synthetic data the production guard is simply that it is another project). Code cannot tell which project a key belongs to; the Vercel scoping is the real guard (AD-24: a pull request never holds the production key). Check it once: a Preview deployment must fail to read production data.
2. Turn off "automatic exposure of system environment variables" if it is on, and keep Auto Approval of private-repo committers off.
3. Run `supabase/migrations/0001` to `0004` on the production project through the reviewed, manual-approval path.
4. After the first deploy, check on the live domain: `curl -I http://<domain>` redirects to `https://` (Vercel does this by default), and the HTTPS response carries `Strict-Transport-Security`. Point the external uptime monitor at `/api/health` (it answers 503 when the database is down).
5. Have the Urdu category names in `0003_seed_categories.sql` checked (NFR-6.4). Renaming later is done in the admin (Story 7.5), not by editing the migration.
