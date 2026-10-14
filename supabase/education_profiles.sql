begin;
alter table public.user_profiles add column degree text check (degree in ('Bachelor','Master','Doctorate','Associate','Diploma','Other'));
alter table public.user_profiles add column username_en text check (length(btrim(username_en)) between 1 and 80 and username_en ~ '^[ -~]+$');
alter table public.user_profiles add column school_en text check (length(btrim(school_en)) between 2 and 200 and school_en ~ '^[ -~]+$');
alter table public.user_profiles add column major_en text check (length(btrim(major_en)) between 2 and 200 and major_en ~ '^[ -~]+$');
create function courselex_private.education_dashboard() returns jsonb language plpgsql security definer set search_path=pg_catalog,public,courselex_private,pg_temp as $$
declare result jsonb; users_en jsonb;
begin
 if auth.uid() is null or not exists(select 1 from courselex_private.admin_users where user_id=auth.uid()) then raise exception 'Administrator access required'; end if;
 result := public.get_courselex_admin_dashboard();
 select coalesce(jsonb_agg(entry || jsonb_build_object('username',coalesce(p.username_en,'Pending English profile'),'school',coalesce(p.school_en,'Pending English profile'),'major',coalesce(p.major_en,'Pending English profile'),'degree',coalesce(p.degree,'Not provided')) order by entry->>'registered_at' desc),'[]'::jsonb)
 into users_en from jsonb_array_elements(result->'users') entry left join public.user_profiles p on p.user_id=(entry->>'id')::uuid;
 return jsonb_set(result,'{users}',users_en);
end;$$;
revoke all on function courselex_private.education_dashboard() from public,anon;
grant execute on function courselex_private.education_dashboard() to authenticated;
create function public.get_courselex_admin_dashboard_v2() returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$ select courselex_private.education_dashboard(); $$;
revoke all on function public.get_courselex_admin_dashboard_v2() from public,anon;
grant execute on function public.get_courselex_admin_dashboard_v2() to authenticated;
commit;
