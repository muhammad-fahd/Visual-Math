-- Story 5.4: the published document of one topic, for the topic page (AD-19). `loadTopic(id)` on the server is the
-- only caller. A topic is live only when `published_hash` is set and it is not deleted; anything else, and an id that
-- does not exist, gives null, so an unpublished or deleted topic can never be read through this function (FR-1.9).
-- Read-only; same access rules as before (AD-8): the service role only.

create function public.published_topic(p_id text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select v.doc
  from public.topic t
  join public.topic_version v on v.topic_id = t.id and v.content_hash = t.published_hash
  where t.id = p_id and t.published_hash is not null and t.deleted_at is null;
$$;

revoke all on function public.published_topic(text) from public, anon, authenticated;
grant execute on function public.published_topic(text) to service_role;
