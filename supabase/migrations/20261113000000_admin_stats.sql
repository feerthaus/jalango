-- Anonymous usage statistics for the admin "Statistik" tab.
-- Each device keeps a random ID (made on the phone, never linked to an account,
-- IP or location) and checks in at most once a day: that's all we store.
create table public.app_activity (
  day        date not null,
  device_id  uuid not null,
  installed  boolean not null default false,
  primary key (day, device_id)
);
comment on table public.app_activity is 'One row per device per day it opened JalanGo. Random device ID only: no account, IP or location.';
create index app_activity_device_idx on public.app_activity (device_id, day);
alter table public.app_activity enable row level security;
-- No policies: nobody reads or writes the table directly; only the functions below.
revoke all on public.app_activity from anon, authenticated;

create or replace function public.ping_activity(p_device uuid, p_installed boolean default false)
returns void language sql security definer set search_path = ''
as $$
  insert into public.app_activity (day, device_id, installed)
  values ((now() at time zone 'Asia/Kuala_Lumpur')::date, p_device, coalesce(p_installed, false))
  on conflict (day, device_id) do update set installed = public.app_activity.installed or excluded.installed
$$;
revoke execute on function public.ping_activity(uuid, boolean) from public;
grant execute on function public.ping_activity(uuid, boolean) to anon, authenticated;

-- Everything the Statistik tab shows, in one call. Admins only (2FA session).
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  with first_seen as (
    select device_id, min(day) as d from public.app_activity group by device_id
  ), days as (
    select generate_series(today - 29, today, interval '1 day')::date as d
  )
  select jsonb_build_object(
    'today', today,
    'active_today', (select count(*) from public.app_activity where day = today),
    'active_7d', (select count(distinct device_id) from public.app_activity where day > today - 7),
    'active_30d', (select count(distinct device_id) from public.app_activity where day > today - 30),
    'devices_total', (select count(*) from first_seen),
    'installed_7d', (select count(distinct device_id) from public.app_activity where day > today - 7 and installed),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'day', days.d,
        'active', (select count(*) from public.app_activity a where a.day = days.d),
        'new', (select count(*) from first_seen f where f.d = days.d),
        'searches', coalesce((select u.count from public.api_usage u where u.day = days.d and u.kind = 'geo'), 0),
        'routes', coalesce((select u.count from public.api_usage u where u.day = days.d and u.kind = 'directions'), 0)
      ) order by days.d)
      from days
    ),
    'accounts_total', (select count(*) from public.users),
    'accounts_7d', (select count(*) from public.users where created_at > now() - interval '7 days'),
    'reports_7d', (select count(*) from public.traffic_reports where created_at > now() - interval '7 days'),
    'reports_total', (select count(*) from public.traffic_reports),
    'accident_records', (select count(*) from public.accident_records where status = 'active'),
    'photos_pending', (select count(*) from public.accident_records where photo_status = 'pending'),
    'community_routes', (select count(*) from public.community_routes where status = 'active'),
    'shortcuts', (select count(*) from public.shortcuts),
    'convoys_7d', (select count(*) from public.convoys where created_at > now() - interval '7 days'),
    'live_shares_7d', (select count(*) from public.location_shares where created_at > now() - interval '7 days'),
    'trips_synced', (select count(*) from public.trips)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
