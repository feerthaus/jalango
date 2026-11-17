-- Search that learns (owner's decision, 17 Nov 2026):
--  1. "Tak jumpa?" in search results: users say what they were looking for
--     (optionally with a Google Maps link, read as coordinates only).
--  2. Searches that found nothing, or where nothing was tapped, are counted.
--     Only the search text and counts are kept: no user, no location, no IP.
--     Rows are deleted 90 days after they were last seen.
--  3. Admins fix them without code: a synonym ("ktm" -> "stesen ktmb"), a
--     redirect (pin the right result: only its name is kept and it is looked
--     up again on each search, so no Mapbox data is stored), or a JalanGo
--     place added by coordinates from a link the user or admin gave.
-- Written only through the API server (service role); admins read and decide.

create table public.search_misses (
  query_norm  text primary key check (char_length(query_norm) between 2 and 120),
  sample      text not null check (char_length(sample) between 2 and 120),
  no_results  integer not null default 0 check (no_results >= 0),
  no_click    integer not null default 0 check (no_click >= 0),
  reports     integer not null default 0 check (reports >= 0),
  last_note   text check (last_note is null or char_length(last_note) <= 280),
  hint_name   text check (hint_name is null or char_length(hint_name) <= 120),
  hint_lat    double precision check (hint_lat is null or hint_lat between 0.5 and 7.6),
  hint_lng    double precision check (hint_lng is null or hint_lng between 99.4 and 119.5),
  status      text not null default 'open' check (status in ('open', 'fixed', 'ignored')),
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now()
);
create index search_misses_last_at_idx on public.search_misses (last_at);
create index search_misses_open_idx on public.search_misses (status, reports desc, no_results desc);
alter table public.search_misses enable row level security;
create policy "search_misses: admins read" on public.search_misses for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.search_misses from anon, authenticated;

create table public.search_synonyms (
  id            bigint generated always as identity primary key,
  word          text not null unique check (word ~ '^[a-z0-9&]{2,20}$'),
  alternatives  text[] not null check (cardinality(alternatives) between 1 and 3),
  active        boolean not null default true,
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.search_synonyms enable row level security;
create policy "search_synonyms: admins read" on public.search_synonyms for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.search_synonyms from anon, authenticated;

create table public.search_places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  address     text not null default '' check (char_length(address) <= 200),
  latitude    double precision not null check (latitude between 0.5 and 7.6),
  longitude   double precision not null check (longitude between 99.4 and 119.5),
  keywords    text[] not null default '{}' check (cardinality(keywords) <= 10),
  active      boolean not null default true,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.search_places enable row level security;
create policy "search_places: admins read" on public.search_places for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.search_places from anon, authenticated;

-- Pinned results: these words also search target_query and put target_name first.
-- Only text: no Mapbox coordinates or IDs are kept (Mapbox terms).
create table public.search_redirects (
  id            uuid primary key default gen_random_uuid(),
  keywords      text[] not null check (cardinality(keywords) between 1 and 10),
  target_name   text not null check (char_length(target_name) between 2 and 120),
  target_query  text not null check (char_length(target_query) between 2 and 200),
  active        boolean not null default true,
  created_by    uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.search_redirects enable row level security;
create policy "search_redirects: admins read" on public.search_redirects for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.search_redirects from anon, authenticated;

create or replace function public.normalize_search(p text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g')) $$;

-- API server only: count a miss (kind: no_results | no_click | reported)
create or replace function public.log_search_miss(
  p_query text, p_kind text, p_note text default null,
  p_hint_name text default null, p_hint_lat double precision default null, p_hint_lng double precision default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  q text := left(public.normalize_search(p_query), 120);
  sample text := left(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'), 120);
  has_hint boolean := p_hint_lat is not null and p_hint_lng is not null
    and p_hint_lat between 0.5 and 7.6 and p_hint_lng between 99.4 and 119.5;
begin
  if char_length(q) < 2 or p_kind not in ('no_results', 'no_click', 'reported') then return; end if;
  -- 90-day retention
  delete from public.search_misses where last_at < now() - interval '90 days';
  -- Flood guard: new searches stop being recorded past 5,000 open rows
  if not exists (select 1 from public.search_misses where query_norm = q)
     and (select count(*) from public.search_misses where status = 'open') >= 5000 then
    return;
  end if;
  insert into public.search_misses as m (query_norm, sample, no_results, no_click, reports, last_note, hint_name, hint_lat, hint_lng)
  values (
    q, sample,
    (p_kind = 'no_results')::int, (p_kind = 'no_click')::int, (p_kind = 'reported')::int,
    case when p_kind = 'reported' then nullif(left(trim(coalesce(p_note, '')), 280), '') end,
    case when p_kind = 'reported' and has_hint then nullif(left(trim(coalesce(p_hint_name, '')), 120), '') end,
    case when p_kind = 'reported' and has_hint then p_hint_lat end,
    case when p_kind = 'reported' and has_hint then p_hint_lng end)
  on conflict (query_norm) do update set
    no_results = m.no_results + (p_kind = 'no_results')::int,
    no_click   = m.no_click + (p_kind = 'no_click')::int,
    reports    = m.reports + (p_kind = 'reported')::int,
    last_note  = coalesce(excluded.last_note, m.last_note),
    hint_name  = case when excluded.hint_lat is not null then excluded.hint_name else m.hint_name end,
    hint_lat   = coalesce(excluded.hint_lat, m.hint_lat),
    hint_lng   = coalesce(excluded.hint_lng, m.hint_lng),
    -- someone still can't find it: a fixed search comes back for another look
    status     = case when p_kind = 'reported' and m.status = 'fixed' then 'open' else m.status end,
    last_at    = now();
end;
$$;
revoke execute on function public.log_search_miss(text, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.log_search_miss(text, text, text, text, double precision, double precision) to service_role;

-- Admin: open searches, most wanted first
create or replace function public.admin_search_misses()
returns setof public.search_misses language sql stable security definer set search_path = ''
as $$
  select * from public.search_misses
  where public.is_admin() and status = 'open'
  order by reports desc, no_results desc, no_click desc, last_at desc
  limit 200
$$;
revoke execute on function public.admin_search_misses() from public, anon;
grant execute on function public.admin_search_misses() to authenticated;

create or replace function public.admin_set_search_miss(p_query text, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_status not in ('open', 'fixed', 'ignored') then raise exception 'Unknown status.' using errcode = 'P0001', hint = 'invalid'; end if;
  update public.search_misses set status = p_status where query_norm = public.normalize_search(p_query);
  insert into public.admin_actions (admin_id, action, target_type, note)
  values ((select auth.uid()), 'search_miss_' || p_status, 'search', left(public.normalize_search(p_query), 120));
end;
$$;
revoke execute on function public.admin_set_search_miss(text, text) from public, anon;
grant execute on function public.admin_set_search_miss(text, text) to authenticated;

-- Admin: "ktm" also searches "stesen ktmb" (replaces the word's alternatives)
create or replace function public.admin_add_search_synonym(p_word text, p_alternatives text[], p_query text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  w text := public.normalize_search(p_word);
  alts text[] := array(select distinct public.normalize_search(a) from unnest(p_alternatives) a
                       where char_length(public.normalize_search(a)) between 2 and 60 and public.normalize_search(a) <> w);
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if w !~ '^[a-z0-9&]{2,20}$' then raise exception 'One word, letters and numbers only.' using errcode = 'P0001', hint = 'invalid'; end if;
  if cardinality(alts) not between 1 and 3 then raise exception 'Give 1 to 3 alternatives.' using errcode = 'P0001', hint = 'invalid'; end if;
  insert into public.search_synonyms (word, alternatives, created_by) values (w, alts, (select auth.uid()))
  on conflict (word) do update set alternatives = excluded.alternatives, active = true, created_by = excluded.created_by, created_at = now();
  if p_query is not null then
    update public.search_misses set status = 'fixed' where query_norm = public.normalize_search(p_query);
  end if;
  insert into public.admin_actions (admin_id, action, target_type, note)
  values ((select auth.uid()), 'search_synonym_added', 'search', w || ' -> ' || array_to_string(alts, ', '));
end;
$$;
revoke execute on function public.admin_add_search_synonym(text, text[], text) from public, anon;
grant execute on function public.admin_add_search_synonym(text, text[], text) to authenticated;

-- Admin: a place JalanGo shows first for these words (a pinned result or a new place)
create or replace function public.admin_add_search_place(
  p_name text, p_address text, p_lat double precision, p_lng double precision, p_keywords text[], p_query text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
  kws text[] := array(select distinct public.normalize_search(k) from unnest(coalesce(p_keywords, '{}')) k
                      where char_length(public.normalize_search(k)) between 2 and 120);
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  insert into public.search_places (name, address, latitude, longitude, keywords, created_by)
  values (trim(p_name), left(trim(coalesce(p_address, '')), 200), p_lat, p_lng, kws[1:10], (select auth.uid()))
  returning id into new_id;
  if p_query is not null then
    update public.search_misses set status = 'fixed' where query_norm = public.normalize_search(p_query);
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), 'search_place_added', 'search', new_id, left(trim(p_name), 120));
  return new_id;
end;
$$;
revoke execute on function public.admin_add_search_place(text, text, double precision, double precision, text[], text) from public, anon;
grant execute on function public.admin_add_search_place(text, text, double precision, double precision, text[], text) to authenticated;

-- Admin: pin the right result for these words (by name, looked up again each time)
create or replace function public.admin_add_search_redirect(p_target_name text, p_target_query text, p_keywords text[], p_query text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
  kws text[] := array(select distinct public.normalize_search(k) from unnest(coalesce(p_keywords, '{}')) k
                      where char_length(public.normalize_search(k)) between 2 and 120);
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if cardinality(kws) = 0 then raise exception 'Give at least one search text.' using errcode = 'P0001', hint = 'invalid'; end if;
  insert into public.search_redirects (keywords, target_name, target_query, created_by)
  values (kws[1:10], left(trim(p_target_name), 120), left(trim(p_target_query), 200), (select auth.uid()))
  returning id into new_id;
  if p_query is not null then
    update public.search_misses set status = 'fixed' where query_norm = public.normalize_search(p_query);
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), 'search_redirect_added', 'search', new_id, left(trim(p_target_name), 120));
  return new_id;
end;
$$;
revoke execute on function public.admin_add_search_redirect(text, text, text[], text) from public, anon;
grant execute on function public.admin_add_search_redirect(text, text, text[], text) to authenticated;

-- Admin: switch a synonym, redirect or place off (kept for the record)
create or replace function public.admin_retire_search_rule(p_kind text, p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_kind = 'synonym' then
    update public.search_synonyms set active = false where id = p_id::bigint;
  elsif p_kind = 'place' then
    update public.search_places set active = false where id = p_id::uuid;
  elsif p_kind = 'redirect' then
    update public.search_redirects set active = false where id = p_id::uuid;
  else
    raise exception 'Unknown kind.' using errcode = 'P0001', hint = 'invalid';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, note)
  values ((select auth.uid()), 'search_' || p_kind || '_retired', 'search', p_id);
end;
$$;
revoke execute on function public.admin_retire_search_rule(text, text) from public, anon;
grant execute on function public.admin_retire_search_rule(text, text) to authenticated;

-- Admin notification counts: + searches people reported, or that found nothing 3+ times
create or replace function public.admin_counts()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then return null; end if;
  select jsonb_build_object(
    'operators', (
      select count(*) from public.operators o
      where o.status = 'pending'
         or (o.kind = 'food' and o.halal_verified_at is null and exists (
               select 1 from public.operator_documents d where d.operator_id = o.id and d.kind = 'halal_jakim'))
    ),
    'listings', (
      select count(*) from public.listings l
      where l.status = 'pending'
         or (l.status in ('live', 'paused') and exists (
               select 1 from public.listing_photos p where p.listing_id = l.id and p.status = 'pending'))
    ),
    'flags', (select count(*) from (select distinct content_type, content_id from public.content_flags where status = 'open') f),
    'photos', (select count(*) from public.accident_records where photo_status = 'pending'),
    'feedback', (select count(*) from public.feedback where status = 'new'),
    'search', (select count(*) from public.search_misses where status = 'open' and (reports > 0 or no_results >= 3))
  ) into result;
  return result || jsonb_build_object('total',
    (result->>'operators')::int + (result->>'listings')::int + (result->>'flags')::int + (result->>'photos')::int
    + (result->>'feedback')::int + (result->>'search')::int);
end;
$$;
revoke execute on function public.admin_counts() from public, anon;
grant execute on function public.admin_counts() to authenticated;
