-- Story 1.5: the math tree and the topic tables (AD-19, AD-22).
-- Same rules as 0001 (AD-8): row level security with no policy on every table, nothing for anon or
-- authenticated, and the server's service role (BYPASSRLS) is the only way in.

-- Supabase grants new objects to anon and authenticated by default; never again.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- The tree: category > subcategory > chapter. Slugs are permanent identifiers; names have both languages.
create table public.category (
  id         text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 64),
  name_en    text not null check (char_length(btrim(name_en)) between 1 and 120),
  name_ur    text not null check (char_length(btrim(name_ur)) between 1 and 120),
  position   integer not null check (position >= 0),
  created_at timestamptz not null default now()
);

create table public.subcategory (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 64),
  category_id text not null references public.category (id) on delete restrict,
  name_en     text not null check (char_length(btrim(name_en)) between 1 and 120),
  name_ur     text not null check (char_length(btrim(name_ur)) between 1 and 120),
  position    integer not null check (position >= 0),
  created_at  timestamptz not null default now()
);
create index subcategory_category_idx on public.subcategory (category_id, position);

create table public.chapter (
  id             text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 64),
  subcategory_id text not null references public.subcategory (id) on delete restrict,
  name_en        text not null check (char_length(btrim(name_en)) between 1 and 120),
  name_ur        text not null check (char_length(btrim(name_ur)) between 1 and 120),
  position       integer not null check (position >= 0),
  created_at     timestamptz not null default now()
);
create index chapter_subcategory_idx on public.chapter (subcategory_id, position);

-- A slug is reserved forever, even after the topic row is hard-deleted (AD-19).
create table public.topic_slug (
  slug       text primary key,
  created_at timestamptz not null default now()
);

create table public.topic (
  id             text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 80),
  chapter_id     text not null references public.chapter (id) on delete restrict,
  level          text not null check (level in ('foundation', 'intermediate', 'advanced')),
  chapter_order  integer not null check (chapter_order >= 0),
  wave           smallint not null check (wave >= 1),
  latest_hash    text,
  published_hash text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  -- A deleted topic is never published (FR-9.11): unpublish first.
  constraint topic_deleted_is_unpublished check (deleted_at is null or published_hash is null)
);
create index topic_chapter_idx on public.topic (chapter_id, chapter_order) where deleted_at is null;

create table public.topic_version (
  topic_id     text not null references public.topic (id) on delete cascade,
  content_hash text not null check (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  seq          integer not null check (seq >= 1),
  doc          jsonb not null,
  cost         integer not null default 0 check (cost >= 0),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  primary key (topic_id, content_hash),
  unique (topic_id, seq)
);

-- `published_hash` is the only publication state (`topic_version.published_at` is informational, set by the publish saga). It is one column, so two published versions of a
-- topic cannot exist, and it must name a version of this same topic. A null skips the check
-- (MATCH SIMPLE): that is "unpublished". Same for `latest_hash`.
alter table public.topic
  add constraint topic_published_version_fk
    foreign key (id, published_hash) references public.topic_version (topic_id, content_hash),
  add constraint topic_latest_version_fk
    foreign key (id, latest_hash) references public.topic_version (topic_id, content_hash);

-- Published topics are never edited in place (SRS 6.2): a stored version is immutable except for
-- the time it was published.
create function public.topic_version_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.topic_id is distinct from old.topic_id
     or new.content_hash is distinct from old.content_hash
     or new.seq is distinct from old.seq
     or new.doc is distinct from old.doc
     or new.cost is distinct from old.cost
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'topic_version is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger topic_version_no_edit before update on public.topic_version
  for each row execute function public.topic_version_immutable();

-- Reserve the slug when a topic is created; a second topic with the same slug (even after the
-- first was hard-deleted) fails on the primary key of topic_slug. An upsert of a topic that already
-- exists therefore also fails; callers insert once and update afterwards.
create function public.topic_reserve_slug() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.topic_slug (slug) values (new.id);
  return new;
end;
$$;
create trigger topic_slug_reserve before insert on public.topic
  for each row execute function public.topic_reserve_slug();

-- The slug of a topic never changes.
create function public.topic_slug_fixed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id then
    raise exception 'topic id is permanent' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger topic_id_fixed before update on public.topic
  for each row execute function public.topic_slug_fixed();

alter table public.category    enable row level security;
alter table public.subcategory enable row level security;
alter table public.chapter     enable row level security;
alter table public.topic_slug  enable row level security;
alter table public.topic       enable row level security;
alter table public.topic_version enable row level security;

revoke all on public.category, public.subcategory, public.chapter, public.topic_slug, public.topic, public.topic_version
  from public, anon, authenticated;
revoke all on function public.topic_version_immutable(), public.topic_reserve_slug(), public.topic_slug_fixed()
  from public, anon, authenticated;

-- Supabase grants service_role everything, TRUNCATE included, and TRUNCATE skips the row triggers
-- above: take it all away, then give back only what the app needs.
revoke all on public.category, public.subcategory, public.chapter, public.topic, public.topic_version from service_role;
grant select, insert, update, delete on public.category, public.subcategory, public.chapter, public.topic, public.topic_version to service_role;
-- Tighten the 0001 tables the same way. They are written only by the security definer functions of
-- 0001; admin accounts are created by migration or seed, never by the app (AD-8).
revoke all on public.admin_user, public.login_throttle, public.admin_recovery_code from service_role;
grant select on public.admin_user to service_role;

-- The slug reservation is never edited or deleted.
revoke all on public.topic_slug from service_role;
grant select, insert on public.topic_slug to service_role;
