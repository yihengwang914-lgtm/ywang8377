begin;
do $$ declare u uuid:=gen_random_uuid();c uuid:=gen_random_uuid();wid bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values(u,'material-dedup-fixture@example.invalid',now());insert into public.user_courses(id,user_id,name,weeks) values(c,u,'Dedup fixture',3);
 insert into public.user_vocabulary(user_id,course_id,week,english,chinese,status,seen_count,wrong_count) values(u,c,1,'Privacy','隐私','known',5,3) returning id into wid;
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);perform set_config('courselex.course',c::text,true);perform set_config('courselex.word',wid::text,true);
end $$;
set local role authenticated;
do $$ declare result jsonb; begin
 result:=public.import_material_vocabulary(current_setting('courselex.course')::uuid,2,'[{"english":"PRIVACY","chinese":"隐私"},{"english":"Framing","chinese":"框架"}]');assert (result->>'inserted')::int=1 and (result->>'skipped')::int=1;
 assert exists(select 1 from public.user_vocabulary where id=current_setting('courselex.word')::bigint and status='known' and seen_count=5 and wrong_count=3);
 update public.user_vocabulary set chinese='隐私（已核对）' where id=current_setting('courselex.word')::bigint;
 assert exists(select 1 from public.user_vocabulary where id=current_setting('courselex.word')::bigint and status='known' and seen_count=5 and chinese='隐私（已核对）');
end $$;
rollback;
