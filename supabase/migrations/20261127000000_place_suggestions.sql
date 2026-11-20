-- Places people (or the AI address finder) suggest for searches that find nothing
-- (owner's request, Nov 2026: "Jalan P9C/1" isn't on Mapbox or OpenStreetMap).
--   pin       a point the person placed on the map themselves, with a name
--   redirect  text only: this search should show the result of another search
--             (e.g. "jalan p9c/1" → "NADI Presint 9 Fasa 10"); no Mapbox data kept
-- Admins approve each one; approving creates a JalanGo place or a pinned search.
-- Additive only: a new table and functions; nothing is dropped.

create table public.place_suggestions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  kind          text not null check (kind in ('pin', 'redirect')),
  query         text not null check (char_length(query) between 2 and 120),
  name          text not null check (char_length(name) between 2 and 120),
  address       text not null default '' check (char_length(address) <= 200),
  latitude      double precision check (latitude between 0.5 and 7.6),
  longitude     double precision check (longitude between 99.4 and 119.5),
  target_query  text check (target_query is null or char_length(target_query) between 2 and 200),
  source        text not null default 'user' check (source in ('user', 'ai')),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.users (id) on delete set null,
  constraint place_suggestions_shape check (
    (kind = 'pin' and latitude is not null and longitude is not null and target_query is null)
    or (kind = 'redirect' and latitude is null and longitude is null and target_query is not null)
  )
);
comment on table public.place_suggestions is 'Places suggested for searches that find nothing; admins approve. Pins are placed by people, redirects are text only.';
create index place_suggestions_pending_idx on public.place_suggestions (created_at desc) where status = 'pending';
create index place_suggestions_user_idx on public.place_suggestions (user_id, created_at desc);

alter table public.place_suggestions enable row level security;
create policy "place_suggestions: create own" on public.place_suggestions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "place_suggestions: read own or admin" on public.place_suggestions for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
revoke update, delete on public.place_suggestions from anon, authenticated;
revoke all on public.place_suggestions from anon;

-- New suggestions are always pending and unreviewed; at most 20 a day per person
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
  if (select count(*) from public.place_suggestions s where s.user_id = new.user_id and s.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Too many suggestions today. Try again tomorrow.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;
revoke execute on function public.before_place_suggestion_insert() from public, anon, authenticated;
create trigger place_suggestions_before_insert before insert on public.place_suggestions
  for each row execute function public.before_place_suggestion_insert();

-- Admin: approve (creates the JalanGo place or pinned search) or reject
create or replace function public.admin_review_place_suggestion(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  s public.place_suggestions;
  kw text;
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into s from public.place_suggestions where id = p_id for update;
  if not found then raise exception 'Suggestion not found.' using errcode = 'P0001', hint = 'not_found'; end if;
  if s.status <> 'pending' then raise exception 'Already reviewed.' using errcode = 'P0001', hint = 'reviewed'; end if;
  kw := public.normalize_search(s.query);
  if p_approve then
    if s.kind = 'pin' then
      insert into public.search_places (name, address, latitude, longitude, keywords, created_by)
      values (s.name, s.address, s.latitude, s.longitude, array[kw], (select auth.uid()))
      returning id into new_id;
    else
      insert into public.search_redirects (keywords, target_name, target_query, created_by)
      values (array[kw], s.name, s.target_query, (select auth.uid()))
      returning id into new_id;
    end if;
    update public.search_misses set status = 'fixed' where query_norm = kw;
  end if;
  update public.place_suggestions set status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_id;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), case when p_approve then 'place_suggestion_approved' else 'place_suggestion_rejected' end, 'search', coalesce(new_id, p_id), left(s.query || ' → ' || s.name, 120));
end;
$$;
revoke execute on function public.admin_review_place_suggestion(uuid, boolean) from public, anon;
grant execute on function public.admin_review_place_suggestion(uuid, boolean) to authenticated;
