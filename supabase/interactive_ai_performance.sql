-- Dedicated non-reasoning study models; the existing RMB 20 cap is unchanged.
-- Official prices checked 2026-10-16:
-- https://docs.bigmodel.cn/cn/guide/start/pricing.md
-- FlashX: 0.1 / 0.1 RMB per million input/output tokens.
-- Air: 0.5 / 0.5 RMB per million input/output tokens.
-- Reservations cover full 128K input plus the application's 8192 output cap.
alter table public.material_ai_trial_calls drop constraint material_ai_trial_calls_model_check;
alter table public.material_ai_trial_calls add constraint material_ai_trial_calls_model_check
 check(model in ('glm-4.7-flashx','glm-4.6v-flashx','glm-4-flashx-250414','glm-4-air-250414'));
insert into public.material_ai_leases(model) values
 ('glm-4-flashx-250414#1'),('glm-4-flashx-250414#2'),
 ('glm-4-air-250414#1'),('glm-4-air-250414#2') on conflict do nothing;
create or replace function public.reserve_material_ai_trial(p_id uuid,p_user uuid,p_model text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare b public.material_ai_trial_budget; amount bigint;
begin
 -- Reserve the FULL model context plus capped output at the highest published tier.
 -- Text: 200K input * 0.5 + 8192 output * 3 yuan/M < 0.13 yuan.
 -- Vision: 128K input * 0.3 + 8192 output * 3 yuan/M < 0.07 yuan.
 amount:=case p_model when 'glm-4.7-flashx' then 130000 when 'glm-4.6v-flashx' then 70000 when 'glm-4-flashx-250414' then 14000 when 'glm-4-air-250414' then 70000 else null end;
 if amount is null then raise exception 'INVALID_PAID_MODEL'; end if;
 select * into b from public.material_ai_trial_budget where id='performance_trial_20261015' for update;
 if not found or not b.enabled or b.spent_micro+b.held_micro+amount>b.cap_micro then return false; end if;
 insert into public.material_ai_trial_calls(id,user_id,model,reserved_micro) values(p_id,p_user,p_model,amount);
 update public.material_ai_trial_budget set held_micro=held_micro+amount where id=b.id;
 return true;
end;$$;
revoke all on function public.reserve_material_ai_trial(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_material_ai_trial(uuid,uuid,text) to service_role;
