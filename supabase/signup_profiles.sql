begin;
-- Metadata is used only for user-entered profile text, never authorization.
create function courselex_private.create_signup_profile() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p jsonb:=new.raw_user_meta_data->'courselex_profile';
begin
 if p is null then return new; end if;
 if jsonb_typeof(p) <> 'object' or nullif(btrim(p->>'username'),'') is null
 or nullif(btrim(p->>'school'),'') is null or nullif(btrim(p->>'major'),'') is null
 or nullif(btrim(p->>'degree'),'') is null or nullif(btrim(p->>'username_en'),'') is null
 or nullif(btrim(p->>'school_en'),'') is null or nullif(btrim(p->>'major_en'),'') is null then
 raise exception 'Complete registration profile required'; end if;
 insert into public.user_profiles(user_id,username,school,major,degree,username_en,school_en,major_en)
 values(new.id,btrim(p->>'username'),btrim(p->>'school'),btrim(p->>'major'),p->>'degree',btrim(p->>'username_en'),btrim(p->>'school_en'),btrim(p->>'major_en'));
 return new;
end;$$;
revoke all on function courselex_private.create_signup_profile() from public,anon,authenticated;
create trigger courselex_signup_profile after insert on auth.users for each row execute function courselex_private.create_signup_profile();
commit;
