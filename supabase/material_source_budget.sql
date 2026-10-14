alter table public.user_material_batches add column source_chars integer not null default 0;
create or replace function public.create_material_job(p_batch uuid,p_user uuid,p_index integer,p_parts jsonb,p_filename text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare batch public.user_material_batches; target jsonb; job public.user_courseware_jobs;
begin
 select * into batch from public.user_material_batches where id=p_batch and user_id=p_user for update;
 if batch.id is null then raise exception 'Invalid batch'; end if;
 select * into job from public.user_courseware_jobs where batch_id=p_batch and file_index=p_index;
 if job.id is not null then return to_jsonb(job); end if;
 select value into target from jsonb_array_elements(batch.plan) where (value->>'index')::integer=p_index;
 if target is null then raise exception 'Invalid material'; end if;
 if batch.source_chars+length(p_parts::text)>500000 then raise exception 'MATERIAL_SIZE'; end if;
 insert into public.user_courseware_jobs(user_id,course,week,filename,parts,batch_id,file_index) values(p_user,(target->>'course')::uuid,(target->>'week')::integer,p_filename,p_parts,p_batch,p_index) returning * into job;
 update public.user_material_batches set source_chars=source_chars+length(p_parts::text) where id=p_batch;
 return to_jsonb(job);
end;$$;
alter table public.user_courseware_jobs drop constraint user_courseware_jobs_parts_check;
alter table public.user_courseware_jobs add constraint user_courseware_jobs_parts_check check(jsonb_typeof(parts)='array' and jsonb_array_length(parts) between 1 and 64);
