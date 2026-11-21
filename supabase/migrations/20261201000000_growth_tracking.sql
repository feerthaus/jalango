-- Growth tracking (Phase 1, Sprint 3; owner approved the Migration Impact Report, Nov 2026).
-- Where people come from, which channels bring real (returning) users, and
-- which bring account and business sign-ups. Not page views.
--
--   device_attribution  first-touch channel per random device ID (the same ID
--                       app_activity uses: made on the phone, no account, IP or
--                       location). Kept 13 months.
--   growth_conversions  daily counts per channel of sign-ups and business
--                       registrations. No IDs at all. Kept 36 months.
--   growth_counted      one row per (event, account) so each account / business
--                       is counted once; deleted with the account.
--   app_activity        now also kept 13 months (it had no retention before).
--
-- No scheduler (pg_cron) on this project: old rows are swept, a few hundred at a
-- time, whenever a new device is recorded.
-- Additive only: new tables and functions. Existing tables, policies, triggers
-- and constraints are not changed; nothing is dropped.

-- ─── first touch per device ─────────────────────────────────────────────
create table if not exists public.device_attribution (
  device_id   uuid primary key,
  first_day   date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  source      text not null check (source in ('google', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'telegram', 'x', 'threads', 'youtube', 'email', 'sms', 'search_other', 'referral', 'direct', 'other')),
  medium      text not null check (medium in ('organic', 'paid', 'social', 'share', 'bio', 'broadcast', 'referral', 'email', 'none', 'other')),
  campaign    text check (campaign is null or campaign ~ '^[a-z0-9_-]{1,40}$'),
  ref_domain  text check (ref_domain is null or ref_domain ~ '^[a-z0-9.-]{3,100}$'),
  landing     text not null default '/' check (landing ~ '^/[a-z0-9/_-]{0,60}$')
);
comment on table public.device_attribution is 'First-touch channel per random device ID (no account, IP or location). Purpose: measure acquisition channels. Retention: 13 months.';
create index if not exists device_attribution_day_idx on public.device_attribution (first_day);
alter table public.device_attribution enable row level security;
revoke all on public.device_attribution from anon, authenticated;

-- ─── daily conversion counts per channel (no IDs) ───────────────────────
create table if not exists public.growth_conversions (
  day       date not null,
  source    text not null,
  medium    text not null,
  campaign  text not null default '',
  event     text not null check (event in ('signup', 'business_registered')),
  n         integer not null default 0 check (n >= 0),
  primary key (day, source, medium, campaign, event)
);
comment on table public.growth_conversions is 'Daily counts of sign-ups and business registrations per acquisition channel. Aggregate only, no IDs. Retention: 36 months.';
alter table public.growth_conversions enable row level security;
revoke all on public.growth_conversions from anon, authenticated;

-- ─── counted once per account (deleted with the account) ───────────────
create table if not exists public.growth_counted (
  event       text not null check (event in ('signup', 'business_registered')),
  user_id     uuid not null references public.users (id) on delete cascade,
  counted_at  timestamptz not null default now(),
  primary key (event, user_id)
);
comment on table public.growth_counted is 'Marks that an account / business was counted in growth_conversions, so it is counted once. Holds no channel or device.';
alter table public.growth_counted enable row level security;
revoke all on public.growth_counted from anon, authenticated;

-- ─── record a new device's first touch ──────────────────────────────────
create or replace function public.record_attribution(
  p_device uuid, p_source text, p_medium text, p_campaign text default null,
  p_ref_domain text default null, p_landing text default '/')
returns void language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  src text := lower(coalesce(p_source, ''));
  med text := lower(coalesce(p_medium, ''));
  camp text := lower(coalesce(p_campaign, ''));
  dom text := lower(coalesce(p_ref_domain, ''));
  land text := lower(coalesce(p_landing, '/'));
begin
  if p_device is null then return; end if;
  -- Anyone can call this (first visits aren't signed in): a daily cap keeps a
  -- flood of made-up IDs from swamping the table
  if (select count(*) from public.device_attribution where first_day = today) >= 5000 then return; end if;
  if src not in ('google', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'telegram', 'x', 'threads', 'youtube', 'email', 'sms', 'search_other', 'referral', 'direct', 'other') then src := 'other'; end if;
  if med not in ('organic', 'paid', 'social', 'share', 'bio', 'broadcast', 'referral', 'email', 'none', 'other') then med := 'other'; end if;
  insert into public.device_attribution (device_id, first_day, source, medium, campaign, ref_domain, landing)
  values (p_device, today, src, med,
          case when camp ~ '^[a-z0-9_-]{1,40}$' then camp end,
          case when dom ~ '^[a-z0-9.-]{3,100}$' then dom end,
          case when land ~ '^/[a-z0-9/_-]{0,60}$' then land else '/' end)
  on conflict (device_id) do nothing;
  -- Retention sweeps (13 months), a few hundred rows at a time
  delete from public.device_attribution d
   where d.device_id in (select x.device_id from public.device_attribution x where x.first_day < today - interval '13 months' limit 500);
  delete from public.app_activity a
   where (a.day, a.device_id) in (select y.day, y.device_id from public.app_activity y where y.day < today - interval '13 months' limit 500);
  delete from public.growth_conversions g
   where (g.day, g.source, g.medium, g.campaign, g.event) in (
     select z.day, z.source, z.medium, z.campaign, z.event from public.growth_conversions z where z.day < today - interval '36 months' limit 500);
end;
$$;
revoke execute on function public.record_attribution(uuid, text, text, text, text, text) from public;
grant execute on function public.record_attribution(uuid, text, text, text, text, text) to anon, authenticated;

-- ─── count a real sign-up / business registration, once ─────────────────
-- Only for an account (or its business) created in the last 24 hours, so it
-- can't be faked without creating one. The device ID only picks the channel;
-- no link between device and account is stored.
create or replace function public.record_conversion(p_device uuid, p_event text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  a public.device_attribution;
  fresh boolean;
  added integer;
begin
  if uid is null then return false; end if;
  if p_event = 'signup' then
    fresh := exists (select 1 from public.users u where u.id = uid and u.created_at > now() - interval '24 hours');
  elsif p_event = 'business_registered' then
    fresh := exists (select 1 from public.operators o where o.user_id = uid and o.created_at > now() - interval '24 hours');
  else
    return false;
  end if;
  if not fresh then return false; end if;
  insert into public.growth_counted (event, user_id) values (p_event, uid) on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then return false; end if;
  select * into a from public.device_attribution where device_id = p_device;
  insert into public.growth_conversions (day, source, medium, campaign, event, n)
  values (today, coalesce(a.source, 'direct'), coalesce(a.medium, 'none'), coalesce(a.campaign, ''), p_event, 1)
  on conflict (day, source, medium, campaign, event) do update set n = public.growth_conversions.n + 1;
  return true;
end;
$$;
revoke execute on function public.record_conversion(uuid, text) from public, anon;
grant execute on function public.record_conversion(uuid, text) to authenticated;

-- ─── admin view: per channel, aggregates only ───────────────────────────
-- "Real users": devices that opened JalanGo on at least 2 different days in
-- their first 14 days. The rate uses only devices at least 14 days old.
-- Campaigns with fewer than 5 devices are folded into "(lain-lain)".
create or replace function public.admin_growth(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  since date := today - greatest(1, least(coalesce(p_days, 30), 400));
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return (
    with d as (
      select da.device_id, da.source, da.medium, coalesce(da.campaign, '') as campaign, da.first_day,
             da.first_day <= today - 14 as matured,
             (select count(distinct a.day) from public.app_activity a
               where a.device_id = da.device_id and a.day between da.first_day and da.first_day + 13) >= 2 as real_user
      from public.device_attribution da
      where da.first_day > since
    ), conv as (
      select g.source, g.campaign,
             sum(g.n) filter (where g.event = 'signup') as signups,
             sum(g.n) filter (where g.event = 'business_registered') as businesses
      from public.growth_conversions g where g.day > since group by g.source, g.campaign
    ), by_source as (
      select s.source,
             count(d.device_id) as devices,
             count(d.device_id) filter (where d.real_user) as real_users,
             count(d.device_id) filter (where d.matured) as matured,
             count(d.device_id) filter (where d.matured and d.real_user) as matured_real
      from (select distinct source from d union select distinct source from conv) s
      left join d on d.source = s.source
      group by s.source
    ), camp as (
      select d.source, d.campaign, count(*) as devices, count(*) filter (where d.real_user) as real_users
      from d where d.campaign <> '' group by d.source, d.campaign
    )
    select jsonb_build_object(
      'days', today - since,
      'since', since,
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source', b.source, 'devices', b.devices, 'real_users', b.real_users, 'matured', b.matured, 'matured_real', b.matured_real,
          'signups', coalesce((select sum(c.signups) from conv c where c.source = b.source), 0),
          'businesses', coalesce((select sum(c.businesses) from conv c where c.source = b.source), 0)
        ) order by b.devices desc, b.source)
        from by_source b), '[]'::jsonb),
      'campaigns', coalesce((
        select jsonb_agg(jsonb_build_object('source', x.source, 'campaign', x.campaign, 'devices', x.devices, 'real_users', x.real_users) order by x.devices desc)
        from (
          select source, case when devices >= 5 then campaign else '(lain-lain)' end as campaign, sum(devices)::int as devices, sum(real_users)::int as real_users
          from camp group by source, case when devices >= 5 then campaign else '(lain-lain)' end
        ) x), '[]'::jsonb)
    )
  );
end;
$$;
revoke execute on function public.admin_growth(integer) from public, anon;
grant execute on function public.admin_growth(integer) to authenticated;
