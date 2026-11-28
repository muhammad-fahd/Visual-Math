-- Story 5.1: everything `rebuildCatalog()` needs, in one statement, so the catalog is built from one consistent
-- snapshot of the tree and the topics (AD-20). The server calls this and nothing else to build it.
--
-- A topic is "published" only through `published_hash` (a deleted topic never has one). For a published topic
-- the function returns the few fields of its published version that the catalog carries, not the whole
-- document. `ever_published` marks a topic that was published once and is not now, which is a tombstone.
-- Read-only; same access rules as before (AD-8): the service role only.

create function public.catalog_rows() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nameEn', c.name_en, 'nameUr', c.name_ur, 'position', c.position) order by c.position, c.id)
      from public.category c), '[]'::jsonb),
    'subcategories', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'parent', s.category_id, 'nameEn', s.name_en, 'nameUr', s.name_ur, 'position', s.position) order by s.position, s.id)
      from public.subcategory s), '[]'::jsonb),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'parent', h.subcategory_id, 'nameEn', h.name_en, 'nameUr', h.name_ur, 'position', h.position) order by h.position, h.id)
      from public.chapter h), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'chapter', t.chapter_id,
        'level', t.level,
        'chapterOrder', t.chapter_order,
        'publishedHash', t.published_hash,
        'deleted', t.deleted_at is not null,
        'everPublished', exists (select 1 from public.topic_version v where v.topic_id = t.id and v.published_at is not null),
        'meta', case when t.published_hash is null or t.deleted_at is not null then null else jsonb_build_object(
          'title', pv.doc -> 'title',
          'summary', pv.doc -> 'summary',
          'tags', pv.doc -> 'tags',
          'estimatedMinutes', pv.doc -> 'estimatedMinutes',
          'prerequisites', pv.doc -> 'prerequisites',
          'next', pv.doc -> 'next') end
      ) order by t.id)
      from public.topic t
      left join public.topic_version pv on pv.topic_id = t.id and pv.content_hash = t.published_hash), '[]'::jsonb)
  );
$$;

revoke all on function public.catalog_rows() from public, anon, authenticated;
grant execute on function public.catalog_rows() to service_role;
