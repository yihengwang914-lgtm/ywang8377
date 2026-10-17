-- Rank meaningful query terms disjunctively: a natural-language question is not
-- an exact phrase that every source chunk must contain. Course/owner/week stay hard filters.
create or replace function public.search_courselex_learning(p_course uuid,p_query text,p_week integer default 0,p_overview boolean default false)
returns table(source_id uuid,filename text,week integer,ordinal integer,content text)
language sql stable security invoker set search_path='' as $$
 with words as (
  select distinct lower(w) as term from regexp_split_to_table(left(p_query,500),'[^[:alnum:]_]+') w
  where length(w)>2 and w !~ '^\d+$' and lower(w)<>all(array['the','and','that','this','with','from','what','which','when','where','why','how','does','not','are','for','please','explain','summarize','summarise','teacher','professor','lecture','course','week','notes','content','contents','slides','based','according','tell','about','understand','help','give','example','question','want','could','would','should','have','has','was','were','been','will','can','you','your','our','their','its','into']) limit 40
 ), query as (
  select case when count(*)>0 then to_tsquery('simple',string_agg(quote_literal(term),' | ')) else null end as tsq from words
 ), candidates as (
  select s.id,s.filename,s.week,c.ordinal,c.content,
   coalesce(ts_rank_cd(to_tsvector('simple',c.content),q.tsq),0)+
   case when length(btrim(p_query))>0 and position(lower(left(p_query,80)) in lower(c.content))>0 then 2 else 0 end as score
  from public.user_learning_sources s join public.user_learning_chunks c on c.source_id=s.id cross join query q
  where s.user_id=(select auth.uid()) and c.user_id=(select auth.uid()) and s.course_id=p_course and (p_week=0 or s.week=p_week)
 ), ranked as (
  select *,row_number() over(partition by id order by score desc,ordinal) as per_source from candidates
 ) select id,filename,week,ordinal,content from ranked
 order by case when p_overview then per_source else 0 end,score desc,per_source,week,filename,ordinal limit 12;
$$;
revoke all on function public.search_courselex_learning(uuid,text,integer,boolean) from public,anon;
grant execute on function public.search_courselex_learning(uuid,text,integer,boolean) to authenticated;
