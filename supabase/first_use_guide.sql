-- New accounts get an optional first-use tour. Existing users can reopen it
-- from the account menu without being interrupted on their next visit.
alter table public.user_profiles add column welcome_completed_at timestamptz;
update public.user_profiles set welcome_completed_at=now();
