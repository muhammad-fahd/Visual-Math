-- Story 1.6: the shared rate limiter (AD-28) and the first-party error log (AD-26).
-- Same rules as before (AD-8): row level security with no policy, nothing for anon or authenticated,
-- only service_role, and only through the functions below.

-- One counter per (key, window). The key is a salted, daily-rotating hash computed by the server;
-- no address is ever stored. Rows older than an hour are swept.
create table public.rate_limit (
  key          text primary key check (char_length(key) between 16 and 128),
  window_start timestamptz not null default now(),
  count        integer not null default 0 check (count >= 0)
);

-- Scrubbed errors from the browser or the server. No IP, no cookie, no full URL. Kept 30 days.
create table public.error_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  request_id text not null check (char_length(request_id) between 8 and 64),
  kind       text not null check (kind in ('client', 'server')),
  path       text not null check (char_length(path) <= 200),
  message    text not null check (char_length(message) <= 500),
  detail     text check (detail is null or char_length(detail) <= 2000)
);
create index error_log_at_idx on public.error_log (at);

alter table public.rate_limit enable row level security;
alter table public.error_log  enable row level security;

revoke all on public.rate_limit, public.error_log from public, anon, authenticated;
revoke all on sequence public.error_log_id_seq from public, anon, authenticated;
revoke all on public.rate_limit, public.error_log from service_role;
grant select, insert on public.error_log to service_role;
grant usage on sequence public.error_log_id_seq to service_role;

-- Counts one call atomically and answers whether it is allowed. When the window has passed the
-- counter starts over. `retry_after` is the seconds left in the window when the call is refused.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after integer)
language plpgsql security definer set search_path = '' as $$
declare r public.rate_limit;
begin
  -- At most an hour: rate_limit_sweep() deletes rows older than that, which would cut a longer window short.
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'invalid limit' using errcode = '22023';
  end if;
  insert into public.rate_limit (key) values (p_key) on conflict (key) do nothing;
  select * into r from public.rate_limit where key = p_key for update;
  if r.window_start <= now() - make_interval(secs => p_window_seconds) then
    r.window_start := now();
    r.count := 0;
  end if;
  if r.count >= p_limit then
    allowed := false;
    retry_after := greatest(1, ceil(extract(epoch from (r.window_start + make_interval(secs => p_window_seconds) - now())))::integer);
  else
    r.count := r.count + 1;
    allowed := true;
    retry_after := 0;
  end if;
  update public.rate_limit set window_start = r.window_start, count = r.count where key = p_key;
  return next;
end;
$$;

-- Appends one scrubbed error. The server has already scrubbed; the checks above are the backstop.
create function public.log_error(p_request_id text, p_kind text, p_path text, p_message text, p_detail text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.error_log (request_id, kind, path, message, detail) values (p_request_id, p_kind, p_path, p_message, p_detail);
$$;

-- Retention (AD-17): rate-limit keys 1 hour, error log 30 days. The daily job calls these.
create function public.rate_limit_sweep() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.rate_limit where window_start < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.error_log_purge() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.error_log where at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function
  public.rate_limit_hit(text, integer, integer),
  public.log_error(text, text, text, text, text),
  public.rate_limit_sweep(),
  public.error_log_purge()
  from public, anon, authenticated;
grant execute on function
  public.rate_limit_hit(text, integer, integer),
  public.log_error(text, text, text, text, text),
  public.rate_limit_sweep(),
  public.error_log_purge()
  to service_role;
