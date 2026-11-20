-- Community checks for place suggestions (Fasa 1, owner's request, Nov 2026):
--   at_location  the person was within ~150 m of the pin when sending it (their
--                position is used for the check only, never stored)
--   votes        people near the pin answer "Betul ini …?" yes/no (one vote each,
--                only from within ~300 m of the pin, not the person who sent it)
--   auto-approve pin with at_location + 2 yes + 0 no, or 3 yes + 0 no
--   disputed     2 or more "no": no longer asked; waits for an admin
-- Duplicates (same search text within 300 m, pending or approved) are refused.
-- Additive only: new columns, a votes table, functions; nothing is dropped.

alter table public.place_suggestions add column if not exists at_location boolean not null default false;
alter table public.place_suggestions add column if not exists yes_count integer not null default 0 check (yes_count >= 0);
alter table public.place_suggestions add column if not exists no_count integer not null default 0 check (no_count >= 0);
alter table public.place_suggestions add column if not exists disputed boolean not null default false;

create table if not exists public.place_suggestion_votes (
  suggestion_id uuid not null references public.place_suggestions (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  vote          text not null check (vote in ('yes', 'no')),
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
alter table public.place_suggestion_votes enable row level security;
create policy "place_suggestion_votes: read own or admin" on public.place_suggestion_votes for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
revoke insert, update, delete on public.place_suggestion_votes from anon, authenticated;
revoke all on public.place_suggestion_votes from anon;

-- Metres between two points (equirectangular; fine at these distances)
create or replace function public.jg_meters(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable set search_path = ''
as $$ select 111320 * sqrt(power(a_lat - b_lat, 2) + power((a_lng - b_lng) * cos(radians((a_lat + b_lat) / 2)), 2)) $$;

-- Counts and the at-location flag only change through the functions below
create or replace function public.before_place_suggestion_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.status := 'pending';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.created_at := now();
  new.query := left(trim(new.query), 120);
  new.name := left(trim(new.name), 120);
  new.yes_count := 0;
  new.no_count := 0;
  new.disputed := false;
  if coalesce(current_setting('jalango.at_location', true), '') <> 'on' then new.at_location := false; end if;
  if (select count(*) from public.place_suggestions s where s.user_id = new.user_id and s.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many suggestions today. Try again tomorrow.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

-- Approving (by an admin or automatically) creates the JalanGo place or pinned search
create or replace function public.jg_apply_place_suggestion(p_id uuid, p_admin uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  s public.place_suggestions;
  kw text;
  new_id uuid;
begin
  select * into s from public.place_suggestions where id = p_id;
  kw := public.normalize_search(s.query);
  if s.kind = 'pin' then
    insert into public.search_places (name, address, latitude, longitude, keywords, created_by)
    values (s.name, s.address, s.latitude, s.longitude, array[kw], p_admin)
    returning id into new_id;
  else
    insert into public.search_redirects (keywords, target_name, target_query, created_by)
    values (array[kw], s.name, s.target_query, p_admin)
    returning id into new_id;
  end if;
  update public.search_misses set status = 'fixed' where query_norm = kw;
  update public.place_suggestions set status = 'approved', reviewed_at = now(), reviewed_by = p_admin where id = p_id;
  return new_id;
end;
$$;
revoke execute on function public.jg_apply_place_suggestion(uuid, uuid) from public, anon, authenticated;

create or replace function public.admin_review_place_suggestion(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  s public.place_suggestions;
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into s from public.place_suggestions where id = p_id for update;
  if not found then raise exception 'Suggestion not found.' using errcode = 'P0001', hint = 'not_found'; end if;
  if s.status <> 'pending' then raise exception 'Already reviewed.' using errcode = 'P0001', hint = 'reviewed'; end if;
  if p_approve then
    new_id := public.jg_apply_place_suggestion(p_id, (select auth.uid()));
  else
    update public.place_suggestions set status = 'rejected', reviewed_at = now(), reviewed_by = (select auth.uid()) where id = p_id;
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), case when p_approve then 'place_suggestion_approved' else 'place_suggestion_rejected' end, 'search', coalesce(new_id, p_id), left(s.query || ' → ' || s.name, 120));
end;
$$;

-- Send a suggestion. For a pin, the person's current position (if given) sets
-- at_location; it is not stored. Same text within 300 m already suggested → refused.
create or replace function public.submit_place_suggestion(
  p_kind text, p_query text, p_name text, p_address text,
  p_lat double precision, p_lng double precision, p_target_query text, p_source text,
  p_from_lat double precision default null, p_from_lng double precision default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  near boolean := false;
  new_id uuid;
begin
  if uid is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if p_kind = 'pin' and p_lat is not null and exists (
    select 1 from public.place_suggestions s
    where s.kind = 'pin' and s.status in ('pending', 'approved')
      and public.normalize_search(s.query) = public.normalize_search(p_query)
      and public.jg_meters(s.latitude, s.longitude, p_lat, p_lng) < 300
  ) then
    raise exception 'Already suggested here.' using errcode = 'P0001', hint = 'duplicate';
  end if;
  if p_kind = 'pin' and p_lat is not null and p_from_lat is not null and p_from_lng is not null then
    near := public.jg_meters(p_lat, p_lng, p_from_lat, p_from_lng) <= 150;
  end if;
  perform set_config('jalango.at_location', case when near then 'on' else 'off' end, true);
  insert into public.place_suggestions (user_id, kind, query, name, address, latitude, longitude, target_query, source, at_location)
  values (uid, p_kind, p_query, p_name, coalesce(p_address, ''), p_lat, p_lng, p_target_query, coalesce(p_source, 'user'), near)
  returning id into new_id;
  perform set_config('jalango.at_location', 'off', true);
  return new_id;
end;
$$;
revoke execute on function public.submit_place_suggestion(text, text, text, text, double precision, double precision, text, text, double precision, double precision) from public, anon;
grant execute on function public.submit_place_suggestion(text, text, text, text, double precision, double precision, text, text, double precision, double precision) to authenticated;

-- Pins waiting for checks near the person (not their own, not voted, not disputed)
create or replace function public.nearby_place_suggestions(p_lat double precision, p_lng double precision)
returns table (id uuid, name text, latitude double precision, longitude double precision, at_location boolean, yes_count integer)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.name, s.latitude, s.longitude, s.at_location, s.yes_count
  from public.place_suggestions s
  where s.kind = 'pin' and s.status = 'pending' and not s.disputed
    and s.user_id <> (select auth.uid())
    and s.latitude between p_lat - 0.01 and p_lat + 0.01
    and s.longitude between p_lng - 0.01 and p_lng + 0.01
    and public.jg_meters(s.latitude, s.longitude, p_lat, p_lng) <= 1000
    and not exists (select 1 from public.place_suggestion_votes v where v.suggestion_id = s.id and v.user_id = (select auth.uid()))
  order by public.jg_meters(s.latitude, s.longitude, p_lat, p_lng)
  limit 3
$$;
revoke execute on function public.nearby_place_suggestions(double precision, double precision) from public, anon;
grant execute on function public.nearby_place_suggestions(double precision, double precision) to authenticated;

-- "Betul ini …?" — only from within ~300 m of the pin; one vote per person
create or replace function public.vote_place_suggestion(p_id uuid, p_vote text, p_from_lat double precision, p_from_lng double precision)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.place_suggestions;
begin
  if uid is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if p_vote not in ('yes', 'no') then raise exception 'Invalid vote.' using errcode = 'P0001', hint = 'invalid'; end if;
  select * into s from public.place_suggestions where id = p_id for update;
  if not found or s.kind <> 'pin' or s.status <> 'pending' then raise exception 'Nothing to check.' using errcode = 'P0001', hint = 'not_found'; end if;
  if s.user_id = uid then raise exception 'You sent this one.' using errcode = 'P0001', hint = 'own'; end if;
  if p_from_lat is null or public.jg_meters(s.latitude, s.longitude, p_from_lat, p_from_lng) > 300 then
    raise exception 'Only people near the spot can check it.' using errcode = 'P0001', hint = 'too_far';
  end if;
  insert into public.place_suggestion_votes (suggestion_id, user_id, vote) values (p_id, uid, p_vote);
  update public.place_suggestions set
    yes_count = yes_count + (p_vote = 'yes')::int,
    no_count = no_count + (p_vote = 'no')::int,
    disputed = (no_count + (p_vote = 'no')::int) >= 2
  where id = p_id
  returning * into s;
  if s.no_count = 0 and ((s.at_location and s.yes_count >= 2) or s.yes_count >= 3) then
    perform public.jg_apply_place_suggestion(p_id, null);
    insert into public.admin_actions (admin_id, action, target_type, target_id, note)
    values (null, 'place_suggestion_auto_approved', 'search', p_id, left(s.query || ' → ' || s.name, 120));
    return 'approved';
  end if;
  return case when s.disputed then 'disputed' else 'pending' end;
exception when unique_violation then
  raise exception 'You already checked this one.' using errcode = 'P0001', hint = 'voted';
end;
$$;
revoke execute on function public.vote_place_suggestion(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.vote_place_suggestion(uuid, text, double precision, double precision) to authenticated;
