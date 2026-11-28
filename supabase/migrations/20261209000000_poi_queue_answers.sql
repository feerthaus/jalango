-- Community confirmation of POIs, by people on the spot and people who live or work
-- around (owner decisions, 28 Nov 2026: option A; 3 people, at least 1 on the spot;
-- "Kawasan saya" kept on the phone only).
--
-- Who counts:
--   near   on the spot: within 300 m when answering
--   local  answering about a place within 1.5 km of one of their own areas (home,
--          work, parents' house…). The area is kept on the phone; the app sends it
--          rounded to ~1 km with the answer, it is used for this check and dropped.
-- An answer counts when it is near or local. A decision needs 3 different people
-- giving the same answer, at least 1 of them near, and no counted answer saying
-- otherwise. Disagreements wait for the admin.
--
-- Records waiting for review (not live yet):
--   nama       an unnamed or generic place: what is its real name?
--   kategori   a doubtful category: is "X" really a clinic? (ya / tidak)
--   awam       inside an institution: can the public go in? (admin decides)
--   tiada      the place is not there
--   → 3 × the same real name: approved with it (kept by later imports)
--   → 3 × kategori ya: approved · 3 × kategori tidak: rejected · 3 × tiada: rejected
-- Live POIs ("Betul ke maklumat ni?", "Adakah … di sini?"): 3 × still open →
-- "Disahkan komuniti"; 3 × closed → reported closed (leaves search). This replaces
-- the earlier rule (2 people on the spot).
--
-- Only the account and the answer are kept, never a location. Admins see answers and
-- counts, never who. 30 answers a day per account. Duplicates are never asked.
--
-- Additive: one new table, one new column with a default, new functions; poi_submit_feedback
-- and poi_feedback_mine replaced with the same signatures and grants. Nothing is dropped.

-- ─── distance in metres (internal) ──────────────────────────────────────
create or replace function public.poi_dist_m(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable set search_path = ''
as $$ select 6371000 * 2 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))) $$;

-- ─── answers on records waiting for review ──────────────────────────────
create table if not exists public.poi_queue_answers (
  id          uuid primary key default gen_random_uuid(),
  staging_id  uuid not null references public.poi_staging (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  answer      text not null check (answer in ('nama', 'kategori_ya', 'kategori_tidak', 'awam_ya', 'awam_tidak', 'tiada')),
  name        text check (name is null or char_length(name) between 3 and 120),
  name_norm   text,
  near        boolean not null default false,
  local       boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (staging_id, user_id)
);
comment on table public.poi_queue_answers is 'Answers on POI records waiting for review. Account + answer only, never a location (near = within 300 m, local = within 1.5 km of one of their areas). Deleted with the account.';
create index if not exists poi_queue_answers_staging_idx on public.poi_queue_answers (staging_id);
create index if not exists poi_queue_answers_user_day_idx on public.poi_queue_answers (user_id, created_at);
alter table public.poi_queue_answers enable row level security;
revoke all on public.poi_queue_answers from anon, authenticated;

-- People who live or work around count on live POIs too
alter table public.poi_feedback add column if not exists local boolean not null default false;
comment on column public.poi_feedback.local is 'Answered about a place within 1.5 km of one of their own areas (the area itself is never kept).';

-- Which question a record gets (null = not asked: duplicates, other issues)
create or replace function public.poi_queue_question(s public.poi_staging)
returns text language sql immutable set search_path = ''
as $$
  select case
    when s.decision <> 'needs_review' then null
    when 'institusi' = any (s.issues) then 'awam'
    when 'nama_kosong' = any (s.issues) or 'nama_generik' = any (s.issues) then 'nama'
    when 'kategori_meragukan' = any (s.issues) then 'kategori'
    else null end
$$;

-- Answers per account per day: place checks and review answers together
create or replace function public.poi_answers_today(p_user uuid)
returns integer language sql stable security definer set search_path = ''
as $$
  select ((select count(*) from public.poi_queue_answers where user_id = p_user and created_at > now() - interval '1 day')
        + (select count(*) from public.poi_feedback where user_id = p_user and created_at > now() - interval '1 day'))::integer
$$;

-- ─── open review records around a point I have not answered ─────────────
-- p_radius: 500 m on the spot (map card), 1500 m around one of my areas
create or replace function public.queue_records_around(p_lat double precision, p_lng double precision, p_radius integer default 500)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rad integer := least(greatest(coalesce(p_radius, 500), 100), 1500);
  d double precision := rad / 100000.0 + 0.001;
begin
  if uid is null or p_lat is null or p_lng is null or p_lat not between 0.5 and 7.6 or p_lng not between 99.4 and 119.5 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'question', x.question, 'name', x.name, 'category', x.category, 'subcategory', x.subcategory,
                                        'lat', x.lat, 'lng', x.lng, 'distance_m', x.dist) order by x.dist)
      from (
        select s.id, public.poi_queue_question(s) as question, s.name, s.category, s.subcategory, s.lat, s.lng,
               round(public.poi_dist_m(p_lat, p_lng, s.lat, s.lng))::integer as dist
          from public.poi_staging s
          join public.poi_import_runs r on r.id = s.run_id and r.status = 'processed'
         where s.decision = 'needs_review' and s.reviewed_at is null
           and s.lat between p_lat - d and p_lat + d and s.lng between p_lng - d and p_lng + d
           and public.poi_queue_question(s) is not null
           -- the latest processed run of that region only
           and r.id = (select r2.id from public.poi_import_runs r2 where r2.region = r.region and r2.status = 'processed' order by r2.started_at desc limit 1)
           and not exists (select 1 from public.poi_queue_answers a where a.staging_id = s.id and a.user_id = uid)
         order by dist
         limit 5
      ) x
     where x.dist <= rad), '[]'::jsonb);
end;
$$;

-- Live POIs nobody has confirmed yet, around a point (same radius rule)
create or replace function public.unverified_pois_around(p_lat double precision, p_lng double precision, p_radius integer default 500)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rad integer := least(greatest(coalesce(p_radius, 500), 100), 1500);
  d double precision := rad / 100000.0 + 0.001;
begin
  if uid is null or p_lat is null or p_lng is null or p_lat not between 0.5 and 7.6 or p_lng not between 99.4 and 119.5 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'category', x.category, 'lat', x.lat, 'lng', x.lng, 'distance_m', x.dist) order by x.dist)
      from (
        select p.id, p.name, p.category, p.lat, p.lng, round(public.poi_dist_m(p_lat, p_lng, p.lat, p.lng))::integer as dist
          from public.pois p
         where p.status = 'active' and p.verification in ('belum', 'perlu_pengesahan')
           and p.lat between p_lat - d and p_lat + d and p.lng between p_lng - d and p_lng + d
           and not exists (select 1 from public.poi_feedback f where f.poi_id = p.id and f.user_id = uid)
         order by dist
         limit 5
      ) x
     where x.dist <= rad), '[]'::jsonb);
end;
$$;

-- ─── settle a review record (internal) ──────────────────────────────────
create or replace function public.poi_queue_settle(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  s public.poi_staging;
  run_status text;
  q text;
  top_name text; top_norm text; top_n integer; top_near integer; other_names integer;
  ya integer; ya_near integer; tidak integer; tidak_near integer; tiada integer; tiada_near integer; total integer;
  poi uuid;
  v_reason text;
begin
  select * into s from public.poi_staging where id = p_id for update;
  if s.id is null or s.decision <> 'needs_review' or s.reviewed_at is not null then return 'open'; end if;
  select status into run_status from public.poi_import_runs where id = s.run_id;
  if run_status <> 'processed' then return 'open'; end if;
  q := public.poi_queue_question(s);
  -- counted answers: on the spot or from people who live / work around
  select count(*) filter (where answer = 'kategori_ya' and (near or local)), count(*) filter (where answer = 'kategori_ya' and near),
         count(*) filter (where answer = 'kategori_tidak' and (near or local)), count(*) filter (where answer = 'kategori_tidak' and near),
         count(*) filter (where answer = 'tiada' and (near or local)), count(*) filter (where answer = 'tiada' and near),
         count(*) filter (where near or local)
    into ya, ya_near, tidak, tidak_near, tiada, tiada_near, total from public.poi_queue_answers where staging_id = p_id;

  if tiada >= 3 and tiada_near >= 1 and tiada = total then
    v_reason := 'komuniti: tiada di lokasi';
  elsif q = 'kategori' and tidak >= 3 and tidak_near >= 1 and ya = 0 and tiada = 0 then
    v_reason := 'komuniti: kategori salah';
  end if;
  if v_reason is not null then
    update public.poi_staging set decision = 'rejected', reject_reason = v_reason, reviewed_at = now() where id = p_id;
    insert into public.poi_decisions (osm_ref, decision, name, category, osm_version, reason, run_id, reviewed_by, reviewed_at)
    values (s.osm_ref, 'rejected', case when char_length(s.name) >= 2 then s.name end, s.category, s.osm_version, v_reason, s.run_id, null, now())
    on conflict (osm_ref) do update set decision = excluded.decision, name = excluded.name, category = excluded.category, osm_version = excluded.osm_version,
      reason = excluded.reason, run_id = excluded.run_id, reviewed_by = null, reviewed_at = excluded.reviewed_at;
    return 'rejected';
  end if;

  if q = 'nama' then
    select min(a.name), a.name_norm, count(*), count(*) filter (where a.near) into top_name, top_norm, top_n, top_near
      from public.poi_queue_answers a where a.staging_id = p_id and a.answer = 'nama' and (a.near or a.local)
     group by a.name_norm order by count(*) desc, min(a.created_at) limit 1;
    -- no counted answer giving another name or saying it is not there
    select count(*) into other_names from public.poi_queue_answers a
     where a.staging_id = p_id and (a.near or a.local) and (a.answer = 'tiada' or (a.answer = 'nama' and a.name_norm <> top_norm));
    if coalesce(top_n, 0) >= 3 and coalesce(top_near, 0) >= 1 and other_names = 0 and s.settlement_class is distinct from 'luar' then
      s.name := top_name;
    else
      return 'open';
    end if;
  elsif q = 'kategori' then
    if not (ya >= 3 and ya_near >= 1 and tidak = 0 and tiada = 0) or s.name is null or char_length(s.name) < 2 or public.poi_is_generic(s.name) or s.settlement_class = 'luar' then
      return 'open';
    end if;
  else
    -- 'awam' (inside an institution): the admin decides
    return 'open';
  end if;

  -- approve: same path as an admin approval, without an admin
  update public.poi_staging set name = s.name, decision = 'approved', reviewed_at = now() where id = p_id;
  poi := public.poi_apply_row(s, null, 'approve');
  update public.pois set verification = 'disahkan_komuniti', admin_override = (q = 'nama') or admin_override where id = poi;
  insert into public.poi_decisions (osm_ref, decision, name, category, osm_version, reason, run_id, reviewed_by, reviewed_at)
  values (s.osm_ref, 'approved', s.name, s.category, s.osm_version, 'komuniti', s.run_id, null, now())
  on conflict (osm_ref) do update set decision = excluded.decision, name = excluded.name, category = excluded.category, osm_version = excluded.osm_version,
    reason = excluded.reason, run_id = excluded.run_id, reviewed_by = null, reviewed_at = excluded.reviewed_at;
  return 'approved';
end;
$$;

-- ─── signed-in: answer one review record ────────────────────────────────
-- p_lat/p_lng: where I am (optional); p_area_lat/p_area_lng: one of my areas, rounded
-- (optional). Neither is kept.
create or replace function public.answer_queue_record(p_id uuid, p_answer text, p_name text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_area_lat double precision default null, p_area_lng double precision default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.poi_staging;
  q text;
  v_name text := nullif(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  is_near boolean := false;
  is_local boolean := false;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into s from public.poi_staging where id = p_id;
  if s.id is null or s.decision <> 'needs_review' or s.reviewed_at is not null then return 'closed'; end if;
  q := public.poi_queue_question(s);
  if q is null then return 'closed'; end if;
  if not (p_answer = 'tiada'
       or (q = 'nama' and p_answer = 'nama')
       or (q = 'kategori' and p_answer in ('kategori_ya', 'kategori_tidak'))
       or (q = 'awam' and p_answer in ('awam_ya', 'awam_tidak'))) then
    raise exception 'Answer does not fit the question.' using errcode = '22023';
  end if;
  if p_answer = 'nama' then
    if v_name is null or char_length(v_name) not between 3 and 120 then raise exception 'A name is needed.' using errcode = '22023', hint = 'nama_kosong'; end if;
    if public.poi_is_generic(v_name) then raise exception 'Give the real name.' using errcode = '22023', hint = 'nama_generik'; end if;
  else
    v_name := null;
  end if;
  if public.poi_answers_today(uid) >= 30 then raise exception 'Too many answers today.' using errcode = '54000', hint = 'rate_limited'; end if;
  if p_lat is not null and p_lng is not null then is_near := public.poi_dist_m(p_lat, p_lng, s.lat, s.lng) <= 300; end if;
  if p_area_lat is not null and p_area_lng is not null then is_local := public.poi_dist_m(p_area_lat, p_area_lng, s.lat, s.lng) <= 1500; end if;
  insert into public.poi_queue_answers (staging_id, user_id, answer, name, name_norm, near, local)
  values (p_id, uid, p_answer, v_name, case when v_name is not null then public.normalize_search(v_name) end, is_near, is_local)
  on conflict (staging_id, user_id) do nothing;
  if not found then return 'answered'; end if;
  return public.poi_queue_settle(p_id);
end;
$$;

-- ─── live POIs: community answers (3 people, at least 1 on the spot) ────
create or replace function public.poi_submit_feedback_v2(p_poi uuid, p_kind text,
  p_lat double precision default null, p_lng double precision default null,
  p_area_lat double precision default null, p_area_lng double precision default null,
  p_suggested_name text default null, p_suggested_category text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  p public.pois;
  is_near boolean := false;
  is_local boolean := false;
  open_n integer; open_near integer; closed_n integer; closed_near integer;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into p from public.pois where id = p_poi and status = 'active';
  if p.id is null then return false; end if;
  if public.poi_answers_today(uid) >= 30 then raise exception 'Too many answers today.' using errcode = '54000', hint = 'rate_limited'; end if;
  if p_lat is not null and p_lng is not null then is_near := public.poi_dist_m(p_lat, p_lng, p.lat, p.lng) <= 300; end if;
  if p_area_lat is not null and p_area_lng is not null then is_local := public.poi_dist_m(p_area_lat, p_area_lng, p.lat, p.lng) <= 1500; end if;
  insert into public.poi_feedback (poi_id, user_id, kind, suggested_name, suggested_category, near, local)
  values (p_poi, uid, p_kind, nullif(trim(coalesce(p_suggested_name, '')), ''), p_suggested_category, is_near, is_local)
  on conflict (poi_id, user_id, kind) do nothing;
  if not found then return false; end if;
  select count(*) filter (where kind = 'masih_beroperasi' and (near or local)), count(*) filter (where kind = 'masih_beroperasi' and near),
         count(*) filter (where kind = 'sudah_tutup' and (near or local)), count(*) filter (where kind = 'sudah_tutup' and near)
    into open_n, open_near, closed_n, closed_near
    from public.poi_feedback where poi_id = p_poi and created_at > now() - interval '180 days';
  if open_n >= 3 and open_near >= 1 and closed_n = 0 and p.verification <> 'disahkan_komuniti' then
    update public.pois set verification = 'disahkan_komuniti', quality = least(100, quality + 10), updated_at = now() where id = p_poi;
    insert into public.poi_changes (poi_id, action, before, after, reason) select p_poi, 'update', public.poi_snapshot(p), public.poi_snapshot(x), 'community: still open' from public.pois x where x.id = p_poi;
  elsif closed_n >= 3 and closed_near >= 1 and open_n = 0 and p.verification <> 'dilapor_tutup' then
    update public.pois set verification = 'dilapor_tutup', updated_at = now() where id = p_poi;
    insert into public.poi_changes (poi_id, action, before, after, reason) select p_poi, 'update', public.poi_snapshot(p), public.poi_snapshot(x), 'community: reported closed' from public.pois x where x.id = p_poi;
  end if;
  return true;
end;
$$;

-- The earlier function keeps working with the new rule (no area)
create or replace function public.poi_submit_feedback(p_poi uuid, p_kind text, p_lat double precision default null, p_lng double precision default null,
  p_suggested_name text default null, p_suggested_category text default null)
returns boolean language sql security definer set search_path = ''
as $$ select public.poi_submit_feedback_v2(p_poi, p_kind, p_lat, p_lng, null, null, p_suggested_name, p_suggested_category) $$;

-- My answers on a POI, its status and how many people confirmed it is still open
create or replace function public.poi_feedback_mine(p_poi uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'answered', coalesce((select jsonb_agg(f.kind order by f.kind) from public.poi_feedback f where f.poi_id = p_poi and f.user_id = (select auth.uid())), '[]'::jsonb),
    'verification', (select p.verification from public.pois p where p.id = p_poi and p.status = 'active'),
    'confirmations', (select count(*) from public.poi_feedback f where f.poi_id = p_poi and f.kind = 'masih_beroperasi' and (f.near or f.local)));
$$;

-- ─── admin: what people answered on the open records (never who) ────────
create or replace function public.admin_queue_answers()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_object_agg(g.staging_id, jsonb_build_object(
             'names', g.names, 'kategori_ya', g.kya, 'kategori_tidak', g.ktidak, 'awam_ya', g.aya, 'awam_tidak', g.atidak, 'tiada', g.tiada,
             'near', g.near_n, 'local', g.local_n))
      from (
        select a.staging_id,
               coalesce((select jsonb_agg(jsonb_build_object('name', n.name, 'n', n.c) order by n.c desc)
                           from (select min(b.name) as name, count(*) as c from public.poi_queue_answers b
                                  where b.staging_id = a.staging_id and b.answer = 'nama' and (b.near or b.local) group by b.name_norm) n), '[]'::jsonb) as names,
               count(*) filter (where a.answer = 'kategori_ya' and (a.near or a.local)) as kya,
               count(*) filter (where a.answer = 'kategori_tidak' and (a.near or a.local)) as ktidak,
               count(*) filter (where a.answer = 'awam_ya' and (a.near or a.local)) as aya,
               count(*) filter (where a.answer = 'awam_tidak' and (a.near or a.local)) as atidak,
               count(*) filter (where a.answer = 'tiada' and (a.near or a.local)) as tiada,
               count(*) filter (where a.near) as near_n, count(*) filter (where a.local and not a.near) as local_n
          from public.poi_queue_answers a
          join public.poi_staging s on s.id = a.staging_id
         where s.decision = 'needs_review' and s.reviewed_at is null
         group by a.staging_id
      ) g), '{}'::jsonb);
end;
$$;

revoke execute on function public.poi_dist_m(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.poi_queue_question(public.poi_staging) from public, anon, authenticated;
revoke execute on function public.poi_answers_today(uuid) from public, anon, authenticated;
revoke execute on function public.poi_queue_settle(uuid) from public, anon, authenticated;
revoke execute on function public.queue_records_around(double precision, double precision, integer) from public, anon;
revoke execute on function public.unverified_pois_around(double precision, double precision, integer) from public, anon;
revoke execute on function public.answer_queue_record(uuid, text, text, double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.poi_submit_feedback_v2(uuid, text, double precision, double precision, double precision, double precision, text, text) from public, anon;
revoke execute on function public.poi_submit_feedback(uuid, text, double precision, double precision, text, text) from public, anon;
revoke execute on function public.poi_feedback_mine(uuid) from public, anon;
revoke execute on function public.admin_queue_answers() from public, anon;
grant execute on function public.queue_records_around(double precision, double precision, integer) to authenticated;
grant execute on function public.unverified_pois_around(double precision, double precision, integer) to authenticated;
grant execute on function public.answer_queue_record(uuid, text, text, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.poi_submit_feedback_v2(uuid, text, double precision, double precision, double precision, double precision, text, text) to authenticated;
grant execute on function public.poi_submit_feedback(uuid, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.poi_feedback_mine(uuid) to authenticated;
grant execute on function public.admin_queue_answers() to authenticated;
