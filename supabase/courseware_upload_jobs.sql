create table if not exists public.courseware_upload_jobs (
  id text primary key,
  course text not null,
  week integer not null check (week between 1 and 13),
  filename text not null,
  nonce text not null,
  status text not null default 'awaiting_upload'
    check (status in ('awaiting_upload','initializing','processing','failed')),
  response_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.courseware_upload_jobs enable row level security;
revoke all on public.courseware_upload_jobs from public, anon, authenticated;
grant select, insert, update on public.courseware_upload_jobs to service_role;
create policy courseware_jobs_service on public.courseware_upload_jobs
  for all to service_role using (true) with check (true);
