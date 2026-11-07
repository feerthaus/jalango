-- Driver mode (tour / private drivers): who is coming and what's next, shown on the customer link.
alter table public.location_shares
  add column driver_vehicle text check (driver_vehicle is null or char_length(driver_vehicle) between 1 and 60),
  add column driver_plate   text check (driver_plate is null or driver_plate ~ '^[A-Z0-9 ]{2,12}$'),
  add column driver_phone   text check (driver_phone is null or driver_phone ~ '^\+?[0-9]{8,15}$'),
  add column next_stop_name text check (next_stop_name is null or char_length(next_stop_name) <= 160),
  add column stops_left     smallint check (stops_left is null or stops_left between 0 and 30);

-- Wipe the driver's phone along with the position when sharing stops
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
  if new.stopped_at is not null then
    new.latitude := null; new.longitude := null; new.heading := null; new.speed_mps := null; new.accuracy_m := null;
    new.driver_phone := null;
  end if;
  return new;
end;
$$;

drop function public.get_live_share(text);
create function public.get_live_share(p_token text)
returns table (
  status text, display_name text, destination_name text, dest_latitude double precision, dest_longitude double precision,
  eta_at timestamptz, latitude double precision, longitude double precision, heading real, speed_mps real,
  accuracy_m real, position_at timestamptz, expires_at timestamptz,
  driver_vehicle text, driver_plate text, driver_phone text, next_stop_name text, stops_left smallint
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
    s.next_stop_name, s.stops_left
  from public.location_shares s
  where s.token = p_token
$$;
revoke execute on function public.get_live_share(text) from public;
grant execute on function public.get_live_share(text) to anon, authenticated;
