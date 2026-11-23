-- POI-2B: POI engine tables and functions (owner approved the POI-2B design, 23 Nov 2026).
-- OpenStreetMap only (ODbL), pilot region Kuala Langat. Imports land in staging,
-- are processed into pois with a full change log, and every run can be rolled back.
--
--   poi_sources       sources and licences ('osm', ODbL)
--   poi_import_runs   one row per import run (extract URL / MD5 / timestamp, counts, status)
--   poi_staging       raw rows of each run, with the import rules' decision (kept 90 days)
--   pois              live POIs: OpenStreetMap data only, so ODbL share-alike stays on this table
--   poi_changes       every insert / update / hide / review, for audit and rollback (kept 2 years)
--   poi_links         links only to JalanGo's own places (search, community, listings)
--   poi_feedback      community checks (still open, closed, wrong place…); UI comes in POI-3
--
-- Nothing reads these tables directly: RLS on, no grants to anon/authenticated,
-- access only through the functions below (admins need 2FA through is_admin()).
-- No public search yet (POI-3). No Realtime publication.
-- Additive only: no existing table, function, policy or trigger is changed; nothing is dropped.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ─── sources ────────────────────────────────────────────────────────────
create table if not exists public.poi_sources (
  id          text primary key,
  name        text not null,
  licence     text not null,
  attribution text not null,
  url         text,
  active      boolean not null default true
);
insert into public.poi_sources (id, name, licence, attribution, url)
values ('osm', 'OpenStreetMap (Geofabrik extract)', 'ODbL-1.0', '© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright')
on conflict (id) do nothing;

-- ─── import runs ────────────────────────────────────────────────────────
create table if not exists public.poi_import_runs (
  id                uuid primary key default gen_random_uuid(),
  source            text not null references public.poi_sources (id),
  region            text not null check (region ~ '^[a-z0-9-]{2,40}$'),
  extract_url       text,
  extract_md5       text check (extract_md5 is null or extract_md5 ~ '^[0-9a-f]{32}$'),
  extract_timestamp timestamptz,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running' check (status in ('running', 'processed', 'held', 'failed', 'rolled_back')),
  counts            jsonb not null default '{}'::jsonb,
  note              text
);
comment on table public.poi_import_runs is 'One row per POI import run, with where its extract came from. Kept with the POIs.';

-- ─── staging ────────────────────────────────────────────────────────────
create table if not exists public.poi_staging (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references public.poi_import_runs (id) on delete cascade,
  osm_ref            text not null check (osm_ref ~ '^(node|way|relation)/[0-9]{1,15}$'),
  osm_version        integer,
  osm_last_edit      timestamptz,
  name               text check (name is null or char_length(name) <= 160),
  category           text not null check (category in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah')),
  subcategory        text check (subcategory is null or char_length(subcategory) <= 60),
  brand              text check (brand is null or char_length(brand) <= 80),
  branch             text check (branch is null or char_length(branch) <= 80),
  lat                double precision not null check (lat between 0.5 and 7.6),
  lng                double precision not null check (lng between 99.4 and 119.5),
  address            text check (address is null or char_length(address) <= 300),
  phone              text check (phone is null or phone ~ '^\+60[0-9]{8,10}$'),
  website            text check (website is null or char_length(website) <= 300),
  opening_hours      text check (opening_hours is null or char_length(opening_hours) <= 200),
  tags               jsonb not null default '{}'::jsonb,
  settlement_class   text check (settlement_class in ('bandar', 'pekan', 'kampung', 'penempatan_kecil', 'luar')),
  osm_place_tag      text check (osm_place_tag is null or osm_place_tag ~ '^[a-z_]{2,30}$'),
  nearest_place      text check (nearest_place is null or char_length(nearest_place) <= 120),
  coastal            boolean not null default false,
  inside_institution text check (inside_institution is null or char_length(inside_institution) <= 160),
  issues             text[] not null default '{}',
  quality            smallint not null default 0 check (quality between 0 and 100),
  decision           text not null check (decision in ('auto_approved', 'needs_review', 'rejected', 'duplicate', 'approved', 'merged', 'rolled_back')),
  reject_reason      text check (reject_reason is null or char_length(reject_reason) <= 200),
  match_poi_id       uuid,
  reviewed_by        uuid references public.users (id) on delete set null,
  reviewed_at        timestamptz,
  unique (run_id, osm_ref)
);
comment on table public.poi_staging is 'Raw OpenStreetMap rows of a POI import run with the import rules'' decision. Kept 90 days.';
create index if not exists poi_staging_run_decision_idx on public.poi_staging (run_id, decision);

-- ─── live POIs (OpenStreetMap only) ─────────────────────────────────────
create table if not exists public.pois (
  id               uuid primary key default gen_random_uuid(),
  source           text not null default 'osm' references public.poi_sources (id),
  region           text not null,
  osm_ref          text not null unique check (osm_ref ~ '^(node|way|relation)/[0-9]{1,15}$'),
  osm_version      integer,
  osm_last_edit    timestamptz,
  category         text not null check (category in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah')),
  subcategory      text,
  name             text not null check (char_length(name) between 2 and 160),
  name_norm        text not null,
  brand            text,
  branch           text,
  lat              double precision not null check (lat between 0.5 and 7.6),
  lng              double precision not null check (lng between 99.4 and 119.5),
  address          text,
  phone            text,
  website          text,
  opening_hours    text,
  settlement_class text check (settlement_class in ('bandar', 'pekan', 'kampung', 'penempatan_kecil', 'luar')),
  osm_place_tag    text,
  nearest_place    text,
  coastal          boolean not null default false,
  quality          smallint not null default 0 check (quality between 0 and 100),
  verification     text not null default 'belum' check (verification in ('belum', 'perlu_pengesahan', 'disahkan_komuniti', 'dilapor_tutup')),
  status           text not null default 'active' check (status in ('active', 'hidden', 'missing')),
  first_run        uuid references public.poi_import_runs (id) on delete set null,
  last_seen_run    uuid references public.poi_import_runs (id) on delete set null,
  updated_at       timestamptz not null default now()
);
comment on table public.pois is 'Live POIs from OpenStreetMap (ODbL derivative database: OSM data only; JalanGo''s own places are linked through poi_links, never merged in).';
create index if not exists pois_name_trgm_idx on public.pois using gin (name_norm extensions.gin_trgm_ops);
create index if not exists pois_latlng_idx on public.pois (lat, lng);
create index if not exists pois_category_status_idx on public.pois (category, status);
create index if not exists pois_region_status_idx on public.pois (region, status);

-- ─── change log ─────────────────────────────────────────────────────────
create table if not exists public.poi_changes (
  id      bigint generated always as identity primary key,
  run_id  uuid references public.poi_import_runs (id) on delete set null,
  poi_id  uuid references public.pois (id) on delete cascade,
  action  text not null check (action in ('insert', 'update', 'hide', 'missing', 'approve', 'reject', 'merge', 'rollback')),
  before  jsonb,
  after   jsonb,
  actor   uuid references public.users (id) on delete set null,
  reason  text check (reason is null or char_length(reason) <= 300),
  at      timestamptz not null default now()
);
comment on table public.poi_changes is 'Every change to pois (imports, reviews, rollbacks) with before/after. Kept 2 years.';
create index if not exists poi_changes_run_idx on public.poi_changes (run_id, id);
create index if not exists poi_changes_poi_idx on public.poi_changes (poi_id);

-- ─── links to JalanGo's own places (links only, never merged) ───────────
create table if not exists public.poi_links (
  poi_id      uuid not null references public.pois (id) on delete cascade,
  target_type text not null check (target_type in ('search_place', 'community_place', 'listing')),
  target_id   uuid not null,
  status      text not null default 'suggested' check (status in ('suggested', 'confirmed', 'rejected')),
  created_at  timestamptz not null default now(),
  primary key (poi_id, target_type, target_id)
);

-- ─── community checks (UI in POI-3) ─────────────────────────────────────
create table if not exists public.poi_feedback (
  id                 uuid primary key default gen_random_uuid(),
  poi_id             uuid not null references public.pois (id) on delete cascade,
  user_id            uuid not null references public.users (id) on delete cascade,
  kind               text not null check (kind in ('masih_beroperasi', 'sudah_tutup', 'lokasi_salah', 'kategori_salah', 'nama_salah', 'nama_dicadangkan')),
  suggested_name     text check (suggested_name is null or char_length(suggested_name) between 2 and 160),
  suggested_category text check (suggested_category is null or suggested_category in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah')),
  near               boolean not null default false,
  status             text not null default 'baru' check (status in ('baru', 'diterima', 'ditolak')),
  created_at         timestamptz not null default now(),
  unique (poi_id, user_id, kind)
);
comment on table public.poi_feedback is 'Community checks on a POI. Stores the account and the answer, never the location (near = was within 300 m when sending). Deleted with the account.';
create index if not exists poi_feedback_poi_idx on public.poi_feedback (poi_id, kind);

-- ─── locked down: functions only ────────────────────────────────────────
alter table public.poi_sources enable row level security;
alter table public.poi_import_runs enable row level security;
alter table public.poi_staging enable row level security;
alter table public.pois enable row level security;
alter table public.poi_changes enable row level security;
alter table public.poi_links enable row level security;
alter table public.poi_feedback enable row level security;
revoke all on public.poi_sources, public.poi_import_runs, public.poi_staging, public.pois, public.poi_changes, public.poi_links, public.poi_feedback from anon, authenticated;

-- POI as stored in the change log
create or replace function public.poi_snapshot(p public.pois)
returns jsonb language sql immutable set search_path = ''
as $$ select to_jsonb(p) - 'updated_at' $$;
revoke execute on function public.poi_snapshot(public.pois) from public, anon, authenticated;

-- ─── server only: start a run ───────────────────────────────────────────
create or replace function public.poi_start_run(p_region text, p_extract_url text, p_extract_md5 text, p_extract_timestamp timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare r uuid;
begin
  if exists (select 1 from public.poi_import_runs where status = 'running' and region = p_region and started_at > now() - interval '2 hours') then
    raise exception 'A run for % is already in progress.', p_region using errcode = '55000';
  end if;
  insert into public.poi_import_runs (source, region, extract_url, extract_md5, extract_timestamp)
  values ('osm', p_region, left(p_extract_url, 300), lower(p_extract_md5), p_extract_timestamp)
  returning id into r;
  -- Retention sweeps, a few hundred rows at a time (no scheduler on this project)
  delete from public.poi_staging s where s.id in (
    select x.id from public.poi_staging x join public.poi_import_runs y on y.id = x.run_id
     where y.started_at < now() - interval '90 days' limit 2000);
  delete from public.poi_changes c where c.id in (select z.id from public.poi_changes z where z.at < now() - interval '2 years' limit 2000);
  return r;
end;
$$;

-- ─── server only: add a batch of rows to a run (rules already applied by the import script) ─
create or replace function public.poi_ingest(p_run uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not exists (select 1 from public.poi_import_runs where id = p_run and status = 'running') then
    raise exception 'Run is not open.' using errcode = '55000';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Send at most 500 rows at a time.' using errcode = '22023';
  end if;
  insert into public.poi_staging (run_id, osm_ref, osm_version, osm_last_edit, name, category, subcategory, brand, branch, lat, lng,
    address, phone, website, opening_hours, tags, settlement_class, osm_place_tag, nearest_place, coastal, inside_institution,
    issues, quality, decision, reject_reason)
  select p_run, r.osm_ref, r.osm_version, r.osm_last_edit, nullif(trim(r.name), ''), r.category, r.subcategory, r.brand, r.branch, r.lat, r.lng,
    r.address, r.phone, r.website, r.opening_hours, coalesce(r.tags, '{}'::jsonb), r.settlement_class, r.osm_place_tag, r.nearest_place,
    coalesce(r.coastal, false), r.inside_institution, coalesce(r.issues, '{}'), greatest(0, least(100, coalesce(r.quality, 0))),
    r.decision, r.reject_reason
  from jsonb_to_recordset(p_rows) as r(osm_ref text, osm_version integer, osm_last_edit timestamptz, name text, category text, subcategory text,
    brand text, branch text, lat double precision, lng double precision, address text, phone text, website text, opening_hours text, tags jsonb,
    settlement_class text, osm_place_tag text, nearest_place text, coastal boolean, inside_institution text, issues text[], quality smallint,
    decision text, reject_reason text)
  where r.decision in ('auto_approved', 'needs_review', 'rejected', 'duplicate')
  on conflict (run_id, osm_ref) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ─── apply one approved staging row to pois (internal) ──────────────────
create or replace function public.poi_apply_row(s public.poi_staging, p_actor uuid, p_action text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  old public.pois;
  cur public.pois;
  v_region text := (select r.region from public.poi_import_runs r where r.id = s.run_id);
  stale boolean := s.osm_last_edit is not null and s.osm_last_edit < now() - interval '5 years' and not (s.tags ? 'check_date');
begin
  select * into old from public.pois where osm_ref = s.osm_ref;
  insert into public.pois as p (region, osm_ref, osm_version, osm_last_edit, category, subcategory, name, name_norm, brand, branch, lat, lng,
    address, phone, website, opening_hours, settlement_class, osm_place_tag, nearest_place, coastal, quality, verification, status, first_run, last_seen_run)
  values (v_region, s.osm_ref, s.osm_version, s.osm_last_edit, s.category, s.subcategory, s.name, public.normalize_search(s.name), s.brand, s.branch, s.lat, s.lng,
    s.address, s.phone, s.website, s.opening_hours, s.settlement_class, s.osm_place_tag, s.nearest_place, s.coastal,
    greatest(0, s.quality - case when stale then 10 else 0 end), case when stale then 'perlu_pengesahan' else 'belum' end, 'active', s.run_id, s.run_id)
  on conflict (osm_ref) do update set
    osm_version = excluded.osm_version, osm_last_edit = excluded.osm_last_edit, category = excluded.category, subcategory = excluded.subcategory,
    name = excluded.name, name_norm = excluded.name_norm, brand = excluded.brand, branch = excluded.branch, lat = excluded.lat, lng = excluded.lng,
    address = excluded.address, phone = excluded.phone, website = excluded.website, opening_hours = excluded.opening_hours,
    settlement_class = excluded.settlement_class, osm_place_tag = excluded.osm_place_tag, nearest_place = excluded.nearest_place,
    coastal = excluded.coastal, quality = excluded.quality,
    -- community answers outrank the import's guess
    verification = case when p.verification in ('disahkan_komuniti', 'dilapor_tutup') then p.verification else excluded.verification end,
    status = case when p.status = 'hidden' then 'hidden' else 'active' end,
    last_seen_run = excluded.last_seen_run, updated_at = now()
  returning * into cur;
  if old.id is null then
    insert into public.poi_changes (run_id, poi_id, action, after, actor) values (s.run_id, cur.id, p_action, public.poi_snapshot(cur), p_actor);
  elsif public.poi_snapshot(old) - 'last_seen_run' is distinct from public.poi_snapshot(cur) - 'last_seen_run' then
    insert into public.poi_changes (run_id, poi_id, action, before, after, actor) values (s.run_id, cur.id, case when p_action = 'insert' then 'update' else p_action end, public.poi_snapshot(old), public.poi_snapshot(cur), p_actor);
  end if;
  return cur.id;
end;
$$;
revoke execute on function public.poi_apply_row(public.poi_staging, uuid, text) from public, anon, authenticated;

-- ─── process a run: auto-approved rows go live, missing ones are hidden ─
-- Held (nothing applied) when it would hide > 5 % or change > 20 % of the region's live POIs.
create or replace function public.poi_process_run(p_run uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.poi_import_runs;
  s public.poi_staging;
  v_live integer; v_missing integer; v_changing integer;
  v_counts jsonb;
begin
  select * into v_run from public.poi_import_runs where id = p_run for update;
  if v_run.id is null or v_run.status not in ('running', 'held') then raise exception 'Run cannot be processed.' using errcode = '55000'; end if;
  select count(*) into v_live from public.pois where region = v_run.region and status = 'active';
  select count(*) into v_missing from public.pois p where p.region = v_run.region and p.status = 'active'
     and not exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref);
  select count(*) into v_changing from public.poi_staging x join public.pois p on p.osm_ref = x.osm_ref
   where x.run_id = p_run and x.decision = 'auto_approved' and (p.name, p.category, p.lat, p.lng) is distinct from (x.name, x.category, x.lat, x.lng);
  v_counts := jsonb_build_object(
    'rows', (select count(*) from public.poi_staging where run_id = p_run),
    'auto_approved', (select count(*) from public.poi_staging where run_id = p_run and decision = 'auto_approved'),
    'needs_review', (select count(*) from public.poi_staging where run_id = p_run and decision = 'needs_review'),
    'rejected', (select count(*) from public.poi_staging where run_id = p_run and decision = 'rejected'),
    'duplicate', (select count(*) from public.poi_staging where run_id = p_run and decision = 'duplicate'),
    'live_before', v_live, 'would_hide', v_missing, 'would_change', v_changing);
  if not p_force and v_live >= 20 and (v_missing > v_live * 0.05 or v_changing > v_live * 0.20) then
    update public.poi_import_runs set status = 'held', counts = v_counts, note = 'Ditahan: larian ini akan menyembunyikan lebih 5% atau mengubah lebih 20% POI aktif.' where id = p_run;
    return v_counts || '{"status":"held"}';
  end if;
  for s in select * from public.poi_staging where run_id = p_run and decision = 'auto_approved' order by osm_ref loop
    perform public.poi_apply_row(s, null, 'insert');
  end loop;
  with gone as (
    update public.pois p set status = 'missing', updated_at = now()
     where p.region = v_run.region and p.status = 'active'
       and not exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref)
    returning p.*)
  insert into public.poi_changes (run_id, poi_id, action, before, after)
  select p_run, g.id, 'missing', public.poi_snapshot(g) || '{"status":"active"}', public.poi_snapshot(g) from gone g;
  update public.poi_import_runs set status = 'processed', finished_at = now(), counts = v_counts where id = p_run;
  return v_counts || '{"status":"processed"}';
end;
$$;

-- ─── admin: release a held run ──────────────────────────────────────────
create or replace function public.poi_release_run(p_run uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if not exists (select 1 from public.poi_import_runs where id = p_run and status = 'held') then raise exception 'Run is not held.' using errcode = '55000'; end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_release_run', 'poi_import_run', p_run, null);
  return public.poi_process_run(p_run, true);
end;
$$;

-- ─── admin: approve / reject a staging row ──────────────────────────────
-- Same rules as the Admin screen (web/src/utils/poiReview.ts): no name, a generic
-- name not renamed, or a row of a rolled-back run cannot be approved.
create or replace function public.poi_review(p_id uuid, p_action text, p_category text default null, p_name text default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  s public.poi_staging;
  run_status text;
  new_name text := nullif(trim(coalesce(p_name, '')), '');
  poi uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into s from public.poi_staging where id = p_id for update;
  if s.id is null then raise exception 'Record not found.' using errcode = 'P0002'; end if;
  select status into run_status from public.poi_import_runs where id = s.run_id;
  if run_status = 'rolled_back' then raise exception 'This run was rolled back.' using errcode = '55000'; end if;
  if s.decision not in ('needs_review', 'auto_approved', 'duplicate', 'rejected') then raise exception 'Already decided.' using errcode = '55000'; end if;
  if p_action = 'reject' then
    update public.poi_staging set decision = 'rejected', reject_reason = left(coalesce(nullif(trim(p_reason), ''), 'ditolak admin'), 200), reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_id;
    insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_reject', 'poi_staging', p_id, left(p_reason, 200));
    return null;
  elsif p_action <> 'approve' then
    raise exception 'Unknown action.' using errcode = '22023';
  end if;
  if p_category is not null and p_category not in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah') then
    raise exception 'Unknown category.' using errcode = '22023';
  end if;
  s.name := coalesce(new_name, s.name);
  s.category := coalesce(p_category, s.category);
  if s.name is null or char_length(s.name) < 2 then raise exception 'A name is needed before approving.' using errcode = '22023', hint = 'nama_kosong'; end if;
  if new_name is null and 'nama_generik' = any (s.issues) then raise exception 'Give this place its real name before approving.' using errcode = '22023', hint = 'nama_generik'; end if;
  if s.settlement_class = 'luar' then raise exception 'Outside the area.' using errcode = '22023'; end if;
  update public.poi_staging set name = s.name, category = s.category, decision = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_id;
  poi := public.poi_apply_row(s, (select auth.uid()), 'approve');
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_approve', 'poi', poi, null);
  return poi;
end;
$$;

-- ─── admin: merge a staging row into an existing POI ────────────────────
-- The existing POI is kept; only its missing address or phone is filled in.
create or replace function public.poi_merge(p_id uuid, p_into uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare s public.poi_staging; old public.pois; cur public.pois;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into s from public.poi_staging where id = p_id for update;
  select * into old from public.pois where id = p_into for update;
  if s.id is null or old.id is null then raise exception 'Record not found.' using errcode = 'P0002'; end if;
  if s.decision not in ('needs_review', 'duplicate', 'auto_approved') then raise exception 'Already decided.' using errcode = '55000'; end if;
  update public.pois set address = coalesce(address, s.address), phone = coalesce(phone, s.phone), updated_at = now() where id = p_into returning * into cur;
  update public.poi_staging set decision = 'merged', match_poi_id = p_into, reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_id;
  insert into public.poi_changes (run_id, poi_id, action, before, after, actor, reason)
  values (s.run_id, p_into, 'merge', public.poi_snapshot(old), public.poi_snapshot(cur), (select auth.uid()), s.osm_ref);
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_merge', 'poi', p_into, s.osm_ref);
  return p_into;
end;
$$;

-- ─── admin: roll a run back (its changes undone, newest first) ──────────
create or replace function public.poi_rollback_run(p_run uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare c record; n integer := 0;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if not exists (select 1 from public.poi_import_runs where id = p_run and status in ('processed', 'held', 'failed')) then
    raise exception 'Run cannot be rolled back.' using errcode = '55000';
  end if;
  for c in select * from public.poi_changes where run_id = p_run and action <> 'rollback' order by id desc loop
    if c.before is null then
      -- inserted by this run: hide it
      update public.pois set status = 'hidden', updated_at = now() where id = c.poi_id;
    else
      update public.pois p set
        osm_version = b.osm_version, osm_last_edit = b.osm_last_edit, category = b.category, subcategory = b.subcategory, name = b.name,
        name_norm = b.name_norm, brand = b.brand, branch = b.branch, lat = b.lat, lng = b.lng, address = b.address, phone = b.phone,
        website = b.website, opening_hours = b.opening_hours, settlement_class = b.settlement_class, osm_place_tag = b.osm_place_tag,
        nearest_place = b.nearest_place, coastal = b.coastal, quality = b.quality, verification = b.verification, status = b.status,
        last_seen_run = b.last_seen_run, updated_at = now()
      from jsonb_populate_record(null::public.pois, c.before) b
      where p.id = c.poi_id;
    end if;
    insert into public.poi_changes (run_id, poi_id, action, before, after, actor, reason)
    values (p_run, c.poi_id, 'rollback', c.after, c.before, (select auth.uid()), 'undo ' || c.action || ' #' || c.id);
    n := n + 1;
  end loop;
  update public.poi_staging set decision = 'rolled_back' where run_id = p_run and decision in ('auto_approved', 'approved', 'needs_review', 'duplicate');
  update public.poi_import_runs set status = 'rolled_back', finished_at = coalesce(finished_at, now()) where id = p_run;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_rollback_run', 'poi_import_run', p_run, n || ' changes undone');
  return n;
end;
$$;

-- ─── admin: everything the Admin → POI screen shows ─────────────────────
create or replace function public.admin_poi_state(p_run uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'runs', coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc) from (select * from public.poi_import_runs order by started_at desc limit 20) r), '[]'::jsonb),
    'queue', coalesce((select jsonb_agg(to_jsonb(s) - 'tags' order by s.quality, s.osm_ref) from (
        select * from public.poi_staging x
         where (p_run is null or x.run_id = p_run) and x.decision in ('needs_review', 'duplicate')
           and x.run_id = coalesce(p_run, (select id from public.poi_import_runs order by started_at desc limit 1))
         order by x.quality limit 500) s), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(public.poi_snapshot(p)) from public.pois p where p.id in (select match_poi_id from public.poi_staging where match_poi_id is not null and (p_run is null or run_id = p_run))), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'active', (select count(*) from public.pois where status = 'active'),
      'hidden', (select count(*) from public.pois where status <> 'active'),
      'needs_check', (select count(*) from public.pois where status = 'active' and verification = 'perlu_pengesahan'),
      'with_address', (select count(*) from public.pois where status = 'active' and address is not null),
      'with_phone', (select count(*) from public.pois where status = 'active' and phone is not null),
      'with_hours', (select count(*) from public.pois where status = 'active' and opening_hours is not null),
      'by_category', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) n from public.pois where status = 'active' group by category) c), '{}'::jsonb),
      'open_feedback', (select count(*) from public.poi_feedback where status = 'baru')),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'run_id', c.run_id, 'poi_id', c.poi_id, 'action', c.action, 'reason', c.reason, 'at', c.at,
        'name', coalesce(c.after ->> 'name', c.before ->> 'name')) order by c.id desc)
        from (select * from public.poi_changes order by id desc limit 200) c), '[]'::jsonb)
  );
end;
$$;

-- ─── signed-in users: community check (UI in POI-3) ─────────────────────
-- p_lat/p_lng only decide "near" (within 300 m); they are not stored.
create or replace function public.poi_submit_feedback(p_poi uuid, p_kind text, p_lat double precision default null, p_lng double precision default null,
  p_suggested_name text default null, p_suggested_category text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  p public.pois;
  is_near boolean := false;
  open_n integer; closed_n integer;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into p from public.pois where id = p_poi and status = 'active';
  if p.id is null then return false; end if;
  -- Flood guard: 30 answers a day per account
  if (select count(*) from public.poi_feedback where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many answers today.' using errcode = '54000', hint = 'rate_limited';
  end if;
  if p_lat is not null and p_lng is not null then
    is_near := 6371000 * 2 * asin(sqrt(power(sin(radians(p_lat - p.lat) / 2), 2) + cos(radians(p.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - p.lng) / 2), 2))) <= 300;
  end if;
  insert into public.poi_feedback (poi_id, user_id, kind, suggested_name, suggested_category, near)
  values (p_poi, uid, p_kind, nullif(trim(coalesce(p_suggested_name, '')), ''), p_suggested_category, is_near)
  on conflict (poi_id, user_id, kind) do nothing;
  if not found then return false; end if;
  -- Two nearby people agreeing settles it; the other answer must not have been given
  select count(*) filter (where kind = 'masih_beroperasi' and near), count(*) filter (where kind = 'sudah_tutup' and near)
    into open_n, closed_n from public.poi_feedback where poi_id = p_poi and created_at > now() - interval '180 days';
  if open_n >= 2 and closed_n = 0 and p.verification <> 'disahkan_komuniti' then
    update public.pois set verification = 'disahkan_komuniti', quality = least(100, quality + 10), updated_at = now() where id = p_poi;
    insert into public.poi_changes (poi_id, action, before, after, reason) select p_poi, 'update', public.poi_snapshot(p), public.poi_snapshot(x), 'community: still open' from public.pois x where x.id = p_poi;
  elsif closed_n >= 2 and open_n = 0 and p.verification <> 'dilapor_tutup' then
    update public.pois set verification = 'dilapor_tutup', updated_at = now() where id = p_poi;
    insert into public.poi_changes (poi_id, action, before, after, reason) select p_poi, 'update', public.poi_snapshot(p), public.poi_snapshot(x), 'community: reported closed' from public.pois x where x.id = p_poi;
  end if;
  return true;
end;
$$;

-- ─── permissions ────────────────────────────────────────────────────────
revoke execute on function public.poi_start_run(text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.poi_ingest(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.poi_process_run(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.poi_release_run(uuid) from public, anon;
revoke execute on function public.poi_review(uuid, text, text, text, text) from public, anon;
revoke execute on function public.poi_merge(uuid, uuid) from public, anon;
revoke execute on function public.poi_rollback_run(uuid) from public, anon;
revoke execute on function public.admin_poi_state(uuid) from public, anon;
revoke execute on function public.poi_submit_feedback(uuid, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.poi_release_run(uuid) to authenticated;
grant execute on function public.poi_review(uuid, text, text, text, text) to authenticated;
grant execute on function public.poi_merge(uuid, uuid) to authenticated;
grant execute on function public.poi_rollback_run(uuid) to authenticated;
grant execute on function public.admin_poi_state(uuid) to authenticated;
grant execute on function public.poi_submit_feedback(uuid, text, double precision, double precision, text, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.poi_start_run(text, text, text, timestamptz) to service_role;
    grant execute on function public.poi_ingest(uuid, jsonb) to service_role;
    grant execute on function public.poi_process_run(uuid, boolean) to service_role;
  end if;
end $$;
