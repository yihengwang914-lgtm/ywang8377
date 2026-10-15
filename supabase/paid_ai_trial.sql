-- One shared, non-renewing RMB 20 pilot. Ledger contains no lecture text.
create table public.material_ai_trial_budget (
 id text primary key check(id='performance_trial_20261015'),
 cap_micro bigint not null default 20000000 check(cap_micro between 0 and 20000000),
 spent_micro bigint not null default 0 check(spent_micro>=0),
 held_micro bigint not null default 0 check(held_micro>=0),
 enabled boolean not null default true
);
create table public.material_ai_trial_calls (
 id uuid primary key, user_id uuid references auth.users(id) on delete set null,
 model text not null check(model in ('glm-4.7-flashx','glm-4.6v-flashx')),
 reserved_micro bigint not null, actual_micro bigint,
 created_at timestamptz not null default now(), settled_at timestamptz
);
alter table public.material_ai_trial_budget enable row level security;
alter table public.material_ai_trial_calls enable row level security;
revoke all on public.material_ai_trial_budget,public.material_ai_trial_calls from public,anon,authenticated;
grant all on public.material_ai_trial_budget,public.material_ai_trial_calls to service_role;
create policy material_ai_trial_budget_server on public.material_ai_trial_budget to service_role using(true) with check(true);
create policy material_ai_trial_calls_server on public.material_ai_trial_calls to service_role using(true) with check(true);
insert into public.material_ai_trial_budget(id) values('performance_trial_20261015');
insert into public.material_ai_leases(model) values('glm-4.7-flashx'),('glm-4.6v-flashx');

create function public.reserve_material_ai_trial(p_id uuid,p_user uuid,p_model text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare b public.material_ai_trial_budget; amount bigint;
begin
 -- Reserve the FULL model context plus capped output at the highest published tier.
 -- Text: 200K input * 0.5 + 8192 output * 3 yuan/M < 0.13 yuan.
 -- Vision: 128K input * 0.3 + 8192 output * 3 yuan/M < 0.07 yuan.
 amount:=case p_model when 'glm-4.7-flashx' then 130000 when 'glm-4.6v-flashx' then 70000 else null end;
 if amount is null then raise exception 'INVALID_PAID_MODEL'; end if;
 select * into b from public.material_ai_trial_budget where id='performance_trial_20261015' for update;
 if not found or not b.enabled or b.spent_micro+b.held_micro+amount>b.cap_micro then return false; end if;
 insert into public.material_ai_trial_calls(id,user_id,model,reserved_micro) values(p_id,p_user,p_model,amount);
 update public.material_ai_trial_budget set held_micro=held_micro+amount where id=b.id;
 return true;
end;$$;
create function public.settle_material_ai_trial(p_id uuid,p_actual bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c public.material_ai_trial_calls; amount bigint;
begin
 -- Same lock order as reservation; network failures keep the conservative reservation.
 perform 1 from public.material_ai_trial_budget where id='performance_trial_20261015' for update;
 select * into c from public.material_ai_trial_calls where id=p_id for update;
 if not found or c.settled_at is not null then return false; end if;
 amount:=coalesce(p_actual,c.reserved_micro);
 if amount<0 or amount>c.reserved_micro then amount:=c.reserved_micro; end if;
 update public.material_ai_trial_budget set held_micro=held_micro-c.reserved_micro,spent_micro=spent_micro+amount where id='performance_trial_20261015';
 update public.material_ai_trial_calls set actual_micro=amount,settled_at=now() where id=p_id;
 return true;
end;$$;
create or replace function public.release_material_ai(p_model text,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 update public.material_ai_leases set owner=null,expires_at=now()+case when p_model in ('glm-4.7-flashx','glm-4.6v-flashx') then interval '250 milliseconds' else interval '3 seconds' end where model=p_model and owner=p_owner;return found;
end;$$;
revoke all on function public.reserve_material_ai_trial(uuid,uuid,text),public.settle_material_ai_trial(uuid,bigint) from public,anon,authenticated;
grant execute on function public.reserve_material_ai_trial(uuid,uuid,text),public.settle_material_ai_trial(uuid,bigint) to service_role;
