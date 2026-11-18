-- Live share: traffic status for the person watching (owner's request, 18 Nov 2026).
--   slow_since   when the driver got stuck in traffic (set by the driver's app after
--                2 minutes under 15 km/h while navigating; null otherwise)
--   eta_delay_s  how much later than the ETA at the start of the trip (seconds)
-- Additive only: new columns, the update trigger also clears them when sharing
-- stops, and a v3 reader (v1/v2 keep working for older clients).

alter table public.location_shares add column if not exists slow_since timestamptz;
alter table public.location_shares add column if not exists eta_delay_s integer
  check (eta_delay_s is null or eta_delay_s between 0 and 21600);

create or replace function public.before_location_share_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.id := old.id;
  new.token := old.token;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.expires_at := least(new.expires_at, old.expires_at);
  if old.stopped_at is not null then
    raise exception 'This share has ended.' using errcode = 'P0001', hint = 'inactive';
  end if;
  -- "in traffic since" can't be in the future or older than the share
  if new.slow_since is not null and (new.slow_since > now() + interval '1 minute' or new.slow_since < old.created_at) then
    new.slow_since := null;
  end if;
  if new.stopped_at is not null then
    new.latitude := null; new.longitude := null; new.heading := null; new.speed_mps := null; new.accuracy_m := null;
    new.driver_phone := null;
    new.slow_since := null; new.eta_delay_s := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.before_location_share_update() from public, anon, authenticated;

create or replace function public.get_live_share_v3(p_token text)
returns table (
  status text, display_name text, destination_name text, dest_latitude double precision, dest_longitude double precision,
  eta_at timestamptz, latitude double precision, longitude double precision, heading real, speed_mps real,
  accuracy_m real, position_at timestamptz, expires_at timestamptz,
  driver_vehicle text, driver_plate text, driver_phone text, next_stop_name text, stops_left smallint,
  slow_since timestamptz, eta_delay_s integer
)
language sql stable security definer set search_path = ''
as $$
  select
    case when s.stopped_at is not null then 'stopped' when s.expires_at <= now() then 'expired' else 'live' end,
    s.display_name, s.destination_name, s.dest_latitude, s.dest_longitude, s.eta_at,
    case when s.stopped_at is null and s.expires_at > now() then s.latitude end,
    case when s.stopped_at is null and s.expires_at > now() then s.longitude end,
    case when s.stopped_at is null and s.expires_at > now() then s.heading end,
    case when s.stopped_at is null and s.expires_at > now() then s.speed_mps end,
    case when s.stopped_at is null and s.expires_at > now() then s.accuracy_m end,
    s.position_at, s.expires_at,
    s.driver_vehicle, s.driver_plate,
    case when s.stopped_at is null and s.expires_at > now() then s.driver_phone end,
    s.next_stop_name, s.stops_left,
    case when s.stopped_at is null and s.expires_at > now() then s.slow_since end,
    case when s.stopped_at is null and s.expires_at > now() then s.eta_delay_s end
  from public.location_shares s
  where s.token = p_token
$$;
revoke execute on function public.get_live_share_v3(text) from public;
grant execute on function public.get_live_share_v3(text) to anon, authenticated;
