create table public.user_courseware_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 course uuid not null, week integer not null check(week between 1 and 52), filename text not null check(length(filename) between 1 and 160),
 parts jsonb not null check(jsonb_typeof(parts)='array' and jsonb_array_length(parts) between 1 and 32),
 terms jsonb not null default '[]', cursor integer not null default 0,
 status text not null default 'ready' check(status in('ready','processing','completed','failed')),
 result jsonb, error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(course,user_id) references public.user_courses(id,user_id)
);
alter table public.user_courseware_jobs enable row level security;
revoke all on public.user_courseware_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.user_courseware_jobs to service_role;
create policy courseware_jobs_server on public.user_courseware_jobs to service_role using(true) with check(true);
create index courseware_jobs_owner_date on public.user_courseware_jobs(user_id,created_at);
create function public.limit_courseware_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('courselex-free-courseware',0));
 if (select count(*) from public.user_courseware_jobs where user_id=new.user_id and created_at>now()-interval '24 hours')>=3 then raise exception 'USER_QUOTA'; end if;
 if (select count(*) from public.user_courseware_jobs where created_at>now()-interval '24 hours')>=100 then raise exception 'SITE_QUOTA'; end if;
 return new;
end;$$;
revoke execute on function public.limit_courseware_jobs() from public,anon,authenticated;
create trigger courseware_job_quota before insert on public.user_courseware_jobs for each row execute function public.limit_courseware_jobs();
