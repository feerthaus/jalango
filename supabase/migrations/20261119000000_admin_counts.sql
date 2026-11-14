-- Numbers for the admin's notification badges: how many items wait in each tab.
-- Returns null (not an error) for non-admins or sessions without 2FA, so the
-- app can ask quietly from any page.
create or replace function public.admin_counts()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then return null; end if;
  select jsonb_build_object(
    'operators', (select count(*) from public.operators where status = 'pending'),
    'listings', (
      select count(*) from public.listings l
      where l.status = 'pending'
         or (l.status in ('live', 'paused') and exists (
               select 1 from public.listing_photos p where p.listing_id = l.id and p.status = 'pending'))
    ),
    'flags', (select count(*) from (select distinct content_type, content_id from public.content_flags where status = 'open') f),
    'photos', (select count(*) from public.accident_records where photo_status = 'pending'),
    'feedback', (select count(*) from public.feedback where status = 'new')
  ) into result;
  return result || jsonb_build_object('total',
    (result->>'operators')::int + (result->>'listings')::int + (result->>'flags')::int + (result->>'photos')::int + (result->>'feedback')::int);
end;
$$;
revoke execute on function public.admin_counts() from public, anon;
grant execute on function public.admin_counts() to authenticated;
