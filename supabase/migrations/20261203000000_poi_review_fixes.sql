-- POI review fixes after the first Kuala Langat import (owner approved, 25 Nov 2026).
--
--   1. Admin decisions are remembered per OpenStreetMap object (poi_decisions), so a
--      later import does not put already-reviewed records back in the queue. A record
--      goes back to the queue only when its OSM object has changed (new version).
--   2. A generic name ("Surau") left unchanged in the name box can no longer be approved.
--   3. Admin tools for live POIs: search, rename / change category, hide and show again.
--      A name or category set by an admin, and a hide by an admin, survive later imports.
--   4. Duplicate rows are linked to the nearest live POI (100 m), so "Merge" can be used.
--
-- Additive: one new table, two new columns with defaults, new functions. Existing
-- functions poi_apply_row, poi_process_run, poi_review, poi_merge and poi_rollback_run
-- are replaced with the same signatures and grants. Nothing is dropped.

-- ─── live POIs: what an admin decided ───────────────────────────────────
alter table public.pois add column if not exists admin_override boolean not null default false;
alter table public.pois add column if not exists hidden_by_admin boolean not null default false;
comment on column public.pois.admin_override is 'Name / category set by an admin: imports keep them.';
comment on column public.pois.hidden_by_admin is 'Hidden by an admin: imports keep it hidden (a rollback hide does not set this).';

-- ─── admin decisions per OpenStreetMap object (not swept after 90 days like staging) ─
create table if not exists public.poi_decisions (
  osm_ref      text primary key check (osm_ref ~ '^(node|way|relation)/[0-9]{1,15}$'),
  decision     text not null check (decision in ('approved', 'rejected', 'merged')),
  name         text check (name is null or char_length(name) between 2 and 160),
  category     text check (category is null or category in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah')),
  match_poi_id uuid,
  osm_version  integer,
  reason       text check (reason is null or char_length(reason) <= 200),
  run_id       uuid references public.poi_import_runs (id) on delete set null,
  reviewed_by  uuid references public.users (id) on delete set null,
  reviewed_at  timestamptz not null default now()
);
comment on table public.poi_decisions is 'Latest admin decision per OSM object, carried into later imports while the OSM version is unchanged.';
alter table public.poi_decisions enable row level security;
revoke all on public.poi_decisions from anon, authenticated;

-- Decisions already made in earlier runs (not rolled back)
insert into public.poi_decisions (osm_ref, decision, name, category, match_poi_id, osm_version, reason, run_id, reviewed_by, reviewed_at)
select distinct on (s.osm_ref) s.osm_ref, s.decision, s.name, s.category, s.match_poi_id, s.osm_version, s.reject_reason, s.run_id, s.reviewed_by, s.reviewed_at
  from public.poi_staging s join public.poi_import_runs r on r.id = s.run_id
 where s.reviewed_at is not null and s.decision in ('approved', 'rejected', 'merged') and r.status <> 'rolled_back'
 order by s.osm_ref, s.reviewed_at desc
on conflict (osm_ref) do nothing;

-- ─── generic names (same list as server/src/poi/rules.ts GENERIC) ───────
create or replace function public.poi_is_generic(p text)
returns boolean language sql immutable set search_path = ''
as $$ select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g')) ~ '^(kedai|restoran|restaurant|masjid|surau|musolla|klinik|farmasi|shop|cafe|kafe|hotel|kantin|canteen|warung|bengkel|pasar|stesen minyak|homestay|chalet)$' $$;

create or replace function public.poi_record_decision(s public.poi_staging, p_decision text, p_reason text, p_match uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.poi_decisions (osm_ref, decision, name, category, match_poi_id, osm_version, reason, run_id, reviewed_by, reviewed_at)
  values (s.osm_ref, p_decision, case when char_length(s.name) >= 2 then s.name end, s.category, p_match, s.osm_version, left(p_reason, 200), s.run_id, (select auth.uid()), now())
  on conflict (osm_ref) do update set decision = excluded.decision, name = excluded.name, category = excluded.category, match_poi_id = excluded.match_poi_id,
    osm_version = excluded.osm_version, reason = excluded.reason, run_id = excluded.run_id, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at;
$$;

-- ─── apply one approved staging row to pois (internal) ──────────────────
-- As before, but an import keeps an admin's name / category and an admin's hide.
create or replace function public.poi_apply_row(s public.poi_staging, p_actor uuid, p_action text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  old public.pois;
  cur public.pois;
  v_region text := (select r.region from public.poi_import_runs r where r.id = s.run_id);
  stale boolean := s.osm_last_edit is not null and s.osm_last_edit < now() - interval '5 years' and not (s.tags ? 'check_date');
  by_admin boolean := p_action = 'approve';
begin
  select * into old from public.pois where osm_ref = s.osm_ref;
  insert into public.pois as p (region, osm_ref, osm_version, osm_last_edit, category, subcategory, name, name_norm, brand, branch, lat, lng,
    address, phone, website, opening_hours, settlement_class, osm_place_tag, nearest_place, coastal, quality, verification, status, first_run, last_seen_run)
  values (v_region, s.osm_ref, s.osm_version, s.osm_last_edit, s.category, s.subcategory, s.name, public.normalize_search(s.name), s.brand, s.branch, s.lat, s.lng,
    s.address, s.phone, s.website, s.opening_hours, s.settlement_class, s.osm_place_tag, s.nearest_place, s.coastal,
    greatest(0, s.quality - case when stale then 10 else 0 end), case when stale then 'perlu_pengesahan' else 'belum' end, 'active', s.run_id, s.run_id)
  on conflict (osm_ref) do update set
    osm_version = excluded.osm_version, osm_last_edit = excluded.osm_last_edit,
    category = case when p.admin_override and not by_admin then p.category else excluded.category end,
    subcategory = excluded.subcategory,
    name = case when p.admin_override and not by_admin then p.name else excluded.name end,
    name_norm = case when p.admin_override and not by_admin then p.name_norm else excluded.name_norm end,
    brand = excluded.brand, branch = excluded.branch, lat = excluded.lat, lng = excluded.lng,
    address = excluded.address, phone = excluded.phone, website = excluded.website, opening_hours = excluded.opening_hours,
    settlement_class = excluded.settlement_class, osm_place_tag = excluded.osm_place_tag, nearest_place = excluded.nearest_place,
    coastal = excluded.coastal, quality = excluded.quality,
    -- community answers outrank the import's guess
    verification = case when p.verification in ('disahkan_komuniti', 'dilapor_tutup') then p.verification else excluded.verification end,
    status = case when p.hidden_by_admin then 'hidden' else 'active' end,
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

-- ─── carry earlier admin decisions into a new run (internal) ────────────
-- Only rows still open (review / duplicate) or rejected by the rules, and only while the
-- OSM object is the same version the admin looked at.
create or replace function public.poi_carry_reviews(p_run uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  update public.poi_staging x set
    decision = d.decision,
    name = case when d.decision = 'approved' then coalesce(d.name, x.name) else x.name end,
    category = case when d.decision = 'approved' then coalesce(d.category, x.category) else x.category end,
    reject_reason = case when d.decision = 'rejected' then coalesce(d.reason, 'ditolak admin') else null end,
    match_poi_id = case when d.decision = 'merged' then d.match_poi_id else x.match_poi_id end,
    reviewed_by = d.reviewed_by, reviewed_at = d.reviewed_at
  from public.poi_decisions d
  where x.run_id = p_run and x.osm_ref = d.osm_ref and x.reviewed_at is null
    and x.decision in ('needs_review', 'duplicate', 'rejected')
    and not (x.decision = 'rejected' and d.decision = 'rejected')
    and x.osm_version is not null and x.osm_version = d.osm_version;
  get diagnostics n = row_count;
  -- approved earlier and still in OpenStreetMap: seen in this run
  update public.pois p set last_seen_run = p_run
    from public.poi_staging x where x.run_id = p_run and x.decision = 'approved' and x.osm_ref = p.osm_ref;
  return n;
end;
$$;

-- ─── process a run ──────────────────────────────────────────────────────
-- As before, plus: earlier admin decisions carried in first, and duplicate rows
-- linked to the live POI they repeat: same category within 100 m, same name first.
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
  perform public.poi_carry_reviews(p_run);
  select count(*) into v_live from public.pois where region = v_run.region and status = 'active';
  select count(*) into v_missing from public.pois p where p.region = v_run.region and p.status = 'active'
     and not exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref);
  select count(*) into v_changing from public.poi_staging x join public.pois p on p.osm_ref = x.osm_ref
   where x.run_id = p_run and x.decision = 'auto_approved' and not p.admin_override
     and (p.name, p.category, p.lat, p.lng) is distinct from (x.name, x.category, x.lat, x.lng);
  v_counts := jsonb_build_object(
    'rows', (select count(*) from public.poi_staging where run_id = p_run),
    'auto_approved', (select count(*) from public.poi_staging where run_id = p_run and decision = 'auto_approved'),
    'needs_review', (select count(*) from public.poi_staging where run_id = p_run and decision = 'needs_review'),
    'rejected', (select count(*) from public.poi_staging where run_id = p_run and decision = 'rejected'),
    'duplicate', (select count(*) from public.poi_staging where run_id = p_run and decision = 'duplicate'),
    'carried', (select count(*) from public.poi_staging where run_id = p_run and reviewed_at is not null and reviewed_at < v_run.started_at),
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
  -- duplicates: point at the live POI they repeat, so the admin can merge
  update public.poi_staging x set match_poi_id = (
      select p.id from public.pois p
       where p.status = 'active' and p.category = x.category and p.osm_ref <> x.osm_ref
         and p.lat between x.lat - 0.001 and x.lat + 0.001 and p.lng between x.lng - 0.001 and x.lng + 0.001
         and 111320 * sqrt(power(p.lat - x.lat, 2) + power((p.lng - x.lng) * cos(radians(x.lat)), 2)) <= 100
       order by (p.name_norm = public.normalize_search(x.name)) desc,
                power(p.lat - x.lat, 2) + power((p.lng - x.lng) * cos(radians(x.lat)), 2)
       limit 1)
   where x.run_id = p_run and x.decision = 'duplicate' and x.match_poi_id is null;
  update public.poi_import_runs set status = 'processed', finished_at = now(), counts = v_counts where id = p_run;
  return v_counts || '{"status":"processed"}';
end;
$$;

-- ─── admin: approve / reject a staging row ──────────────────────────────
-- As before, except: a name only counts as new when it differs from the imported one,
-- a new name may not itself be generic, and the decision is remembered (poi_decisions).
create or replace function public.poi_review(p_id uuid, p_action text, p_category text default null, p_name text default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  s public.poi_staging;
  run_status text;
  new_name text := nullif(trim(coalesce(p_name, '')), '');
  renamed boolean;
  recategorised boolean;
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
    perform public.poi_record_decision(s, 'rejected', coalesce(nullif(trim(p_reason), ''), 'ditolak admin'), null);
    insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_reject', 'poi_staging', p_id, left(p_reason, 200));
    return null;
  elsif p_action <> 'approve' then
    raise exception 'Unknown action.' using errcode = '22023';
  end if;
  if p_category is not null and p_category not in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah') then
    raise exception 'Unknown category.' using errcode = '22023';
  end if;
  renamed := new_name is not null and public.normalize_search(new_name) is distinct from public.normalize_search(coalesce(s.name, ''));
  recategorised := p_category is not null and p_category <> s.category;
  if renamed and public.poi_is_generic(new_name) then raise exception 'Give this place its real name before approving.' using errcode = '22023', hint = 'nama_generik'; end if;
  if renamed then s.name := new_name; end if;
  s.category := coalesce(p_category, s.category);
  if s.name is null or char_length(s.name) < 2 then raise exception 'A name is needed before approving.' using errcode = '22023', hint = 'nama_kosong'; end if;
  if not renamed and ('nama_generik' = any (s.issues) or public.poi_is_generic(s.name)) then raise exception 'Give this place its real name before approving.' using errcode = '22023', hint = 'nama_generik'; end if;
  if s.settlement_class = 'luar' then raise exception 'Outside the area.' using errcode = '22023'; end if;
  update public.poi_staging set name = s.name, category = s.category, decision = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_id;
  poi := public.poi_apply_row(s, (select auth.uid()), 'approve');
  if renamed or recategorised then update public.pois set admin_override = true where id = poi; end if;
  perform public.poi_record_decision(s, 'approved', null, null);
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_approve', 'poi', poi, null);
  return poi;
end;
$$;

-- ─── admin: merge a staging row into an existing POI ────────────────────
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
  perform public.poi_record_decision(s, 'merged', null, p_into);
  insert into public.poi_changes (run_id, poi_id, action, before, after, actor, reason)
  values (s.run_id, p_into, 'merge', public.poi_snapshot(old), public.poi_snapshot(cur), (select auth.uid()), s.osm_ref);
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_merge', 'poi', p_into, s.osm_ref);
  return p_into;
end;
$$;

-- ─── admin: roll a run back ─────────────────────────────────────────────
-- As before, plus the decisions made in that run are forgotten (they go back to review).
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
  delete from public.poi_decisions where run_id = p_run;
  update public.poi_import_runs set status = 'rolled_back', finished_at = coalesce(finished_at, now()) where id = p_run;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_rollback_run', 'poi_import_run', p_run, n || ' changes undone');
  return n;
end;
$$;

-- ─── admin: find live POIs (name or osm_ref), hidden ones included ──────
create or replace function public.admin_poi_search(p_q text, p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare q text := public.normalize_search(left(coalesce(p_q, ''), 80));
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(public.poi_snapshot(p) || jsonb_build_object('admin_override', p.admin_override, 'hidden_by_admin', p.hidden_by_admin) order by p.name)
    from (select * from public.pois x
           where x.osm_ref = trim(p_q) or x.name_norm like '%' || replace(replace(q, '%', ''), '_', '') || '%'
           order by x.name limit greatest(1, least(coalesce(p_limit, 30), 100))) p), '[]'::jsonb);
end;
$$;

-- ─── admin: rename / change category of a live POI ──────────────────────
create or replace function public.poi_rename(p_poi uuid, p_name text, p_category text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare old public.pois; cur public.pois; v_name text := nullif(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into old from public.pois where id = p_poi for update;
  if old.id is null then raise exception 'Record not found.' using errcode = 'P0002'; end if;
  if v_name is null or char_length(v_name) not between 2 and 160 then raise exception 'A name is needed.' using errcode = '22023', hint = 'nama_kosong'; end if;
  if public.poi_is_generic(v_name) then raise exception 'Give this place its real name.' using errcode = '22023', hint = 'nama_generik'; end if;
  if p_category is not null and p_category not in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah') then
    raise exception 'Unknown category.' using errcode = '22023';
  end if;
  update public.pois set name = v_name, name_norm = public.normalize_search(v_name), category = coalesce(p_category, category),
    admin_override = true, updated_at = now() where id = p_poi returning * into cur;
  if public.poi_snapshot(old) is distinct from public.poi_snapshot(cur) then
    insert into public.poi_changes (poi_id, action, before, after, actor, reason) values (p_poi, 'update', public.poi_snapshot(old), public.poi_snapshot(cur), (select auth.uid()), 'admin: nama/kategori');
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note) values ((select auth.uid()), 'poi_rename', 'poi', p_poi, left(v_name, 200));
  return p_poi;
end;
$$;

-- ─── admin: hide a live POI / show it again ─────────────────────────────
create or replace function public.poi_set_hidden(p_poi uuid, p_hidden boolean, p_reason text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare old public.pois; cur public.pois; v_reason text := left(nullif(trim(coalesce(p_reason, '')), ''), 200);
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into old from public.pois where id = p_poi for update;
  if old.id is null then raise exception 'Record not found.' using errcode = 'P0002'; end if;
  if p_hidden and v_reason is null then raise exception 'Give a reason for hiding.' using errcode = '22023'; end if;
  update public.pois set status = case when p_hidden then 'hidden' else 'active' end, hidden_by_admin = p_hidden, updated_at = now()
   where id = p_poi returning * into cur;
  if old.status is distinct from cur.status then
    insert into public.poi_changes (poi_id, action, before, after, actor, reason)
    values (p_poi, case when p_hidden then 'hide' else 'update' end, public.poi_snapshot(old), public.poi_snapshot(cur), (select auth.uid()), coalesce(v_reason, 'admin: papar semula'));
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), case when p_hidden then 'poi_hide' else 'poi_show' end, 'poi', p_poi, v_reason);
  return p_poi;
end;
$$;

-- ─── grants ─────────────────────────────────────────────────────────────
revoke execute on function public.poi_is_generic(text) from public, anon, authenticated;
revoke execute on function public.poi_record_decision(public.poi_staging, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.poi_apply_row(public.poi_staging, uuid, text) from public, anon, authenticated;
revoke execute on function public.poi_carry_reviews(uuid) from public, anon, authenticated;
revoke execute on function public.poi_process_run(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.poi_review(uuid, text, text, text, text) from public, anon;
revoke execute on function public.poi_merge(uuid, uuid) from public, anon;
revoke execute on function public.poi_rollback_run(uuid) from public, anon;
revoke execute on function public.admin_poi_search(text, integer) from public, anon;
revoke execute on function public.poi_rename(uuid, text, text) from public, anon;
revoke execute on function public.poi_set_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.poi_review(uuid, text, text, text, text) to authenticated;
grant execute on function public.poi_merge(uuid, uuid) to authenticated;
grant execute on function public.poi_rollback_run(uuid) to authenticated;
grant execute on function public.admin_poi_search(text, integer) to authenticated;
grant execute on function public.poi_rename(uuid, text, text) to authenticated;
grant execute on function public.poi_set_hidden(uuid, boolean, text) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.poi_process_run(uuid, boolean) to service_role;
  end if;
end $$;
