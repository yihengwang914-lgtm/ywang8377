begin;
do $$ declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values(u,'guide-a@example.invalid',now()),(v,'guide-b@example.invalid',now());
 insert into public.user_profiles(user_id,username,school,major,degree) values
 (u,'GuideA'||left(u::text,8),'QA University','Study Skills','Master'),
 (v,'GuideB'||left(v::text,8),'QA University','Study Skills','Master');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('courselex.qa.guide_user',u::text,true);
 perform set_config('courselex.qa.guide_foreign',v::text,true);
end $$;
set local role authenticated;
do $$ declare affected integer;
begin
 assert has_column_privilege('authenticated','public.user_profiles','welcome_completed_at','update');
 assert not has_column_privilege('authenticated','public.user_profiles','user_id','update');
 update public.user_profiles set welcome_completed_at=now() where user_id=current_setting('courselex.qa.guide_user')::uuid;
 get diagnostics affected=row_count;
 assert affected=1;
 assert(select welcome_completed_at is not null from public.user_profiles where user_id=current_setting('courselex.qa.guide_user')::uuid);
 update public.user_profiles set welcome_completed_at=now() where user_id=current_setting('courselex.qa.guide_foreign')::uuid;
 get diagnostics affected=row_count;
 assert affected=0;
end $$;
reset role;
rollback;
