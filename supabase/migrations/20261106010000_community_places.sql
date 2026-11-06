-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — community picks: best food spots, attractions, nature, cafés
-- ════════════════════════════════════════════════════════════════════════

create table public.community_places (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 80),
  category          text not null check (category in ('food', 'cafe', 'attraction', 'nature', 'stay', 'other')),
  description       text check (description is null or char_length(description) <= 280),
  address           text check (address is null or char_length(address) <= 200),
  latitude          double precision not null,
  longitude         double precision not null,
  recommend_count   integer not null default 0 check (recommend_count >= 0),
  status            text not null default 'active' check (status in ('active', 'removed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint community_places_in_malaysia check (latitude between 0.5 and 7.6 and longitude between 99.4 and 119.5)
);

create index community_places_geo_idx on public.community_places (latitude, longitude) where status = 'active';
create index community_places_user_idx on public.community_places (user_id, created_at desc);

create trigger community_places_updated_at
  before update on public.community_places
  for each row execute function public.set_updated_at();

create or replace function public.before_community_place_insert()
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
  new.recommend_count := 0;
  new.created_at := now();
  new.updated_at := now();
  new.name := trim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.description := nullif(trim(regexp_replace(coalesce(new.description, ''), '\s+', ' ', 'g')), '');

  select count(*) into recent from public.community_places
  where user_id = new.user_id and created_at > now() - interval '24 hours';
  if recent >= 10 then
    raise exception 'You can recommend up to 10 places a day.' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  -- Same place already shared nearby (~100 m, same name)? Recommend that one instead.
  if exists (
    select 1 from public.community_places p
    where p.status = 'active'
      and lower(p.name) = lower(new.name)
      and abs(p.latitude - new.latitude) < 0.0009
      and abs(p.longitude - new.longitude) < 0.0009
  ) then
    raise exception 'This place is already shared. Give it a 👍 instead.' using errcode = 'P0001', hint = 'duplicate';
  end if;
  return new;
end;
$$;

create trigger community_places_before_insert
  before insert on public.community_places
  for each row execute function public.before_community_place_insert();

alter table public.community_places enable row level security;

create policy "community places: public read"
  on public.community_places for select to anon, authenticated
  using (status = 'active');

create policy "community places: signed-in users share their own"
  on public.community_places for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "community places: owners delete their own"
  on public.community_places for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke update on public.community_places from anon, authenticated;

-- "Best!" recommendations (one per user per place)
create table public.place_recommendations (
  place_id    uuid not null references public.community_places (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (place_id, user_id)
);

create or replace function public.after_place_recommendation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.place_id, old.place_id);
begin
  update public.community_places
  set recommend_count = (select count(*) from public.place_recommendations where place_id = v_id)
  where id = v_id;
  return null;
end;
$$;

create trigger place_recommendations_after
  after insert or delete on public.place_recommendations
  for each row execute function public.after_place_recommendation();

alter table public.place_recommendations enable row level security;

create policy "place recommendations: read own"
  on public.place_recommendations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "place recommendations: recommend as yourself"
  on public.place_recommendations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "place recommendations: undo own"
  on public.place_recommendations for delete to authenticated
  using ((select auth.uid()) = user_id);
