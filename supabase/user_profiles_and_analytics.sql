begin;

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (length(btrim(username)) between 2 and 40),
  school text not null check (length(btrim(school)) between 2 and 120),
  major text not null check (length(btrim(major)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_profiles_username_unique on public.user_profiles(lower(btrim(username)));
alter table public.user_profiles enable row level security;
create policy profile_owner_select on public.user_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profile_owner_insert on public.user_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profile_owner_update on public.user_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_profiles from public, anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;

create table courselex_private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table courselex_private.admin_users enable row level security;
revoke all on courselex_private.admin_users from public, anon, authenticated;

create table courselex_private.usage_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
create index usage_sessions_recent on courselex_private.usage_sessions(last_heartbeat_at);
alter table courselex_private.usage_sessions enable row level security;
revoke all on courselex_private.usage_sessions from public, anon, authenticated;

create table courselex_private.user_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  visit_count integer not null default 0 check (visit_count >= 0),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
create index user_usage_daily_seen on courselex_private.user_usage_daily(last_seen_at desc);
alter table courselex_private.user_usage_daily enable row level security;
revoke all on courselex_private.user_usage_daily from public, anon, authenticated;

create function public.record_user_activity(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, courselex_private, pg_temp
as $$
declare
  uid uuid := auth.uid();
  previous_seen timestamptz;
  seconds_to_add integer := 0;
  is_new_visit boolean := false;
begin
  if uid is null or p_session is null then
    raise exception 'Sign in required';
  end if;

  select last_heartbeat_at into previous_seen
    from courselex_private.usage_sessions
    where user_id = uid and session_id = p_session
    for update;

  if previous_seen is null then
    insert into courselex_private.usage_sessions(user_id, session_id)
      values (uid, p_session);
    is_new_visit := true;
  else
    seconds_to_add := least(90, greatest(0, extract(epoch from (now() - previous_seen))::integer));
    if now() - previous_seen > interval '5 minutes' then
      seconds_to_add := 0;
    end if;
    update courselex_private.usage_sessions
      set last_heartbeat_at = now()
      where user_id = uid and session_id = p_session;
  end if;

  insert into courselex_private.user_usage_daily(user_id, usage_date, active_seconds, visit_count, last_seen_at)
    values (uid, current_date, seconds_to_add, case when is_new_visit then 1 else 0 end, now())
  on conflict (user_id, usage_date) do update
    set active_seconds = courselex_private.user_usage_daily.active_seconds + excluded.active_seconds,
        visit_count = courselex_private.user_usage_daily.visit_count + excluded.visit_count,
        last_seen_at = excluded.last_seen_at;

  return jsonb_build_object('recorded', true, 'active_seconds_added', seconds_to_add);
end;
$$;
revoke all on function public.record_user_activity(uuid) from public, anon;
grant execute on function public.record_user_activity(uuid) to authenticated;

create function public.is_courselex_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, courselex_private, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from courselex_private.admin_users where user_id = auth.uid()
  );
$$;
revoke all on function public.is_courselex_admin() from public, anon;
grant execute on function public.is_courselex_admin() to authenticated;

create function public.get_courselex_admin_dashboard()
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
    'generated_at', now(),
    'summary', jsonb_build_object(
      'registered_users', (select count(*) from auth.users),
      'completed_profiles', (select count(*) from public.user_profiles),
      'active_7d', (select count(distinct user_id) from courselex_private.user_usage_daily where last_seen_at >= now() - interval '7 days'),
      'active_30d', (select count(distinct user_id) from courselex_private.user_usage_daily where last_seen_at >= now() - interval '30 days'),
      'total_active_seconds', (select coalesce(sum(active_seconds), 0) from courselex_private.user_usage_daily),
      'total_visits', (select coalesce(sum(visit_count), 0) from courselex_private.user_usage_daily)
    ),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'username', p.username,
        'school', p.school,
        'major', p.major,
        'registered_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'last_seen_at', usage.last_seen_at,
        'active_seconds', coalesce(usage.active_seconds, 0),
        'visit_count', coalesce(usage.visit_count, 0),
        'active_days', coalesce(usage.active_days, 0),
        'course_count', coalesce(course_stats.course_count, 0),
        'word_count', coalesce(word_stats.word_count, 0),
        'known_count', coalesce(word_stats.known_count, 0)
      ) order by u.created_at desc)
      from auth.users u
      left join public.user_profiles p on p.user_id = u.id
      left join lateral (
        select sum(active_seconds)::bigint active_seconds,
               sum(visit_count)::bigint visit_count,
               count(*)::bigint active_days,
               max(last_seen_at) last_seen_at
        from courselex_private.user_usage_daily d where d.user_id = u.id
      ) usage on true
      left join lateral (
        select count(*)::bigint course_count from public.user_courses c
        where c.user_id = u.id and not c.archived
      ) course_stats on true
      left join lateral (
        select count(*)::bigint word_count,
               count(*) filter (where v.status = 'known')::bigint known_count
        from public.user_vocabulary v where v.user_id = u.id
      ) word_stats on true
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;
revoke all on function public.get_courselex_admin_dashboard() from public, anon;
grant execute on function public.get_courselex_admin_dashboard() to authenticated;

-- The existing verified owner is the first administrator. No user-editable metadata is trusted.
insert into courselex_private.admin_users(user_id)
select id from auth.users where lower(email) = 'ywang8377-c@my.cityu.edu.hk' and email_confirmed_at is not null
on conflict do nothing;

commit;
