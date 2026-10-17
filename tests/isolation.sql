begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','courselex-test-a@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','courselex-test-b@example.invalid',now());
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into public.user_courses(id,name,weeks) values ('20000000-0000-4000-8000-000000000001','A course',20);
insert into public.user_vocabulary(course_id,week,english,chinese) values ('20000000-0000-4000-8000-000000000001',20,'A private term','私有词');
insert into public.user_profiles(user_id,username,school,major) values ('10000000-0000-4000-8000-000000000001','Test A','School A','Major A');
select public.record_user_activity('30000000-0000-4000-8000-000000000001');
do $$ begin
 assert (select count(*)=1 from public.user_vocabulary),'A cannot read own words';
 assert (select username='Test A' from public.user_profiles),'A cannot read own profile';
 begin
 update public.user_courses set weeks=19 where id='20000000-0000-4000-8000-000000000001';
 raise exception 'TEST FAILED: truncated existing week';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ declare n integer; begin
 assert (select count(*)=0 from public.user_courses),'B saw A courses';
 assert (select count(*)=0 from public.user_vocabulary),'B saw A words';
 assert (select count(*)=0 from public.user_profiles),'B saw A profile';
 assert not public.is_courselex_admin(),'B received administrator access';
 update public.user_vocabulary set status='known'; get diagnostics n=row_count; assert n=0,'B modified A progress';
 delete from public.user_vocabulary; get diagnostics n=row_count; assert n=0,'B deleted A words';
 begin
 insert into public.user_courses(user_id,name) values ('10000000-0000-4000-8000-000000000001','forged');
 raise exception 'TEST FAILED: forged owner allowed'; exception when insufficient_privilege then null; end;
 begin
 insert into public.user_vocabulary(course_id,week,english,chinese) values('20000000-0000-4000-8000-000000000001',1,'cross tenant','越权');
 raise exception 'TEST FAILED: foreign course allowed'; exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 begin
 perform public.migrate_legacy_vocabulary();raise exception 'TEST FAILED: nonowner migration allowed';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 begin
 perform public.get_courselex_admin_dashboard();raise exception 'TEST FAILED: nonadmin dashboard allowed';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
insert into public.user_courses(id,name,weeks) values ('20000000-0000-4000-8000-000000000002','B course',5);
select public.import_user_vocabulary('20000000-0000-4000-8000-000000000002',5,'[{"english":"term","chinese":"术语"}]');
select public.import_user_vocabulary('20000000-0000-4000-8000-000000000002',5,'[{"english":"term","chinese":"术语"}]');
do $$ begin assert (select count(*)=1 from public.user_vocabulary),'Repeated import duplicated'; end $$;
-- A synthetic administrator tests statistics without relying on the owner's deleted account.
reset role;
insert into courselex_private.admin_identities(email) values('courselex-test-admin@example.invalid');
insert into auth.users(id,email,email_confirmed_at) values ('10000000-0000-4000-8000-000000000003','courselex-test-admin@example.invalid',now());
set local role authenticated;
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ declare dashboard jsonb;entry jsonb;begin
 assert public.is_courselex_admin(),'Verified fixture administrator was not restored';
 dashboard:=public.get_courselex_admin_dashboard_v2();
 assert (dashboard->'summary'->>'registered_users')::int >= 3,'Dashboard user total is invalid';
 select value into entry from jsonb_array_elements(dashboard->'users') where value->>'email'='courselex-test-a@example.invalid';
 assert entry->>'username'='Test A' and entry->>'school'='School A';
 assert (entry->>'course_count')::int=1 and (entry->>'word_count')::int=1 and (entry->>'visit_count')::int=1;
 assert (public.get_courselex_capacity()->>'database_bytes')::bigint>0;
end $$;
set local role anon;
do $$ begin
 begin perform count(*) from public.user_vocabulary;raise exception 'TEST FAILED: anonymous access allowed';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.vocabulary_data;raise exception 'TEST FAILED: legacy archive exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: isolation, profiles, activity, admin denial, week integrity, import deduplication, verified admin statistics, anonymous denial' as result;
rollback;
