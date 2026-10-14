CREATE OR REPLACE FUNCTION courselex_private.use_shared_library(p_library uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); lib record; c jsonb; course_id uuid; course_count integer:=0; word_count integer:=0; n integer; prev text;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Verified login required'; end if;
 if p_accept is null then raise exception 'Explicit choice required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('shared-library:'||uid::text||':'||p_library::text,0));
 select l.* into lib from courselex_private.shared_libraries l join public.user_profiles p on p.user_id=uid
 where l.id=p_library and l.active and l.source_user_id<>uid
 and regexp_replace(lower(btrim(p.school_en)),'[^a-z0-9]','','g')=regexp_replace(lower(btrim(l.school_en)),'[^a-z0-9]','','g')
 and regexp_replace(lower(btrim(p.major_en)),'[^a-z0-9]','','g')=regexp_replace(lower(btrim(l.major_en)),'[^a-z0-9]','','g') for share of l,p;
 if not found then raise exception 'This library does not match your school and major'; end if;
 select decision into prev from courselex_private.shared_library_decisions where user_id=uid and library_id=p_library;
 if prev='imported' then return jsonb_build_object('already_imported',true); end if;
 if not p_accept then
 insert into courselex_private.shared_library_decisions(user_id,library_id,decision) values(uid,p_library,'declined') on conflict(user_id,library_id) do nothing;
 return jsonb_build_object('declined',true);
 end if;
 for c in select value from jsonb_array_elements(lib.payload) loop
 insert into public.user_courses(user_id,name,code,weeks,is_shared_template) values(uid,c->>'name',c->>'code',(c->>'weeks')::integer,true) returning id into course_id;
 insert into public.user_vocabulary(user_id,course_id,week,english,chinese,word_type,status,wrong_count,seen_count)
 select uid,course_id,(w->>'week')::integer,w->>'english',w->>'chinese',w->>'word_type','new',0,0 from jsonb_array_elements(c->'words') w;
 get diagnostics n=row_count;word_count:=word_count+n;course_count:=course_count+1;
 end loop;
 insert into courselex_private.shared_library_decisions(user_id,library_id,decision) values(uid,p_library,'imported') on conflict(user_id,library_id) do update set decision='imported',created_at=now();
 return jsonb_build_object('courses',course_count,'words',word_count,'already_imported',false);
end;$function$
