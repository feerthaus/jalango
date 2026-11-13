-- Owner stats need a signed-in user; Supabase grants new functions to anon by default.
revoke execute on function public.my_listing_stats() from anon;
