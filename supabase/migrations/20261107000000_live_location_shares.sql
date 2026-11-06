-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — live location sharing with friends & family (by private link)
-- Only the latest position is stored (no history). Viewers need the secret
-- token; they read through a SECURITY DEFINER function, never the table.
-- ════════════════════════════════════════════════════════════════════════

create table public.location_shares (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique check (token ~ '^[A-Za-z0-9_-]{22,64}$'),
  user_id           uuid not null references public.users (id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 1 and 40),
  destination_name  text check (destination_name is null or char_length(destination_name) <= 160),
  dest_latitude     double precision check (dest_latitude is null or dest_latitude between -90 and 90),
  dest_longitude    double precision check (dest_longitude is null or dest_longitude between -180 and 180),
  eta_at            timestamptz,
  latitude          double precision check (latitude is null or latitude between -90 and 90),
  longitude         double precision check (longitude is null or longitude between -180 and 180),
  heading           real check (heading is null or heading between 0 and 360),
  speed_mps         real check (speed_mps is null or speed_mps between 0 and 90),
  accuracy_m        real check (accuracy_m is null or accuracy_m between 0 and 5000),
  position_at       timestamptz,
  expires_at        timestamptz not null,
  stopped_at        timestamptz,
  created_at        timestamptz not null default now(),
  constraint location_shares_max_12h check (expires_at <= created_at + interval '12 hours 1 minute')
);

create index location_shares_user_idx on public.location_shares (user_id, created_at desc);

create or replace function public.before_location_share_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare active integer;
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  new.created_at := now();
  new.stopped_at := null;
  if new.expires_at > now() + interval '12 hours' then new.expires_at := now() + interval '12 hours'; end if;
  select count(*) into active from public.location_shares
  where user_id = new.user_id and stopped_at is null and expires_at > now();
  if active >= 3 then
    raise exception 'You already have 3 live shares. Stop one first.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger location_shares_before_insert before insert on public.location_shares
  for each row execute function public.before_location_share_insert();

-- Owners may only move their own pin / stop sharing; identity, token and expiry can't be extended
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
    -- forget the position as soon as sharing stops
    new.latitude := null; new.longitude := null; new.heading := null; new.speed_mps := null; new.accuracy_m := null;
  end if;
  return new;
end;
$$;
create trigger location_shares_before_update before update on public.location_shares
  for each row execute function public.before_location_share_update();

alter table public.location_shares enable row level security;
create policy "shares: owner reads own" on public.location_shares for select to authenticated using ((select auth.uid()) = user_id);
create policy "shares: owner creates" on public.location_shares for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "shares: owner updates" on public.location_shares for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "shares: owner deletes" on public.location_shares for delete to authenticated using ((select auth.uid()) = user_id);
create policy "no live sharing while banned" on public.location_shares as restrictive for insert to authenticated with check (not public.is_banned());

-- Viewer access by secret token: only an active share, only what the page needs
create or replace function public.get_live_share(p_token text)
returns table (
  status text, display_name text, destination_name text, dest_latitude double precision, dest_longitude double precision,
  eta_at timestamptz, latitude double precision, longitude double precision, heading real, speed_mps real,
  accuracy_m real, position_at timestamptz, expires_at timestamptz
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
    s.position_at, s.expires_at
  from public.location_shares s
  where s.token = p_token
$$;
grant execute on function public.get_live_share(text) to anon, authenticated;

-- Housekeeping: drop ended shares after 7 days (positions are already gone)
create or replace function public.purge_old_location_shares()
returns integer language sql security definer set search_path = ''
as $$
  with gone as (delete from public.location_shares where expires_at < now() - interval '7 days' returning 1)
  select count(*)::integer from gone;
$$;

revoke execute on function public.purge_old_location_shares() from public, anon, authenticated;
revoke execute on function public.before_location_share_insert() from public, anon, authenticated;
revoke execute on function public.before_location_share_update() from public, anon, authenticated;
