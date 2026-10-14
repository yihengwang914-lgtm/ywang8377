create table public.material_ai_leases(model text primary key,owner uuid,expires_at timestamptz not null default now());
alter table public.material_ai_leases enable row level security;
revoke all on public.material_ai_leases from public,anon,authenticated;
grant all on public.material_ai_leases to service_role;
create policy material_ai_server on public.material_ai_leases to service_role using(true) with check(true);
insert into public.material_ai_leases(model) values('glm-4.7-flash'),('glm-4.6v-flash');
create function public.acquire_material_ai(p_model text,p_owner uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.material_ai_leases set owner=p_owner,expires_at=now()+interval '75 seconds' where model=p_model and expires_at<=now();return found;
end;$$;
create function public.release_material_ai(p_model text,p_owner uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.material_ai_leases set owner=null,expires_at=now()+interval '3 seconds' where model=p_model and owner=p_owner;return found;
end;$$;
revoke all on function public.acquire_material_ai(text,uuid),public.release_material_ai(text,uuid) from public,anon,authenticated;
grant execute on function public.acquire_material_ai(text,uuid),public.release_material_ai(text,uuid) to service_role;
