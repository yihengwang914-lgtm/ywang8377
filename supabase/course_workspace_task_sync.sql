alter table public.user_course_events add column thread_id uuid, add column task_id uuid,
 add constraint calendar_task_pair check((thread_id is null)=(task_id is null)),
 add constraint calendar_thread_owner foreign key(thread_id,user_id) references public.user_learning_threads(id,user_id) on delete cascade;
create index calendar_thread_owner on public.user_course_events(thread_id,user_id);
create or replace function public.commit_courselex_learning(p_thread uuid,p_user uuid,p_owner uuid,p_messages jsonb,p_reviews jsonb default '[]')
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
 update public.user_course_events e set done=coalesce((task->>'done')::boolean,false)
 from jsonb_array_elements(p_messages) m cross join lateral jsonb_array_elements(coalesce(m->'plan'->'tasks','[]'::jsonb)) task
 where e.user_id=p_user and e.thread_id=t.id and e.course_id=t.course_id and e.task_id=(task->>'id')::uuid;
 return true;
end;$$;
-- Existing service-only grants remain; clients cannot write grading messages.
