-- Supporting indexes for CourseLex background material processing and shared libraries.
-- These are additive and do not change or remove user data.

create index if not exists shared_libraries_source_user_id_idx
  on courselex_private.shared_libraries (source_user_id);

create index if not exists shared_library_decisions_library_id_idx
  on courselex_private.shared_library_decisions (library_id);

create index if not exists material_ai_trial_calls_user_id_idx
  on public.material_ai_trial_calls (user_id);

create index if not exists user_courseware_jobs_course_user_id_idx
  on public.user_courseware_jobs (course, user_id);
