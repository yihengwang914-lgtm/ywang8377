-- Private, source-versioned question pools. Answers are never readable by clients.
create table public.user_learning_question_banks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid not null, week integer not null check(week between 0 and 52),
 source_version text not null check(length(source_version)=64),
 questions jsonb not null default '[]' check(jsonb_typeof(questions)='array' and jsonb_array_length(questions)<=40),
 cursor integer not null default 0 check(cursor between 0 and 40),
 available integer generated always as (jsonb_array_length(questions)-cursor) stored,
 reservations jsonb not null default '{}' check(jsonb_typeof(reservations)='object'),
 status text not null default 'queued' check(status in ('queued','preparing','ready','failed')),
 lock_owner uuid, locked_until timestamptz not null default '-infinity',
 retry_after timestamptz not null default '-infinity',
 updated_at timestamptz not null default now(),
 unique(user_id,course_id,week),
 foreign key(course_id,user_id) references public.user_courses(id,user_id) on delete cascade
);
create index question_banks_course_owner on public.user_learning_question_banks(course_id,user_id);
alter table public.user_learning_question_banks enable row level security;
revoke all on public.user_learning_question_banks from public,anon,authenticated;
grant all on public.user_learning_question_banks to service_role;
create policy question_banks_server on public.user_learning_question_banks to service_role using(true) with check(true);

-- Claims use a per-course lock. Changing a source version invalidates only this
-- pool; old questions already served in conversations/reviews remain intact.
create function public.claim_courselex_question_bank(p_user uuid,p_course uuid,p_week integer,p_version text,p_owner uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.user_learning_question_banks;
begin
 if not exists(select 1 from public.user_courses where id=p_course and user_id=p_user and not archived and not is_shared_template) then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended('question-bank:'||p_user||':'||p_course||':'||p_week,0));
 insert into public.user_learning_question_banks(user_id,course_id,week,source_version)
 values(p_user,p_course,p_week,p_version) on conflict do nothing;
 select * into b from public.user_learning_question_banks where user_id=p_user and course_id=p_course and week=p_week for update;
 if b.status='preparing' and b.locked_until>now() then return null; end if;
 if b.source_version<>p_version then
  update public.user_learning_question_banks set source_version=p_version,questions='[]',cursor=0,reservations='{}',status='queued',retry_after='-infinity' where id=b.id;
  select * into b from public.user_learning_question_banks where id=b.id;
 end if;
 if b.retry_after>now() or jsonb_array_length(b.questions)-b.cursor>=5 then return null; end if;
 -- Once the bounded pool is exhausted, a new generation rotates it. Existing
 -- conversations carry their own immutable question copies and request cache.
 if jsonb_array_length(b.questions)>=35 then
  update public.user_learning_question_banks set questions='[]',cursor=0,reservations='{}' where id=b.id;
  select * into b from public.user_learning_question_banks where id=b.id;
 end if;
 update public.user_learning_question_banks set status='preparing',lock_owner=p_owner,locked_until=now()+interval '120 seconds',updated_at=now() where id=b.id;
 return to_jsonb(b);
end;$$;

create function public.take_courselex_questions(p_user uuid,p_course uuid,p_week integer,p_version text,p_request uuid,p_count integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.user_learning_question_banks; result jsonb;
begin
 if p_count<1 or p_count>5 then return null; end if;
 if not exists(select 1 from public.user_courses where id=p_course and user_id=p_user and not archived and not is_shared_template) then return null; end if;
 select * into b from public.user_learning_question_banks where user_id=p_user and course_id=p_course and week=p_week and source_version=p_version for update;
 if not found then return null; end if;
 if b.reservations ? p_request::text then
  -- Older pilot entries may contain full question objects; new entries store
  -- IDs only so retries do not duplicate every source excerpt in the pool.
  if jsonb_typeof(b.reservations->p_request::text->0)='object' then return b.reservations->p_request::text; end if;
  select jsonb_agg(q.value order by ids.ord) into result
  from jsonb_array_elements_text(b.reservations->p_request::text) with ordinality ids(id,ord)
  join jsonb_array_elements(b.questions) q(value) on q.value->>'id'=ids.id;
  return result;
 end if;
 if jsonb_array_length(b.questions)-b.cursor<p_count then return null; end if;
 select jsonb_agg(value order by ord) into result from jsonb_array_elements(b.questions) with ordinality q(value,ord) where ord>b.cursor and ord<=b.cursor+p_count;
 update public.user_learning_question_banks set status=case when status='preparing' then status when jsonb_array_length(questions)-cursor-p_count<5 then 'queued' else status end,cursor=cursor+p_count,reservations=reservations||jsonb_build_object(p_request::text,(select jsonb_agg(value->>'id') from jsonb_array_elements(result))),updated_at=now() where id=b.id;
 return result;
end;$$;
revoke all on function public.claim_courselex_question_bank(uuid,uuid,integer,text,uuid),public.take_courselex_questions(uuid,uuid,integer,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_courselex_question_bank(uuid,uuid,integer,text,uuid),public.take_courselex_questions(uuid,uuid,integer,text,uuid,integer) to service_role;

insert into public.material_ai_leases(model) values('question-bank-worker') on conflict do nothing;
