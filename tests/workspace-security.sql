begin;
do $$ declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values(u,'workspace-a@example.invalid',now()),(v,'workspace-b@example.invalid',now());
 insert into public.user_courses(id,user_id,name,weeks) values(c,u,'Own course',3),(d,v,'Other course',3);
 perform set_config('courselex.qa.owner',u::text,true);perform set_config('courselex.qa.course',c::text,true);perform set_config('courselex.qa.foreign',d::text,true);perform set_config('courselex.qa.other',v::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare u uuid:=current_setting('courselex.qa.owner')::uuid;c uuid:=current_setting('courselex.qa.course')::uuid;d uuid:=current_setting('courselex.qa.foreign')::uuid;v uuid:=current_setting('courselex.qa.other')::uuid;n uuid;ver int;blocked bool:=false;
begin
 insert into public.user_course_notes(user_id,course_id,title,body) values(u,c,'Own note','Private draft') returning id into n;
 update public.user_course_notes set body='Version two' where id=n and version=1 returning version into ver;assert ver=2;
 update public.user_course_notes set body='Stale overwrite' where id=n and version=1;assert not found;
 assert(select body='Version two' from public.user_course_notes where id=n);
 begin insert into public.user_course_notes(user_id,course_id,title) values(u,d,'Cross-course attack');exception when foreign_key_violation then blocked:=true;end;assert blocked;blocked:=false;
 begin update public.user_course_notes set user_id=v,course_id=d where id=n;exception when insufficient_privilege then blocked:=true;end;assert blocked;
 insert into public.user_course_events(user_id,course_id,title,starts_at,ends_at,timezone) values(u,c,'Essay',now(),now()+interval '30 minutes','Asia/Hong_Kong');
 insert into public.user_school_links(user_id,label,url) values(u,'Canvas','https://canvas.cityu.edu.hk/');
 perform set_config('request.jwt.claims',json_build_object('sub',v,'role','authenticated')::text,true);
 assert(select count(*)=0 from public.user_course_notes);assert(select count(*)=0 from public.user_course_events);assert(select count(*)=0 from public.user_school_links);
 assert not has_table_privilege('authenticated','public.user_learning_threads','select');
end $$;
reset role;
set local role anon;
do $$ begin assert not has_table_privilege('anon','public.user_course_notes','select');assert not has_table_privilege('anon','public.user_course_events','insert');end $$;
rollback;
