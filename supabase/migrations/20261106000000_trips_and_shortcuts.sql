-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — trip history + ratings, and community shortcuts
-- ════════════════════════════════════════════════════════════════════════

-- ─── trips: a signed-in user's trip history (private to them) ───────────
create table public.trips (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  destination_name text not null check (char_length(destination_name) between 1 and 160),
  dest_latitude    double precision not null check (dest_latitude between -90 and 90),
  dest_longitude   double precision not null check (dest_longitude between -180 and 180),
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  distance_m       integer not null check (distance_m >= 0),
  duration_s       integer not null check (duration_s >= 0),
  arrived          boolean not null default false,
  route_summary    text check (route_summary is null or char_length(route_summary) <= 200),
  rating           smallint check (rating is null or rating between 1 and 5),
  rating_tags      text[] not null default '{}' check (cardinality(rating_tags) <= 8),
  rating_comment   text check (rating_comment is null or char_length(rating_comment) <= 500),
  created_at       timestamptz not null default now(),
  constraint trips_time_order check (ended_at >= started_at)
);

create index trips_user_idx on public.trips (user_id, started_at desc);

alter table public.trips enable row level security;

create policy "trips: owner full access"
  on public.trips for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── shortcuts: community-shared alternative roads ─────────────────────
create table public.shortcuts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 80),
  description   text check (description is null or char_length(description) <= 280),
  avoids        text check (avoids is null or char_length(avoids) <= 80),
  -- GeoJSON LineString coordinates [[lng,lat], ...], simplified on the device
  path          jsonb not null check (jsonb_typeof(path) = 'array' and jsonb_array_length(path) between 2 and 400),
  start_lat     double precision not null,
  start_lng     double precision not null,
  end_lat       double precision not null,
  end_lng       double precision not null,
  distance_m    integer not null check (distance_m between 300 and 60000),
  upvotes       integer not null default 0 check (upvotes >= 0),
  downvotes     integer not null default 0 check (downvotes >= 0),
  status        text not null default 'active' check (status in ('active', 'removed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint shortcuts_in_malaysia check (
    start_lat between 0.5 and 7.6 and start_lng between 99.4 and 119.5 and
    end_lat   between 0.5 and 7.6 and end_lng   between 99.4 and 119.5
  )
);

create index shortcuts_start_idx on public.shortcuts (start_lat, start_lng) where status = 'active';
create index shortcuts_user_idx on public.shortcuts (user_id, created_at desc);

create trigger shortcuts_updated_at
  before update on public.shortcuts
  for each row execute function public.set_updated_at();

create or replace function public.before_shortcut_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  new.status := 'active';
  new.upvotes := 0;
  new.downvotes := 0;
  new.created_at := now();
  new.updated_at := now();
  new.title := trim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.description := nullif(trim(regexp_replace(coalesce(new.description, ''), '\s+', ' ', 'g')), '');
  new.avoids := nullif(trim(coalesce(new.avoids, '')), '');

  select count(*) into recent from public.shortcuts
  where user_id = new.user_id and created_at > now() - interval '24 hours';
  if recent >= 5 then
    raise exception 'You can share up to 5 shortcuts a day.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger shortcuts_before_insert
  before insert on public.shortcuts
  for each row execute function public.before_shortcut_insert();

alter table public.shortcuts enable row level security;

create policy "shortcuts: public read"
  on public.shortcuts for select to anon, authenticated
  using (status = 'active');

create policy "shortcuts: signed-in users share their own"
  on public.shortcuts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "shortcuts: owners delete their own"
  on public.shortcuts for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke update on public.shortcuts from anon, authenticated;

-- ─── shortcut votes: useful / not useful ────────────────────────────────
create table public.shortcut_votes (
  shortcut_id  uuid not null references public.shortcuts (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  vote         smallint not null check (vote in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (shortcut_id, user_id)
);

create or replace function public.before_shortcut_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if exists (select 1 from public.shortcuts s where s.id = new.shortcut_id and s.user_id = new.user_id) then
    raise exception 'You cannot vote on your own shortcut.' using errcode = 'P0001', hint = 'own_shortcut';
  end if;
  return new;
end;
$$;

create trigger shortcut_votes_before
  before insert or update on public.shortcut_votes
  for each row execute function public.before_shortcut_vote();

create or replace function public.after_shortcut_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.shortcut_id, old.shortcut_id);
  v_up integer;
  v_down integer;
begin
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1)
  into v_up, v_down
  from public.shortcut_votes where shortcut_id = v_id;

  update public.shortcuts
  set upvotes = v_up,
      downvotes = v_down,
      -- hide shortcuts the community clearly rejects
      status = case when v_down >= 5 and v_down > v_up * 2 then 'removed' else status end
  where id = v_id;
  return null;
end;
$$;

create trigger shortcut_votes_after
  after insert or update or delete on public.shortcut_votes
  for each row execute function public.after_shortcut_vote();

alter table public.shortcut_votes enable row level security;

create policy "shortcut votes: read own"
  on public.shortcut_votes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "shortcut votes: vote as yourself"
  on public.shortcut_votes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "shortcut votes: change own vote"
  on public.shortcut_votes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "shortcut votes: remove own vote"
  on public.shortcut_votes for delete to authenticated
  using ((select auth.uid()) = user_id);
