create table public.user_material_batches(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 manifest jsonb not null,plan jsonb,ocr_calls integer not null default 0,created_at timestamptz not null default now()
);
alter table public.user_material_batches enable row level security;
revoke all on public.user_material_batches from public,anon,authenticated;
grant all on public.user_material_batches to service_role;
create policy material_batches_server on public.user_material_batches to service_role using(true) with check(true);
create index material_batches_owner_date on public.user_material_batches(user_id,created_at);
create function public.limit_material_batches() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('courselex-material-batches',0));
 if(select count(*) from public.user_material_batches where user_id=new.user_id and created_at>now()-interval '24 hours')>=3 then raise exception 'USER_QUOTA'; end if;
 if(select count(*) from public.user_material_batches where created_at>now()-interval '24 hours')>=50 then raise exception 'SITE_QUOTA'; end if;
 return new;
end;$$;
revoke execute on function public.limit_material_batches() from public,anon,authenticated;
create trigger material_batch_quota before insert on public.user_material_batches for each row execute function public.limit_material_batches();
alter table public.user_courseware_jobs add column batch_id uuid references public.user_material_batches(id) on delete cascade,add column file_index integer;
create unique index courseware_batch_file on public.user_courseware_jobs(batch_id,file_index) where batch_id is not null;
create or replace function public.limit_courseware_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.batch_id is not null then
  if not exists(select 1 from public.user_material_batches where id=new.batch_id and user_id=new.user_id) then raise exception 'Invalid batch'; end if;
  return new;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('courselex-free-courseware',0));
 if(select count(*) from public.user_courseware_jobs where user_id=new.user_id and batch_id is null and created_at>now()-interval '24 hours')>=3 then raise exception 'USER_QUOTA'; end if;
 if(select count(*) from public.user_courseware_jobs where batch_id is null and created_at>now()-interval '24 hours')>=100 then raise exception 'SITE_QUOTA'; end if;
 return new;
end;$$;
create function public.create_material_job(p_batch uuid,p_user uuid,p_index integer,p_parts jsonb,p_filename text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare batch public.user_material_batches; target jsonb; job public.user_courseware_jobs; used bigint;
begin
 select * into batch from public.user_material_batches where id=p_batch and user_id=p_user for update;
 if batch.id is null then raise exception 'Invalid batch'; end if;
 select * into job from public.user_courseware_jobs where batch_id=p_batch and file_index=p_index;
 if job.id is not null then return to_jsonb(job); end if;
 select value into target from jsonb_array_elements(batch.plan) where (value->>'index')::integer=p_index;
 if target is null then raise exception 'Invalid material'; end if;
 select coalesce(sum(length(parts::text)),0) into used from public.user_courseware_jobs where batch_id=p_batch;
 if used+length(p_parts::text)>500000 then raise exception 'MATERIAL_SIZE'; end if;
 insert into public.user_courseware_jobs(user_id,course,week,filename,parts,batch_id,file_index) values(p_user,(target->>'course')::uuid,(target->>'week')::integer,p_filename,p_parts,p_batch,p_index) returning * into job;
 return to_jsonb(job);
end;$$;
revoke all on function public.create_material_job(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_material_job(uuid,uuid,integer,jsonb,text) to service_role;
