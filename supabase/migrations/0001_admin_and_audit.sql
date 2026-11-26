-- Story 1.4: admin users, the append-only audit log, the login throttle and recovery codes.
-- Forward-only (AD-24). Every table has row level security and NO policy: anon and authenticated
-- reach nothing, and only the server's service role (BYPASSRLS) reads or writes (AD-8).

create table public.admin_user (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Who did what to what, when. No foreign key on admin_id: the row must outlive the account.
create table public.audit_log (
  id       bigint generated always as identity primary key,
  admin_id uuid not null,
  action   text not null check (action ~ '^[a-z][a-z0-9_.]{0,63}$'),
  target   text not null check (char_length(target) <= 200),
  at       timestamptz not null default now()
);

-- One failure counter per hashed email (never the email itself).
create table public.login_throttle (
  key          text primary key check (char_length(key) between 16 and 128),
  failures     integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

-- Only SHA-256 hashes of the codes exist.
create table public.admin_recovery_code (
  admin_id   uuid not null references public.admin_user (user_id) on delete cascade,
  code_hash  text not null check (char_length(code_hash) = 64),
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  primary key (admin_id, code_hash)
);

alter table public.admin_user          enable row level security;
alter table public.audit_log           enable row level security;
alter table public.login_throttle      enable row level security;
alter table public.admin_recovery_code enable row level security;

revoke all on public.admin_user, public.audit_log, public.login_throttle, public.admin_recovery_code
  from public, anon, authenticated;
revoke all on sequence public.audit_log_id_seq from public, anon, authenticated;

-- The service role may read admins and the log. It never updates or deletes the log (and the
-- trigger below stops everyone else, including the table owner).
revoke all on public.audit_log from service_role;
grant select, insert on public.audit_log to service_role;
grant usage on sequence public.audit_log_id_seq to service_role;
grant select on public.admin_user to service_role;

-- Append-only: refused for every role, row by row and for TRUNCATE.
create function public.audit_log_refuse_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_refuse_change();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_refuse_change();

-- The one way to write the log. Every admin write is a function that does its change and then
-- calls this, so both happen in one transaction (FR-9.13).
create function public.record_audit(p_admin uuid, p_action text, p_target text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  insert into public.audit_log (admin_id, action, target) values (p_admin, p_action, p_target)
  returning id into new_id;
  return new_id;
end;
$$;

-- Returns when the account is locked until, or null when it is free to try.
create function public.login_status(p_key text) returns timestamptz
language sql security definer set search_path = '' as $$
  select locked_until from public.login_throttle where key = p_key and locked_until > now();
$$;

-- Counts one failed attempt atomically; returns the lock end when this failure locked the account.
-- A failure during a lock changes nothing, so an attacker cannot extend it.
create function public.login_failure(p_key text, p_max integer, p_window_seconds integer, p_lock_seconds integer)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare r public.login_throttle;
begin
  insert into public.login_throttle (key) values (p_key) on conflict (key) do nothing;
  select * into r from public.login_throttle where key = p_key for update;
  if r.locked_until is not null and r.locked_until > now() then
    return r.locked_until;
  end if;
  if r.window_start < now() - make_interval(secs => p_window_seconds) or r.locked_until is not null then
    r.failures := 0;
    r.window_start := now();
    r.locked_until := null;
  end if;
  r.failures := r.failures + 1;
  if r.failures >= p_max then
    r.locked_until := now() + make_interval(secs => p_lock_seconds);
  end if;
  update public.login_throttle
     set failures = r.failures, window_start = r.window_start, locked_until = r.locked_until
   where key = p_key;
  return r.locked_until;
end;
$$;

create function public.login_clear(p_key text) returns void
language sql security definer set search_path = '' as $$
  delete from public.login_throttle where key = p_key;
$$;

-- Replaces the admin's unused recovery codes with a new set, in one transaction.
create function public.replace_recovery_codes(p_admin uuid, p_hashes text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.admin_recovery_code where admin_id = p_admin and used_at is null;
  insert into public.admin_recovery_code (admin_id, code_hash)
    select p_admin, h from unnest(p_hashes) as h;
  perform public.record_audit(p_admin, 'recovery_codes.issued', p_admin::text);
end;
$$;

-- True exactly once per code.
create function public.consume_recovery_code(p_admin uuid, p_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare hit integer;
begin
  update public.admin_recovery_code set used_at = now()
   where admin_id = p_admin and code_hash = p_hash and used_at is null;
  get diagnostics hit = row_count;
  if hit = 1 then
    perform public.record_audit(p_admin, 'recovery_code.used', p_admin::text);
  end if;
  return hit = 1;
end;
$$;

-- Undo a consume when the reset it was for did not happen.
create function public.restore_recovery_code(p_admin uuid, p_hash text) returns void
language sql security definer set search_path = '' as $$
  update public.admin_recovery_code set used_at = null where admin_id = p_admin and code_hash = p_hash;
$$;

-- Functions are executable by PUBLIC unless revoked.
revoke all on function
  public.record_audit(uuid, text, text),
  public.login_status(text),
  public.login_failure(text, integer, integer, integer),
  public.login_clear(text),
  public.replace_recovery_codes(uuid, text[]),
  public.consume_recovery_code(uuid, text),
  public.restore_recovery_code(uuid, text),
  public.audit_log_refuse_change()
  from public, anon, authenticated;
grant execute on function
  public.record_audit(uuid, text, text),
  public.login_status(text),
  public.login_failure(text, integer, integer, integer),
  public.login_clear(text),
  public.replace_recovery_codes(uuid, text[]),
  public.consume_recovery_code(uuid, text),
  public.restore_recovery_code(uuid, text)
  to service_role;
