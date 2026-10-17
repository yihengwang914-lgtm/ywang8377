begin;
do $$ declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();begin
 insert into courselex_private.admin_identities(email) values('admin-reset-fixture@example.invalid');
 insert into auth.users(id,email) values(u,'admin-reset-fixture@example.invalid'),(v,'ordinary-reset-fixture@example.invalid');
 assert not exists(select 1 from courselex_private.admin_users where user_id in(u,v));
 update auth.users set email_confirmed_at=now() where id in(u,v);
 assert exists(select 1 from courselex_private.admin_users where user_id=u);
 assert not exists(select 1 from courselex_private.admin_users where user_id=v);
 update auth.users set email='changed-owner-fixture@example.invalid' where id=u;
 assert not exists(select 1 from courselex_private.admin_users where user_id=u);
 assert not has_table_privilege('authenticated','courselex_private.admin_identities','select');
 assert not has_table_privilege('authenticated','courselex_private.admin_identities','insert');
 assert not has_function_privilege('authenticated','courselex_private.restore_verified_admin()','execute');
end $$;
rollback;
