-- POI review queue answered by people nearby (owner chose option A, 28 Nov 2026).
--
-- Records waiting for review (not live yet) can be answered by signed-in people who
-- are stopped within 300 m of them:
--   nama       an unnamed or generic place (e.g. "Surau"): what is its real name?
--   kategori   a doubtful category: is "X" really a clinic? (ya / tidak)
--   awam       inside an institution: can the public go in? (ya / tidak; admin only)
--   tiada      the place is not there
-- Two different people nearby giving the same answer settle it on their own:
--   the same real name            → approved with that name (kept by later imports)
--   2 × kategori ya, no tidak     → approved
--   2 × kategori tidak, no ya     → rejected
--   2 × tiada, no other answer    → rejected
-- "awam" answers and anything that disagrees wait for the admin, who sees the
-- answers (names and counts, never who) in Admin → POI → Semakan. Duplicates are
-- never asked. The answering position is used for the 300 m check only, never kept.
--
-- Additive: one new table, four new functions. Nothing else changes.

create table if not exists public.poi_queue_answers (
  id          uuid primary key default gen_random_uuid(),
  staging_id  uuid not null references public.poi_staging (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  answer      text not null check (answer in ('nama', 'kategori_ya', 'kategori_tidak', 'awam_ya', 'awam_tidak', 'tiada')),
  name        text check (name is null or char_length(name) between 3 and 120),
  name_norm   text,
  near        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (staging_id, user_id)
);
comment on table public.poi_queue_answers is 'Answers from people nearby on POI records waiting for review. Account + answer only, never the location (near = within 300 m). Deleted with the account.';
create index if not exists poi_queue_answers_staging_idx on public.poi_queue_answers (staging_id);
create index if not exists poi_queue_answers_user_day_idx on public.poi_queue_answers (user_id, created_at);
alter table public.poi_queue_answers enable row level security;
revoke all on public.poi_queue_answers from anon, authenticated;

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

-- ─── signed-in: open records near me that I have not answered ───────────
create or replace function public.nearby_queue_records(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or p_lat is null or p_lng is null or p_lat not between 0.5 and 7.6 or p_lng not between 99.4 and 119.5 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'question', x.question, 'name', x.name, 'category', x.category, 'subcategory', x.subcategory,
                                        'lat', x.lat, 'lng', x.lng, 'distance_m', x.dist) order by x.dist)
      from (
        select s.id, public.poi_queue_question(s) as question, s.name, s.category, s.subcategory, s.lat, s.lng,
               round(111320 * sqrt(power(s.lat - p_lat, 2) + power((s.lng - p_lng) * cos(radians(p_lat)), 2)))::integer as dist
          from public.poi_staging s
          join public.poi_import_runs r on r.id = s.run_id and r.status = 'processed'
         where s.decision = 'needs_review' and s.reviewed_at is null
           and s.lat between p_lat - 0.005 and p_lat + 0.005 and s.lng between p_lng - 0.005 and p_lng + 0.005
           and public.poi_queue_question(s) is not null
           -- the latest processed run of that region only
           and r.id = (select r2.id from public.poi_import_runs r2 where r2.region = r.region and r2.status = 'processed' order by r2.started_at desc limit 1)
           and not exists (select 1 from public.poi_queue_answers a where a.staging_id = s.id and a.user_id = uid)
         order by dist
         limit 3
      ) x
     where x.dist <= 500), '[]'::jsonb);
end;
$$;

-- ─── settle a record when two nearby people agree (internal) ────────────
create or replace function public.poi_queue_settle(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  s public.poi_staging;
  run_status text;
  q text;
  top_name text; top_norm text; top_n integer; other_names integer;
  ya integer; tidak integer; tiada integer; total integer;
  poi uuid;
begin
  select * into s from public.poi_staging where id = p_id for update;
  if s.id is null or s.decision <> 'needs_review' or s.reviewed_at is not null then return 'open'; end if;
  select status into run_status from public.poi_import_runs where id = s.run_id;
  if run_status <> 'processed' then return 'open'; end if;
  q := public.poi_queue_question(s);
  select count(*) filter (where answer = 'kategori_ya' and near), count(*) filter (where answer = 'kategori_tidak' and near),
         count(*) filter (where answer = 'tiada' and near), count(*) filter (where near)
    into ya, tidak, tiada, total from public.poi_queue_answers where staging_id = p_id;

  -- two nearby "not there", nothing else said
  if tiada >= 2 and tiada = total then
    update public.poi_staging set decision = 'rejected', reject_reason = 'komuniti: tiada di lokasi', reviewed_at = now() where id = p_id;
    insert into public.poi_decisions (osm_ref, decision, name, category, osm_version, reason, run_id, reviewed_by, reviewed_at)
    values (s.osm_ref, 'rejected', case when char_length(s.name) >= 2 then s.name end, s.category, s.osm_version, 'komuniti: tiada di lokasi', s.run_id, null, now())
    on conflict (osm_ref) do update set decision = excluded.decision, name = excluded.name, category = excluded.category, osm_version = excluded.osm_version,
      reason = excluded.reason, run_id = excluded.run_id, reviewed_by = null, reviewed_at = excluded.reviewed_at;
    return 'rejected';
  end if;

  if q = 'nama' then
    select min(a.name), a.name_norm, count(*) into top_name, top_norm, top_n
      from public.poi_queue_answers a where a.staging_id = p_id and a.answer = 'nama' and a.near
     group by a.name_norm order by count(*) desc, min(a.created_at) limit 1;
    -- the most given name, by two people or more, with no other name given by two
    select count(*) into other_names from (
      select a.name_norm from public.poi_queue_answers a where a.staging_id = p_id and a.answer = 'nama' and a.near and a.name_norm <> top_norm
       group by a.name_norm having count(*) >= 2) o;
    if coalesce(top_n, 0) >= 2 and other_names = 0 and s.settlement_class is distinct from 'luar' then
      s.name := top_name;
    else
      return 'open';
    end if;
  elsif q = 'kategori' then
    if tidak >= 2 and ya = 0 then
      update public.poi_staging set decision = 'rejected', reject_reason = 'komuniti: kategori salah', reviewed_at = now() where id = p_id;
      insert into public.poi_decisions (osm_ref, decision, name, category, osm_version, reason, run_id, reviewed_by, reviewed_at)
      values (s.osm_ref, 'rejected', case when char_length(s.name) >= 2 then s.name end, s.category, s.osm_version, 'komuniti: kategori salah', s.run_id, null, now())
      on conflict (osm_ref) do update set decision = excluded.decision, name = excluded.name, category = excluded.category, osm_version = excluded.osm_version,
        reason = excluded.reason, run_id = excluded.run_id, reviewed_by = null, reviewed_at = excluded.reviewed_at;
      return 'rejected';
    end if;
    if not (ya >= 2 and tidak = 0) or s.name is null or char_length(s.name) < 2 or public.poi_is_generic(s.name) or s.settlement_class = 'luar' then
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

-- ─── signed-in: answer one record ───────────────────────────────────────
create or replace function public.answer_queue_record(p_id uuid, p_answer text, p_name text default null,
  p_lat double precision default null, p_lng double precision default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.poi_staging;
  q text;
  v_name text := nullif(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  is_near boolean := false;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into s from public.poi_staging where id = p_id;
  if s.id is null or s.decision <> 'needs_review' or s.reviewed_at is not null then return 'closed'; end if;
  q := public.poi_queue_question(s);
  if q is null then return 'closed'; end if;
  -- the answer must fit the question
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
  -- Flood guard: 30 answers a day per account (place checks and queue answers together)
  if (select count(*) from public.poi_queue_answers where user_id = uid and created_at > now() - interval '1 day')
     + (select count(*) from public.poi_feedback where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many answers today.' using errcode = '54000', hint = 'rate_limited';
  end if;
  if p_lat is not null and p_lng is not null then
    is_near := 6371000 * 2 * asin(sqrt(power(sin(radians(p_lat - s.lat) / 2), 2) + cos(radians(s.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - s.lng) / 2), 2))) <= 300;
  end if;
  insert into public.poi_queue_answers (staging_id, user_id, answer, name, name_norm, near)
  values (p_id, uid, p_answer, v_name, case when v_name is not null then public.normalize_search(v_name) end, is_near)
  on conflict (staging_id, user_id) do nothing;
  if not found then return 'answered'; end if;
  return public.poi_queue_settle(p_id);
end;
$$;

-- ─── admin: what people answered on the open records (never who) ────────
create or replace function public.admin_queue_answers()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_object_agg(g.staging_id, jsonb_build_object(
             'names', g.names, 'kategori_ya', g.kya, 'kategori_tidak', g.ktidak, 'awam_ya', g.aya, 'awam_tidak', g.atidak, 'tiada', g.tiada, 'near', g.near_n))
      from (
        select a.staging_id,
               coalesce((select jsonb_agg(jsonb_build_object('name', n.name, 'n', n.c) order by n.c desc)
                           from (select min(b.name) as name, count(*) as c from public.poi_queue_answers b
                                  where b.staging_id = a.staging_id and b.answer = 'nama' group by b.name_norm) n), '[]'::jsonb) as names,
               count(*) filter (where a.answer = 'kategori_ya') as kya, count(*) filter (where a.answer = 'kategori_tidak') as ktidak,
               count(*) filter (where a.answer = 'awam_ya') as aya, count(*) filter (where a.answer = 'awam_tidak') as atidak,
               count(*) filter (where a.answer = 'tiada') as tiada, count(*) filter (where a.near) as near_n
          from public.poi_queue_answers a
          join public.poi_staging s on s.id = a.staging_id
         where s.decision = 'needs_review' and s.reviewed_at is null
         group by a.staging_id
      ) g), '{}'::jsonb);
end;
$$;

revoke execute on function public.poi_queue_question(public.poi_staging) from public, anon, authenticated;
revoke execute on function public.poi_queue_settle(uuid) from public, anon, authenticated;
revoke execute on function public.nearby_queue_records(double precision, double precision) from public, anon;
revoke execute on function public.answer_queue_record(uuid, text, text, double precision, double precision) from public, anon;
revoke execute on function public.admin_queue_answers() from public, anon;
grant execute on function public.nearby_queue_records(double precision, double precision) to authenticated;
grant execute on function public.answer_queue_record(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.admin_queue_answers() to authenticated;
