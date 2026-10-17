-- Preserve existing administrator entitlement through user-requested account resets.
-- Only already-authorized administrators seed this server-only allowlist.
create table courselex_private.admin_identities (
 email text primary key check(email=lower(email) and length(email)<=254),
 created_at timestamptz not null default now()
);
alter table courselex_private.admin_identities enable row level security;
revoke all on courselex_private.admin_identities from public,anon,authenticated;
grant all on courselex_private.admin_identities to service_role;
create policy admin_identities_server on courselex_private.admin_identities to service_role using(true) with check(true);
insert into courselex_private.admin_identities(email)
 select lower(u.email) from courselex_private.admin_users a join auth.users u on u.id=a.user_id
 where u.email is not null and u.email_confirmed_at is not null on conflict do nothing;
create function courselex_private.restore_verified_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and exists(select 1 from courselex_private.admin_identities where email=lower(new.email)) then
  insert into courselex_private.admin_users(user_id) values(new.id) on conflict do nothing;
 elsif tg_op='UPDATE' and old.email is distinct from new.email and exists(select 1 from courselex_private.admin_identities where email=lower(old.email)) then
  delete from courselex_private.admin_users where user_id=new.id;
 end if;
 return new;
end;$$;
revoke all on function courselex_private.restore_verified_admin() from public,anon,authenticated;
create trigger courselex_restore_verified_admin after insert or update of email,email_confirmed_at on auth.users for each row execute function courselex_private.restore_verified_admin();
