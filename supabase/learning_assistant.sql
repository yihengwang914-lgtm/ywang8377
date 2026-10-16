-- Additive migration: retain extracted teaching text and persist private learning.
create table public.user_learning_sources (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid not null, filename text not null, week integer not null check(week between 1 and 52),
 content_hash text not null, content_chars integer not null check(content_chars between 1 and 500000),
 created_at timestamptz not null default now(), unique(user_id,course_id,content_hash), unique(id,user_id),
 foreign key(course_id,user_id) references public.user_courses(id,user_id) on delete cascade
);
create index learning_sources_course on public.user_learning_sources(course_id,user_id);
create index learning_sources_owner on public.user_learning_sources(user_id,created_at);
create table public.user_learning_chunks (
 source_id uuid not null, user_id uuid not null, ordinal integer not null check(ordinal>0), content text not null check(length(content) between 1 and 1800),
 primary key(source_id,ordinal), foreign key(source_id,user_id) references public.user_learning_sources(id,user_id) on delete cascade
);
create index learning_chunks_owner on public.user_learning_chunks(user_id);
create index learning_chunks_source_owner on public.user_learning_chunks(source_id,user_id);
create table public.user_learning_threads (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid, title text not null default '新的学习对话' check(length(title)<=120),
 messages jsonb not null default '[]' check(jsonb_typeof(messages)='array' and jsonb_array_length(messages)<=120 and octet_length(messages::text)<500000),
 lock_owner uuid, locked_until timestamptz not null default '-infinity',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
 foreign key(course_id,user_id) references public.user_courses(id,user_id) on delete cascade
);
create index learning_threads_owner on public.user_learning_threads(user_id,updated_at desc);
create index learning_threads_course on public.user_learning_threads(course_id,user_id);
create table public.user_learning_reviews (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 thread_id uuid not null, course_id uuid not null, question jsonb not null,
 streak integer not null default 0 check(streak>=0), attempts integer not null default 1 check(attempts>0),
 due_at timestamptz not null, last_answered_at timestamptz not null default now(),
 foreign key(thread_id,user_id) references public.user_learning_threads(id,user_id) on delete cascade,
 foreign key(course_id,user_id) references public.user_courses(id,user_id) on delete cascade
);
create index learning_reviews_due on public.user_learning_reviews(user_id,due_at);
create index learning_reviews_thread on public.user_learning_reviews(thread_id,user_id);
create index learning_reviews_course on public.user_learning_reviews(course_id,user_id);
alter table public.user_learning_sources enable row level security;
alter table public.user_learning_chunks enable row level security;
alter table public.user_learning_threads enable row level security;
alter table public.user_learning_reviews enable row level security;
revoke all on public.user_learning_sources,public.user_learning_chunks,public.user_learning_threads,public.user_learning_reviews from public,anon,authenticated;
-- Correct answers and grading state are server-only. Extracted text remains user-readable under RLS.
grant select on public.user_learning_sources,public.user_learning_chunks to authenticated;
grant all on public.user_learning_sources,public.user_learning_chunks,public.user_learning_threads,public.user_learning_reviews to service_role;
create policy learning_sources_owner on public.user_learning_sources for select to authenticated using((select auth.uid())=user_id);
create policy learning_chunks_owner on public.user_learning_chunks for select to authenticated using((select auth.uid())=user_id);
create policy learning_sources_server on public.user_learning_sources to service_role using(true) with check(true);
create policy learning_chunks_server on public.user_learning_chunks to service_role using(true) with check(true);
create policy learning_threads_server on public.user_learning_threads to service_role using(true) with check(true);
create policy learning_reviews_server on public.user_learning_reviews to service_role using(true) with check(true);

-- Trigger runs as service_role, which creates import jobs. No privileged client RPC.
create function public.retain_courselex_learning_source() returns trigger language plpgsql security invoker set search_path='' as $$
declare body text; sid uuid; hash text; total bigint;
begin
 select string_agg(value,E'\n' order by ord) into body from jsonb_array_elements_text(new.parts) with ordinality t(value,ord);
 if body is null or btrim(body)='' or body='已清理' then return new; end if;
 hash:=md5(body);
 perform pg_advisory_xact_lock(hashtextextended('learning-source:'||new.user_id::text,0));
 if exists(select 1 from public.user_learning_sources where user_id=new.user_id and course_id=new.course and content_hash=hash) then return new; end if;
 select coalesce(sum(content_chars),0) into total from public.user_learning_sources where user_id=new.user_id;
 if total+length(body)>2000000 then raise exception 'LEARNING_SOURCE_QUOTA'; end if;
 insert into public.user_learning_sources(user_id,course_id,filename,week,content_hash,content_chars)
 values(new.user_id,new.course,new.filename,new.week,hash,length(body)) returning id into sid;
 insert into public.user_learning_chunks(source_id,user_id,ordinal,content)
 select sid,new.user_id,row_number() over(order by pos),substr(body,pos,1800) from generate_series(1,length(body),1600) pos;
 return new;
end;$$;
revoke all on function public.retain_courselex_learning_source() from public,anon,authenticated;
create trigger courselex_retain_learning_source after insert on public.user_courseware_jobs for each row execute function public.retain_courselex_learning_source();

create function public.search_courselex_learning(p_course uuid,p_query text,p_week integer default 0,p_overview boolean default false)
returns table(source_id uuid,filename text,week integer,ordinal integer,content text) language sql stable security invoker set search_path='' as $$
 with candidates as (
  select s.id,s.filename,s.week,c.ordinal,c.content,
   ts_rank_cd(to_tsvector('simple',c.content),plainto_tsquery('simple',left(p_query,500)))+
   case when position(lower(left(p_query,80)) in lower(c.content))>0 then 2 else 0 end score,
   row_number() over(partition by s.id order by c.ordinal) sequence
  from public.user_learning_sources s join public.user_learning_chunks c on c.source_id=s.id
  where s.user_id=(select auth.uid()) and s.course_id=p_course and (p_week=0 or s.week=p_week)
 ), ranked as (
  select *,row_number() over(partition by id order by score desc,ordinal) per_source from candidates
 ) select id,filename,week,ordinal,content from ranked
 order by case when p_overview then per_source else 0 end,score desc,week,filename,ordinal limit 12;
$$;
revoke all on function public.search_courselex_learning(uuid,text,integer,boolean) from public,anon;
grant execute on function public.search_courselex_learning(uuid,text,integer,boolean) to authenticated;

-- Commit a graded turn and its next review atomically; retries cannot advance a schedule twice.
create function public.commit_courselex_learning(p_thread uuid,p_user uuid,p_owner uuid,p_messages jsonb,p_reviews jsonb default '[]')
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.user_learning_threads; r jsonb;
begin
 select * into t from public.user_learning_threads where id=p_thread and user_id=p_user and lock_owner=p_owner for update;
 if t.id is null then return false; end if;
 for r in select value from jsonb_array_elements(p_reviews) loop
  if t.course_id is null or (r->>'course_id')::uuid<>t.course_id then raise exception 'Invalid review course'; end if;
  insert into public.user_learning_reviews(id,user_id,thread_id,course_id,question,streak,attempts,due_at)
  values((r->>'id')::uuid,p_user,t.id,t.course_id,r->'question',(r->>'streak')::integer,(r->>'attempts')::integer,(r->>'due_at')::timestamptz)
  on conflict(id) do update set question=excluded.question,streak=excluded.streak,attempts=excluded.attempts,due_at=excluded.due_at,last_answered_at=now()
  where public.user_learning_reviews.user_id=p_user;
 end loop;
 update public.user_learning_threads set messages=p_messages,lock_owner=null,locked_until='-infinity',updated_at=now() where id=t.id;
 return true;
end;$$;
revoke all on function public.commit_courselex_learning(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_courselex_learning(uuid,uuid,uuid,jsonb,jsonb) to service_role;
