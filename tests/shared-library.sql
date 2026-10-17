begin;
do $$
declare uid uuid:=gen_random_uuid(); owner uuid:=gen_random_uuid(); library uuid; offers jsonb; result jsonb; blocked boolean; old_course uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values(owner,'shared-owner-'||owner::text||'@example.invalid',now());
 insert into courselex_private.shared_libraries(slug,title,source_user_id,school,school_en,major,major_en,payload)
 values('shared-fixture-'||owner::text,'Synthetic opt-in library',owner,'香港城市大学','City University of Hong Kong','传播与新媒体','Communication and New Media',
 '[{"name":"Synthetic teaching course","code":"QA5101","weeks":1,"words":[{"week":1,"english":"retrieval practice","chinese":"提取练习","word_type":"Professional term"},{"week":1,"english":"spacing","chinese":"间隔练习","word_type":"Professional term"}]}]'::jsonb) returning id into library;
 insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data) values(uid,'authenticated','authenticated',uid::text||'@example.invalid',now(),'{}');
 insert into public.user_profiles(user_id,username,school,major,degree,username_en,school_en,major_en) values(uid,'Shared test '||left(uid::text,12),'香港城市大学','传播与新媒体','Master','Test Student','City University of Hong Kong','Communication and New Media');
 insert into public.user_courses(user_id,name,code,weeks) values(uid,'Existing fixture','EXISTING',1) returning id into old_course;
 insert into public.user_vocabulary(user_id,course_id,week,english,chinese,status,seen_count,wrong_count) values(uid,old_course,1,'existing term','原有词汇','known',9,2);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 execute 'set local role authenticated';
 offers:=public.get_shared_library_offers();if jsonb_array_length(offers)<>1 then raise exception 'Matching account did not receive offer';end if;
 if exists(select 1 from public.user_vocabulary where user_id=owner) then raise exception 'Owner RLS exposed source vocabulary';end if;
 result:=public.choose_shared_library(library,false);if not(result->>'declined')::boolean then raise exception 'Decline failed';end if;
 if (select count(*) from public.user_courses where user_id=uid)<>1 then raise exception 'Decline copied courses';end if;
 result:=public.choose_shared_library(library,true);if (result->>'words')::integer<>2 or (result->>'courses')::integer<>1 then raise exception 'Incomplete copy';end if;
 if (select count(*) from public.user_vocabulary where user_id=uid and course_id<>old_course and status='new' and seen_count=0 and wrong_count=0 and legacy_id is null)<>2 then raise exception 'Personal progress leaked';end if;
 if not exists(select 1 from public.user_vocabulary where user_id=uid and course_id=old_course and status='known' and seen_count=9 and wrong_count=2) then raise exception 'Existing words overwritten';end if;
 result:=public.choose_shared_library(library,true);if not(result->>'already_imported')::boolean or (select count(*) from public.user_courses where user_id=uid)<>2 then raise exception 'Repeated import duplicated data';end if;
 update public.user_profiles set school='Another University' where user_id=uid;
 if jsonb_array_length(public.get_shared_library_offers())<>0 then raise exception 'Foreign school received offer';end if;
 blocked:=false;begin perform public.choose_shared_library(library,true);exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'Foreign school import allowed';end if;
 update public.user_profiles set school='City University of Hong Kong',major='Another Programme' where user_id=uid;
 blocked:=false;begin perform public.choose_shared_library(library,true);exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'Foreign major import allowed';end if;
 execute 'reset role';
 if has_function_privilege('anon','public.choose_shared_library(uuid,boolean)','execute') or has_function_privilege('anon','public.get_shared_library_offers()','execute') then raise exception 'Anonymous RPC access allowed';end if;
 if has_table_privilege('authenticated','courselex_private.shared_libraries','select') then raise exception 'Direct snapshot access allowed';end if;
 update auth.users set email_confirmed_at=null where id=uid;
 execute 'set local role authenticated';blocked:=false;begin perform public.get_shared_library_offers();exception when raise_exception then blocked:=true;end;if not blocked then raise exception 'Unverified account allowed';end if;
 execute 'reset role';
end;$$;
rollback;
select 'Shared library copy, decline, duplicate prevention, RLS and eligibility tests passed; fixtures rolled back' as result;
