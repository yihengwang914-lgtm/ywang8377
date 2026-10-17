alter table public.user_learning_threads drop constraint user_learning_threads_purpose_check;
alter table public.user_learning_threads add constraint user_learning_threads_purpose_check check(purpose in ('study','assignment','exam','planning'));
