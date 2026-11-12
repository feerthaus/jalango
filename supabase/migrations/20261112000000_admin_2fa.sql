-- Admin powers (approve photos, hide content, ban users, read the moderation queue)
-- now need a two-factor session: the user signed in AND verified a TOTP code
-- (Supabase puts aal = 'aal2' in the JWT). A stolen password alone is not enough.
-- Replaces is_admin() in place (same signature), so every policy and RPC that
-- already calls it is covered.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
$$;

-- For the admin page: is this account an admin, and has this session passed 2FA?
create or replace function public.admin_status()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'admin', exists (select 1 from public.admins where user_id = (select auth.uid())),
    'aal', coalesce((select auth.jwt()) ->> 'aal', 'aal1')
  )
$$;
revoke execute on function public.admin_status() from public, anon;
grant execute on function public.admin_status() to authenticated;
