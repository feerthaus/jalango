-- Trigger functions are only meant to run as triggers; don't expose them via /rest/v1/rpc.
-- (EXECUTE is checked when a trigger is created, not when it fires, so triggers keep working.)
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.before_traffic_report_insert() from public, anon, authenticated;
revoke execute on function public.before_report_confirmation_insert() from public, anon, authenticated;
revoke execute on function public.after_report_confirmation_change() from public, anon, authenticated;
revoke execute on function public.prune_recent_destinations() from public, anon, authenticated;
revoke execute on function public.before_shortcut_insert() from public, anon, authenticated;
revoke execute on function public.before_shortcut_vote() from public, anon, authenticated;
revoke execute on function public.after_shortcut_vote() from public, anon, authenticated;
revoke execute on function public.before_community_place_insert() from public, anon, authenticated;
revoke execute on function public.after_place_recommendation() from public, anon, authenticated;
