-- DeepSeek Flash: peak RMB rates 2 input / 8 output per million tokens.
-- Input is bounded to 131072 tokens (UTF-8 byte upper bound + 1024/image);
-- output is capped at 8192. Reserve 0.34 RMB; preserve the existing total cap.
alter table public.material_ai_trial_calls drop constraint material_ai_trial_calls_model_check;
alter table public.material_ai_trial_calls add constraint material_ai_trial_calls_model_check check(model in ('glm-4.7-flashx','glm-4.6v-flashx','glm-4-flashx-250414','glm-4-air-250414','deepseek-flash'));
insert into public.material_ai_leases(model)
select 'deepseek-flash#chat'||n from generate_series(1,8)n
union all select 'deepseek-flash#import'||n from generate_series(1,4)n
union all select 'deepseek-flash#bank'||n from generate_series(1,2)n
union all select 'deepseek-flash#vision'||n from generate_series(1,2)n
on conflict(model) do nothing;
create or replace function public.reserve_material_ai_trial(p_id uuid,p_user uuid,p_model text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare b public.material_ai_trial_budget;amount bigint;
begin
 amount:=case p_model when 'deepseek-flash' then 340000 when 'glm-4.7-flashx' then 130000 when 'glm-4.6v-flashx' then 70000 when 'glm-4-flashx-250414' then 14000 when 'glm-4-air-250414' then 70000 else null end;
 if amount is null then raise exception 'INVALID_PAID_MODEL';end if;
 select * into b from public.material_ai_trial_budget where id='performance_trial_20261015' for update;
 if not found or not b.enabled or b.spent_micro+b.held_micro+amount>b.cap_micro then return false;end if;
 insert into public.material_ai_trial_calls(id,user_id,model,reserved_micro) values(p_id,p_user,p_model,amount);
 update public.material_ai_trial_budget set held_micro=held_micro+amount where id=b.id;return true;
end;$$;
create or replace function public.release_material_ai(p_model text,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin update public.material_ai_leases set owner=null,expires_at=now()+case
 when p_model like 'deepseek-flash#%' or p_model in ('glm-4-air-250414#1','glm-4-air-250414#2','glm-4-flashx-250414#1','glm-4-flashx-250414#2') then interval '0 seconds'
 when p_model like 'glm-4.7-flashx#%' or p_model like 'glm-4.6v-flashx#%' then interval '250 milliseconds'
 else interval '3 seconds' end where model=p_model and owner=p_owner;return found;end;$$;
revoke all on function public.reserve_material_ai_trial(uuid,uuid,text),public.release_material_ai(text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_material_ai_trial(uuid,uuid,text),public.release_material_ai(text,uuid) to service_role;
