-- Additive: no changes to existing vocabulary, lectures or learning progress.
alter table public.user_learning_threads add column purpose text not null default 'study' check(purpose in ('study','assignment','exam'));
create table public.user_course_notes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid not null, title text not null check(length(title) between 1 and 120),
 body text not null default '' check(length(body)<=60000), version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(course_id,user_id) references public.user_courses(id,user_id) on delete cascade
);
create index course_notes_owner on public.user_course_notes(user_id,course_id,updated_at desc);
create table public.user_course_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid not null, title text not null check(length(title) between 1 and 160),
 kind text not null default 'assignment' check(kind in ('class','assignment','exam','review')),
 starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null check(length(timezone) between 1 and 80),
 details text not null default '' check(length(details)<=4000), done boolean not null default false,
 source_key text check(length(source_key)<=150), created_at timestamptz not null default now(),
 unique(user_id,source_key), check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),
 foreign key(course_id,user_id) references public.user_courses(id,user_id) on delete cascade
);
create index course_events_owner on public.user_course_events(user_id,course_id,starts_at);
create table public.user_school_links (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(label) between 1 and 60), url text not null check(length(url)<=2000 and url ~ '^https://[^[:space:]@]+$'),
 created_at timestamptz not null default now()
);
create index school_links_owner on public.user_school_links(user_id);
create function public.check_course_workspace_quota() returns trigger language plpgsql security invoker set search_path='' as $$
declare total bigint; entries bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('course-workspace:'||new.user_id::text,0));
 if tg_table_name='user_course_notes' then
  select count(*),coalesce(sum(length(body)),0) into entries,total from public.user_course_notes where user_id=new.user_id and id<>new.id;
  if entries>=100 or total+length(new.body)>600000 then raise exception '笔记容量已满，请导出并整理已有笔记'; end if;
  if tg_op='UPDATE' then new.version:=old.version+1;new.updated_at:=now();else new.version:=1;end if;
 elsif tg_table_name='user_course_events' then
  select count(*) into entries from public.user_course_events where user_id=new.user_id and id<>new.id;
  if entries>=500 then raise exception '日历已满，请导出并整理过去的安排'; end if;
 else
  select count(*) into entries from public.user_school_links where user_id=new.user_id and id<>new.id;
  if entries>=20 then raise exception '最多保存 20 个学校链接'; end if;
 end if;
 return new;
end;$$;
revoke all on function public.check_course_workspace_quota() from public,anon,authenticated;
create trigger note_quota before insert or update on public.user_course_notes for each row execute function public.check_course_workspace_quota();
create trigger event_quota before insert or update on public.user_course_events for each row execute function public.check_course_workspace_quota();
create trigger link_quota before insert or update on public.user_school_links for each row execute function public.check_course_workspace_quota();
alter table public.user_course_notes enable row level security;
alter table public.user_course_events enable row level security;
alter table public.user_school_links enable row level security;
revoke all on public.user_course_notes,public.user_course_events,public.user_school_links from public,anon,authenticated;
grant select,insert,update,delete on public.user_course_notes,public.user_course_events,public.user_school_links to authenticated;
grant all on public.user_course_notes,public.user_course_events,public.user_school_links to service_role;
create policy notes_owner on public.user_course_notes to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy events_owner on public.user_course_events to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy links_owner on public.user_school_links to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
