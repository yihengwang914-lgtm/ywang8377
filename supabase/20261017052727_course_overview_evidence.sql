-- Authenticated, RLS-bound, deterministic document sampling; never combines courses.
create function public.courselex_overview_evidence(p_course uuid)
returns table(source_id uuid,filename text,week integer,ordinal integer,content text)
language sql stable security invoker set search_path='' as $$
 with owned as (
  select s.id,s.filename,s.week,row_number() over(partition by s.week order by s.created_at,s.id) as per_week
  from public.user_learning_sources s
  where s.user_id=(select auth.uid()) and s.course_id=p_course
 ), files as (
  select * from owned order by per_week,week,id limit 60
 ), positions as (
  select f.id,f.filename,f.week,c.ordinal,c.content,row_number() over(partition by f.id order by c.ordinal) as pos,
   count(*) over(partition by f.id) as total
  from files f join public.user_learning_chunks c on c.source_id=f.id and c.user_id=(select auth.uid())
 ) select id,filename,week,ordinal,content from positions
 where pos=1 or pos=(total+1)/2 or pos=total
 order by week,filename,ordinal;
$$;
revoke all on function public.courselex_overview_evidence(uuid) from public,anon;
grant execute on function public.courselex_overview_evidence(uuid) to authenticated;
