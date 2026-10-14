begin;

create function public.get_courselex_capacity()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, courselex_private, pg_temp
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from courselex_private.admin_users where user_id = auth.uid()
  ) then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'free_database_limit_bytes', 524288000,
    'user_vocabulary_bytes', pg_total_relation_size('public.user_vocabulary'::regclass),
    'total_words', (select count(*) from public.user_vocabulary),
    'representative_sync_bytes', coalesce((
      select max(payload_bytes) from (
        select octet_length(jsonb_agg(jsonb_build_object(
          'id', id, 'course', course_id, 'week', week, 'en', english, 'zh', chinese,
          'type', word_type, 'status', status, 'seen_count', seen_count,
          'wrong_count', wrong_count, 'legacy_id', legacy_id
        ))::text) payload_bytes
        from public.user_vocabulary group by user_id
      ) sizes
    ), 0),
    'recommended_full_scale_users', 300,
    'assumption', 'A full-scale user stores about 1,736 words and opens one full sync per day.'
  ) into payload;
  return payload;
end;
$$;

revoke all on function public.get_courselex_capacity() from public, anon;
grant execute on function public.get_courselex_capacity() to authenticated;

commit;
