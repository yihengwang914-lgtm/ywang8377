begin;
do $$ declare u uuid:=gen_random_uuid();other_uid uuid:=gen_random_uuid();c uuid:=gen_random_uuid();other_course uuid:=gen_random_uuid();word_id bigint;other_word bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values(u,'review-a@example.invalid',now()),(other_uid,'review-b@example.invalid',now());
 insert into public.user_courses(id,user_id,name,weeks) values(c,u,'Review A',1),(other_course,other_uid,'Review B',1);
 insert into public.user_vocabulary(user_id,course_id,week,english,chinese) values(u,c,1,'Review fixture','复习测试') returning id into word_id;
 insert into public.user_vocabulary(user_id,course_id,week,english,chinese) values(other_uid,other_course,1,'Foreign fixture','其他账号') returning id into other_word;
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);perform set_config('courselex.word',word_id::text,true);perform set_config('courselex.foreign_word',other_word::text,true);
end $$;
set local role authenticated;
do $$ declare result jsonb;
begin
 result:=public.answer_courselex_word(current_setting('courselex.word')::bigint,false);
 assert (result->>'seen_count')::integer=1 and (result->>'wrong_count')::integer=1;
 assert (result->>'next_review_at')::timestamptz between now()+interval '9 minutes' and now()+interval '11 minutes';
 result:=public.answer_courselex_word(current_setting('courselex.word')::bigint,true);
 assert (result->>'seen_count')::integer=2 and (result->>'review_streak')::integer=1;
 assert (result->>'next_review_at')::timestamptz between now()+interval '23 hours' and now()+interval '25 hours';
 begin perform public.answer_courselex_word(current_setting('courselex.foreign_word')::bigint,true);raise exception 'TEST FAILED';exception when raise_exception then assert sqlerrm='Word not found';end;
end $$;
rollback;
