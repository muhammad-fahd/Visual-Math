-- Story 2.7: "Report a problem" (FR-2.4, AD-26). A visitor sends a topic id, a reason and a short note.
-- Nothing else about the visitor is stored: no address, no cookie, no identifier. Same rules as before
-- (AD-8): row level security with no policy, nothing for anon or authenticated, only service_role, and
-- writes only through the function below.

create table public.problem_report (
  id           bigint generated always as identity primary key,
  topic_id     text not null check (topic_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(topic_id) between 3 and 64),
  reason       text not null check (reason in ('wrong-math', 'unclear', 'urdu', 'scene', 'other')),
  note         text not null default '' check (char_length(note) <= 500),
  -- SHA-256 of the note lower-cased with its spaces collapsed: the same report sent twice has the same key.
  note_key     text not null check (char_length(note_key) = 64),
  repeats      integer not null default 1 check (repeats >= 1),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  handled      boolean not null default false,
  handled_at   timestamptz,
  check (handled = (handled_at is not null))
);
-- One open row per (topic, reason, note): two sends at the same moment cannot make two rows.
create unique index problem_report_open_key on public.problem_report (topic_id, reason, note_key) where not handled;
create index problem_report_topic_idx on public.problem_report (topic_id, handled);
create index problem_report_handled_idx on public.problem_report (handled_at) where handled;

alter table public.problem_report enable row level security;
revoke all on public.problem_report from public, anon, authenticated;
revoke all on sequence public.problem_report_id_seq from public, anon, authenticated;
revoke all on public.problem_report from service_role;
grant select on public.problem_report to service_role; -- the admin list (Story 7.6) reads; it changes rows through its own functions

-- Stores one report, or counts a repeat of an open one for the same topic. The server has already cleaned
-- the note; the checks above are the backstop.
create function public.report_problem(p_topic_id text, p_reason text, p_note text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.problem_report (topic_id, reason, note, note_key)
  values (
    p_topic_id, p_reason, p_note,
    encode(sha256(convert_to(lower(regexp_replace(btrim(p_note), '\s+', ' ', 'g')), 'UTF8')), 'hex')
  )
  on conflict (topic_id, reason, note_key) where not handled
  do update set repeats = public.problem_report.repeats + 1, last_seen_at = now();
$$;

-- Retention (AD-17): handled reports go 12 months after they were handled. The daily job calls this.
create function public.problem_report_purge() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.problem_report where handled and handled_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.report_problem(text, text, text), public.problem_report_purge() from public, anon, authenticated;
grant execute on function public.report_problem(text, text, text), public.problem_report_purge() to service_role;
