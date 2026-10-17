begin;
do $$ declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();z uuid:=gen_random_uuid();s uuid;i int;
begin
 insert into auth.users(id,email) values(u,'overview-transaction-a@example.invalid'),(v,'overview-transaction-b@example.invalid');
 insert into public.user_courses(id,user_id,name,weeks) values(c,u,'Own selected course',13),(d,u,'Own other course',13),(z,v,'Foreign course',13);
 for i in 1..13 loop
  insert into public.user_learning_sources(user_id,course_id,filename,week,content_hash,content_chars) values(u,c,'Week '||i||' Lecture.pdf',i,md5(i::text),100) returning id into s;
  insert into public.user_learning_chunks(source_id,user_id,ordinal,content) select s,u,n,'Selected week '||i||' section '||n||' reliable evidence.' from generate_series(1,7)n;
 end loop;
 update public.user_learning_chunks set content='Correlation describes association and does not itself establish causation.' where source_id in(select id from public.user_learning_sources where user_id=u and course_id=c and week=11);
 insert into public.user_learning_sources(user_id,course_id,filename,week,content_hash,content_chars) values(u,d,'Other course secret.pdf',1,'other',100) returning id into s;
 insert into public.user_learning_chunks values(s,u,1,'Other course information must not leak.');
 insert into public.user_learning_sources(user_id,course_id,filename,week,content_hash,content_chars) values(v,z,'Foreign account secret.pdf',1,'foreign',100) returning id into s;
 insert into public.user_learning_chunks values(s,v,1,'Foreign account information must not leak.');
 perform set_config('courselex.qa.c',c::text,true);perform set_config('courselex.qa.d',d::text,true);perform set_config('courselex.qa.z',z::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare c uuid:=current_setting('courselex.qa.c')::uuid;z uuid:=current_setting('courselex.qa.z')::uuid;begin
 assert(select count(*)=39 from public.courselex_overview_evidence(c));
 assert(select count(distinct week)=13 from public.courselex_overview_evidence(c));
 assert(select bool_and(ordinal in(1,4,7)) from public.courselex_overview_evidence(c));
 assert(select count(*)=0 from public.courselex_overview_evidence(z));
 assert(select count(*)=0 from public.courselex_overview_evidence(c) where filename like '%secret%');
 assert(select week=11 from public.search_courselex_learning(c,'Please explain correlation and why association is not causation, from professor lecture',0,false) limit 1);
 assert(select count(*)=0 from public.search_courselex_learning(z,'secret',0,false));
 assert not has_function_privilege('anon','public.courselex_overview_evidence(uuid)','EXECUTE');
end $$;
rollback;
