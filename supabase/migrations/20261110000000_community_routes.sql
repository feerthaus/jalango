-- Community Routes: long-distance alternatives drivers actually took (e.g. KL → Kota Bharu
-- via Gua Musang instead of the jammed LPT), with the real driving time they recorded.
-- Path ends are trimmed on the phone before upload so homes aren't revealed.
create table public.community_routes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 80),
  via_label    text check (via_label is null or char_length(via_label) <= 80),
  note         text check (note is null or char_length(note) <= 280),
  path         jsonb not null check (jsonb_typeof(path) = 'array' and jsonb_array_length(path) between 2 and 800),
  start_lat    double precision not null,
  start_lng    double precision not null,
  end_lat      double precision not null,
  end_lng      double precision not null,
  distance_m   integer not null check (distance_m between 20000 and 1500000),
  duration_s   integer not null check (duration_s between 600 and 129600),
  driven_at    timestamptz not null,
  upvotes      integer not null default 0 check (upvotes >= 0),
  downvotes    integer not null default 0 check (downvotes >= 0),
  status       text not null default 'active' check (status in ('active', 'removed')),
  created_at   timestamptz not null default now(),
  constraint community_routes_in_malaysia check (
    start_lat between 0.5 and 7.6 and start_lng between 99.4 and 119.5 and
    end_lat   between 0.5 and 7.6 and end_lng   between 99.4 and 119.5
  )
);
create index community_routes_ends_idx on public.community_routes (start_lat, start_lng, end_lat, end_lng) where status = 'active';
create index community_routes_user_idx on public.community_routes (user_id, created_at desc);

create or replace function public.before_community_route_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare recent integer;
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  new.status := 'active';
  new.upvotes := 0;
  new.downvotes := 0;
  new.created_at := now();
  new.title := trim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.via_label := nullif(trim(coalesce(new.via_label, '')), '');
  new.note := nullif(trim(regexp_replace(coalesce(new.note, ''), '\s+', ' ', 'g')), '');
  if new.driven_at > now() + interval '1 hour' or new.driven_at < now() - interval '60 days' then
    raise exception 'Only recent trips can be shared.' using errcode = 'P0001', hint = 'invalid';
  end if;
  select count(*) into recent from public.community_routes
  where user_id = new.user_id and created_at > now() - interval '24 hours';
  if recent >= 5 then
    raise exception 'You can share up to 5 routes a day.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger community_routes_before_insert
  before insert on public.community_routes
  for each row execute function public.before_community_route_insert();

alter table public.community_routes enable row level security;
create policy "community routes: public read" on public.community_routes for select to anon, authenticated using (status = 'active');
create policy "community routes: share your own" on public.community_routes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "community routes: owners delete their own" on public.community_routes for delete to authenticated using ((select auth.uid()) = user_id);
create policy "community routes: no posting while banned" on public.community_routes as restrictive for insert to authenticated with check (not public.is_banned());
revoke update on public.community_routes from anon, authenticated;

-- ─── votes: "this route helped" / "not worth it" ──────────────────────────
create table public.community_route_votes (
  route_id    uuid not null references public.community_routes (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  vote        smallint not null check (vote in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (route_id, user_id)
);

create or replace function public.before_community_route_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if exists (select 1 from public.community_routes r where r.id = new.route_id and r.user_id = new.user_id) then
    raise exception 'You cannot vote on your own route.' using errcode = 'P0001', hint = 'own_shortcut';
  end if;
  return new;
end;
$$;
create trigger community_route_votes_before
  before insert or update on public.community_route_votes
  for each row execute function public.before_community_route_vote();

create or replace function public.after_community_route_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.route_id, old.route_id);
  v_up integer;
  v_down integer;
begin
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1)
  into v_up, v_down
  from public.community_route_votes where route_id = v_id;
  update public.community_routes
  set upvotes = v_up,
      downvotes = v_down,
      status = case when v_down >= 5 and v_down > v_up * 2 then 'removed' else status end
  where id = v_id;
  return null;
end;
$$;
create trigger community_route_votes_after
  after insert or update or delete on public.community_route_votes
  for each row execute function public.after_community_route_vote();

alter table public.community_route_votes enable row level security;
create policy "route votes: read own" on public.community_route_votes for select to authenticated using ((select auth.uid()) = user_id);
create policy "route votes: vote as yourself" on public.community_route_votes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "route votes: change own vote" on public.community_route_votes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "route votes: remove own vote" on public.community_route_votes for delete to authenticated using ((select auth.uid()) = user_id);
create policy "route votes: no voting while banned" on public.community_route_votes as restrictive for insert to authenticated with check (not public.is_banned());

revoke execute on function public.before_community_route_insert() from public, anon, authenticated;
revoke execute on function public.before_community_route_vote() from public, anon, authenticated;
revoke execute on function public.after_community_route_vote() from public, anon, authenticated;
