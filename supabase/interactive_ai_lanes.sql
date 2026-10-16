-- Paid non-reasoning models use provider rate-limit responses rather than the
-- legacy free-model cooldown. Generation and audit can run consecutively.
create or replace function public.release_material_ai(p_model text,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.material_ai_leases set owner=null,
 expires_at=now()+case
  when p_model in ('glm-4-air-250414#1','glm-4-air-250414#2','glm-4-flashx-250414#1','glm-4-flashx-250414#2') then interval '0 seconds'
  when p_model like 'glm-4.7-flashx#%' or p_model like 'glm-4.6v-flashx#%' then interval '250 milliseconds'
  else interval '3 seconds' end
 where model=p_model and owner=p_owner;
 return found;
end;$$;
revoke all on function public.release_material_ai(text,uuid) from public,anon,authenticated;
grant execute on function public.release_material_ai(text,uuid) to service_role;
