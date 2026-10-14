alter table public.user_courses add column is_shared_template boolean not null default false;
-- Preserve every previously copied word/progress row, but identify copied course containers.
update public.user_courses c set is_shared_template=true
from courselex_private.shared_library_decisions d
where d.user_id=c.user_id and d.decision='imported' and d.created_at=c.created_at;
