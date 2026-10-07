-- Transactional import: concurrent/repeated upload polls cannot add the same term twice.
create or replace function public.import_course_vocabulary(p_course text, p_week integer, p_terms jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
  extracted_count integer;
begin
  if p_course not in ('COM5103','COM5101','COM5501','COM5104') or p_course is null
     or p_week is null or p_week < 1 or p_week > 13 then
    raise exception 'Invalid course or week';
  end if;
  if p_terms is null or jsonb_typeof(p_terms) <> 'array' then
    raise exception 'Terms must be an array';
  end if;
  if jsonb_array_length(p_terms) > 1500 then raise exception 'Too many terms'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_terms) term
    where jsonb_typeof(term) <> 'object'
      or jsonb_typeof(term->'english') is distinct from 'string'
      or jsonb_typeof(term->'chinese') is distinct from 'string'
      or length(btrim(term->>'english')) not between 1 and 200
      or length(btrim(term->>'chinese')) not between 1 and 500
  ) then raise exception 'Invalid vocabulary entry'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vocabulary:' || p_course || ':' || p_week, 0));
  with candidates as (
    select distinct on (lower(btrim(term->>'english')))
      btrim(term->>'english') as english, btrim(term->>'chinese') as chinese
    from jsonb_array_elements(p_terms) with ordinality as source(term, position)
    order by lower(btrim(term->>'english')), position
  ), added as (
    insert into public.vocabulary_data(device_user,course,week,english,chinese,word_type)
    select 'semester-vocabulary-shared',p_course,p_week,c.english,c.chinese,'Professional term'
    from candidates c
    where not exists (select 1 from public.vocabulary_data v
      where v.course=p_course and v.week=p_week and lower(btrim(v.english))=lower(c.english))
    returning id
  ) select count(*) into inserted_count from added;
  select count(distinct lower(btrim(term->>'english'))) into extracted_count
    from jsonb_array_elements(p_terms) term;
  return jsonb_build_object('inserted',inserted_count,'skipped',extracted_count-inserted_count);
end;
$$;
revoke all on function public.import_course_vocabulary(text,integer,jsonb) from public;
grant execute on function public.import_course_vocabulary(text,integer,jsonb) to anon, authenticated, service_role;
