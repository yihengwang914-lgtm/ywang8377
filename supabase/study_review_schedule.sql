alter table public.user_vocabulary add column last_review_at timestamptz,add column next_review_at timestamptz,add column review_streak integer not null default 0;
grant update(last_review_at,next_review_at,review_streak) on public.user_vocabulary to authenticated;
create function public.answer_courselex_word(p_word bigint,p_known boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare word public.user_vocabulary;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.user_vocabulary set status=case when p_known then 'known' else 'unknown' end,seen_count=seen_count+1,wrong_count=wrong_count+case when p_known then 0 else 1 end,
 review_streak=case when p_known then review_streak+1 else 0 end,last_review_at=now(),next_review_at=now()+case when not p_known then interval '10 minutes' when review_streak=0 then interval '1 day' when review_streak=1 then interval '3 days' when review_streak=2 then interval '7 days' else interval '14 days' end
 where id=p_word and user_id=auth.uid() returning * into word;
 if word.id is null then raise exception 'Word not found'; end if;
 return jsonb_build_object('status',word.status,'seen_count',word.seen_count,'wrong_count',word.wrong_count,'last_review_at',word.last_review_at,'next_review_at',word.next_review_at,'review_streak',word.review_streak);
end;$$;
revoke all on function public.answer_courselex_word(bigint,boolean) from public,anon;
grant execute on function public.answer_courselex_word(bigint,boolean) to authenticated;
