-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — initial schema
--   users · traffic_reports · report_confirmations · saved_locations
--   recent_destinations
-- Includes FKs, indexes, RLS, anti-spam triggers and Realtime publication.
-- Target: a DEDICATED Supabase project for JalanGo.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─── helpers ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- users: public profile, 1:1 with auth.users
-- ════════════════════════════════════════════════════════════════════════
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text check (name is null or char_length(name) between 1 and 80),
  email       text not null,
  created_at  timestamptz not null default now()
);

comment on table public.users is 'JalanGo profile, created automatically on sign-up.';

create unique index users_email_key on public.users (lower(email));

-- Create the profile when someone signs up via Supabase Auth
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;

create policy "users: read own profile"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);

create policy "users: update own profile"
  on public.users for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Email is owned by auth.users; only the name is user-editable.
revoke update on public.users from authenticated, anon;
grant update (name) on public.users to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- traffic_reports: community road reports
-- ════════════════════════════════════════════════════════════════════════
create table public.traffic_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  report_type    text not null check (report_type in (
                   'accident', 'congestion', 'road_closure', 'hazard',
                   'flood', 'breakdown', 'construction')),
  description    text check (description is null or char_length(description) <= 280),
  latitude       double precision not null,
  longitude      double precision not null,
  status         text not null default 'active'
                   check (status in ('active', 'resolved', 'expired', 'removed')),
  confirm_count  integer not null default 0 check (confirm_count >= 0),
  resolve_count  integer not null default 0 check (resolve_count >= 0),
  expires_at     timestamptz not null default now() + interval '2 hours',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Malaysia-first: Peninsular, Sabah, Sarawak and Labuan incl. coastal margin
  constraint traffic_reports_in_malaysia check (
    latitude between 0.5 and 7.6 and longitude between 99.4 and 119.5
  )
);

comment on table public.traffic_reports is 'User-submitted road reports. Never seeded with fabricated incidents.';
comment on column public.traffic_reports.expires_at is 'Reports auto-expire; confirmations extend this.';

create index traffic_reports_active_idx on public.traffic_reports (created_at desc) where status = 'active';
create index traffic_reports_geo_idx on public.traffic_reports (latitude, longitude) where status = 'active';
create index traffic_reports_user_idx on public.traffic_reports (user_id, created_at desc);
create index traffic_reports_type_idx on public.traffic_reports (report_type, status);

create trigger traffic_reports_updated_at
  before update on public.traffic_reports
  for each row execute function public.set_updated_at();

-- Default lifetime per report type
create or replace function public.report_default_ttl(p_type text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'construction' then interval '7 days'
    when 'road_closure' then interval '24 hours'
    when 'flood'        then interval '12 hours'
    when 'congestion'   then interval '1 hour'
    else interval '2 hours'
  end;
$$;

-- Validation + anti-spam on insert
create or replace function public.before_traffic_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  -- Callers may only report as themselves (RLS re-checks this after triggers)
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  -- Server-controlled fields: clients cannot forge these
  new.status        := 'active';
  new.confirm_count := 0;
  new.resolve_count := 0;
  new.created_at    := now();
  new.updated_at    := now();
  new.expires_at    := now() + public.report_default_ttl(new.report_type);
  new.description   := nullif(trim(regexp_replace(coalesce(new.description, ''), '\s+', ' ', 'g')), '');

  -- Rate limit: max 5 reports per user in 10 minutes, 30 per day
  select count(*) into recent_count
  from public.traffic_reports
  where user_id = new.user_id and created_at > now() - interval '10 minutes';
  if recent_count >= 5 then
    raise exception 'Too many reports. Please wait a few minutes.' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select count(*) into recent_count
  from public.traffic_reports
  where user_id = new.user_id and created_at > now() - interval '24 hours';
  if recent_count >= 30 then
    raise exception 'Daily report limit reached.' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  -- Duplicate: same user, same type, within ~150 m in the last 30 minutes
  if exists (
    select 1 from public.traffic_reports r
    where r.user_id = new.user_id
      and r.report_type = new.report_type
      and r.status = 'active'
      and r.created_at > now() - interval '30 minutes'
      and abs(r.latitude - new.latitude) < 0.00135
      and abs(r.longitude - new.longitude) < 0.00135
  ) then
    raise exception 'You already reported this nearby. Confirm the existing report instead.'
      using errcode = 'P0001', hint = 'duplicate';
  end if;

  return new;
end;
$$;

create trigger traffic_reports_before_insert
  before insert on public.traffic_reports
  for each row execute function public.before_traffic_report_insert();

alter table public.traffic_reports enable row level security;

-- Anyone (guests included) can see reports that haven't been moderated out
create policy "reports: public read"
  on public.traffic_reports for select to anon, authenticated
  using (status <> 'removed');

create policy "reports: signed-in users create their own"
  on public.traffic_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "reports: owners delete their own"
  on public.traffic_reports for delete to authenticated
  using ((select auth.uid()) = user_id);

-- No direct UPDATE for clients: status/counters change only via
-- report_confirmations triggers (or service role / moderation).
revoke update on public.traffic_reports from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- report_confirmations: "still there" / "resolved" votes
-- ════════════════════════════════════════════════════════════════════════
create table public.report_confirmations (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid not null references public.traffic_reports (id) on delete cascade,
  user_id            uuid not null references public.users (id) on delete cascade,
  confirmation_type  text not null check (confirmation_type in ('confirm', 'resolved')),
  created_at         timestamptz not null default now(),
  constraint report_confirmations_one_vote unique (report_id, user_id)
);

create index report_confirmations_user_idx on public.report_confirmations (user_id, created_at desc);

create or replace function public.before_report_confirmation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.traffic_reports%rowtype;
  recent_count integer;
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  new.created_at := now();

  select * into r from public.traffic_reports where id = new.report_id;
  if not found or r.status <> 'active' or r.expires_at < now() then
    raise exception 'This report is no longer active.' using errcode = 'P0001', hint = 'inactive';
  end if;

  -- Reporters can resolve their own report but not upvote it
  if r.user_id = new.user_id and new.confirmation_type = 'confirm' then
    raise exception 'You cannot confirm your own report.' using errcode = 'P0001', hint = 'own_report';
  end if;

  select count(*) into recent_count
  from public.report_confirmations
  where user_id = new.user_id and created_at > now() - interval '10 minutes';
  if recent_count >= 20 then
    raise exception 'Too many votes. Please wait a few minutes.' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  return new;
end;
$$;

create trigger report_confirmations_before_insert
  before insert on public.report_confirmations
  for each row execute function public.before_report_confirmation_insert();

-- Keep counters/status in sync
create or replace function public.after_report_confirmation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid := coalesce(new.report_id, old.report_id);
  v_owner uuid;
  v_confirms integer;
  v_resolves integer;
  v_owner_resolved boolean;
begin
  select user_id into v_owner from public.traffic_reports where id = v_report_id;

  select
    count(*) filter (where confirmation_type = 'confirm'),
    count(*) filter (where confirmation_type = 'resolved'),
    coalesce(bool_or(confirmation_type = 'resolved' and user_id = v_owner), false)
  into v_confirms, v_resolves, v_owner_resolved
  from public.report_confirmations
  where report_id = v_report_id;

  update public.traffic_reports
  set confirm_count = v_confirms,
      resolve_count = v_resolves,
      status = case
                 when status = 'active' and (v_owner_resolved or v_resolves >= 3 and v_resolves > v_confirms)
                   then 'resolved'
                 else status
               end,
      -- each fresh confirmation keeps the report alive a little longer (max +6h from now)
      expires_at = case
                     when tg_op = 'INSERT' and new.confirmation_type = 'confirm'
                       then least(greatest(expires_at, now()) + interval '30 minutes', now() + interval '6 hours')
                     else expires_at
                   end
  where id = v_report_id;

  return null;
end;
$$;

create trigger report_confirmations_after_change
  after insert or delete on public.report_confirmations
  for each row execute function public.after_report_confirmation_change();

alter table public.report_confirmations enable row level security;

create policy "confirmations: public read"
  on public.report_confirmations for select to anon, authenticated
  using (true);

create policy "confirmations: signed-in users vote as themselves"
  on public.report_confirmations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "confirmations: users withdraw their own vote"
  on public.report_confirmations for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke update on public.report_confirmations from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- saved_locations: favourites
-- ════════════════════════════════════════════════════════════════════════
create table public.saved_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  address     text check (address is null or char_length(address) <= 300),
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  created_at  timestamptz not null default now()
);

create index saved_locations_user_idx on public.saved_locations (user_id, created_at desc);
create unique index saved_locations_user_point_key
  on public.saved_locations (user_id, round(latitude::numeric, 5), round(longitude::numeric, 5));

alter table public.saved_locations enable row level security;

create policy "saved: owner full access"
  on public.saved_locations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- recent_destinations: search history (kept to the latest 20 per user)
-- ════════════════════════════════════════════════════════════════════════
create table public.recent_destinations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  destination_name  text not null check (char_length(destination_name) between 1 and 160),
  latitude          double precision not null check (latitude between -90 and 90),
  longitude         double precision not null check (longitude between -180 and 180),
  created_at        timestamptz not null default now()
);

create index recent_destinations_user_idx on public.recent_destinations (user_id, created_at desc);

create or replace function public.prune_recent_destinations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.recent_destinations
  where user_id = new.user_id
    and id not in (
      select id from public.recent_destinations
      where user_id = new.user_id
      order by created_at desc
      limit 20
    );
  return null;
end;
$$;

create trigger recent_destinations_prune
  after insert on public.recent_destinations
  for each row execute function public.prune_recent_destinations();

alter table public.recent_destinations enable row level security;

create policy "recents: owner full access"
  on public.recent_destinations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- Expiry job + Realtime
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.expire_stale_reports()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.traffic_reports
    set status = 'expired'
    where status = 'active' and expires_at < now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

revoke execute on function public.expire_stale_reports() from public, anon, authenticated;

-- Optional (requires the pg_cron extension, enable it in the dashboard first):
--   select cron.schedule('jalango-expire-reports', '*/5 * * * *', 'select public.expire_stale_reports()');

-- Clients subscribe to INSERT/UPDATE/DELETE on reports and confirmations
alter table public.traffic_reports replica identity full;
alter publication supabase_realtime add table public.traffic_reports;
alter publication supabase_realtime add table public.report_confirmations;
