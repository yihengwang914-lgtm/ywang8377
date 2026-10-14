grant update(english,chinese) on public.user_vocabulary to authenticated;
create function public.import_material_vocabulary(p_course uuid,p_week integer,p_terms jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;total integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if jsonb_typeof(p_terms) is distinct from 'array' or jsonb_array_length(p_terms)>1500 then raise exception 'Invalid terms'; end if;
 if not exists(select 1 from public.user_courses where id=p_course and user_id=auth.uid() and not archived and p_week between 1 and weeks) then raise exception 'Invalid course'; end if;
 perform pg_advisory_xact_lock(hashtextextended('material-words:'||auth.uid()::text||p_course::text,0));
 with candidates as(select distinct on(lower(btrim(t->>'english'))) btrim(t->>'english') en,btrim(t->>'chinese') zh from jsonb_array_elements(p_terms) t order by lower(btrim(t->>'english'))),added as(
 insert into public.user_vocabulary(user_id,course_id,week,english,chinese)
 select auth.uid(),p_course,p_week,en,zh from candidates c where not exists(select 1 from public.user_vocabulary v where v.user_id=auth.uid() and v.course_id=p_course and lower(btrim(v.english))=lower(c.en) and btrim(v.chinese)=c.zh)
 on conflict do nothing returning id)
 select count(*) into n from added;
 select count(distinct lower(btrim(t->>'english'))) into total from jsonb_array_elements(p_terms) t;
 return jsonb_build_object('inserted',n,'skipped',total-n);
end;$$;
revoke all on function public.import_material_vocabulary(uuid,integer,jsonb) from public,anon;
grant execute on function public.import_material_vocabulary(uuid,integer,jsonb) to authenticated;
