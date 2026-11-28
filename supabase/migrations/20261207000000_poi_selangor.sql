-- POI-5 (owner chose option B, 28 Nov 2026): Selangor in search, labelled
-- "Belum disahkan" until people nearby confirm it.
--
--   poi_process_run          auto-approved rows go live in one statement (a state is
--                            ~13,000 rows), same rules as before; the region follows
--                            the run, so Kuala Langat POIs become Selangor's
--   poi_start_run            refuses a Kuala Langat run once Selangor has been
--                            imported (Selangor covers it); auto-approved staging rows
--                            are kept 14 days instead of 90 (storage)
--   search_pois              also returns verification (for the label)
--   nearby_unverified_pois   signed-in: up to 3 unconfirmed POIs within 500 m that I
--                            have not answered (the "is it here?" card); the position
--                            is used for this answer only, never stored
--
-- Additive: one new function; four replaced with the same signatures and grants.
-- Nothing is dropped. Importing Selangor still needs the owner's GO.

create or replace function public.poi_start_run(p_region text, p_extract_url text, p_extract_md5 text, p_extract_timestamp timestamptz)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare r uuid;
begin
  if exists (select 1 from public.poi_import_runs where status = 'running' and region = p_region and started_at > now() - interval '2 hours') then
    raise exception 'A run for % is already in progress.', p_region using errcode = '55000';
  end if;
  -- Selangor contains Kuala Langat: once Selangor has been imported, its runs cover it
  if p_region = 'kuala-langat' and exists (select 1 from public.poi_import_runs where region = 'selangor' and status = 'processed') then
    raise exception 'Kuala Langat is part of the Selangor import now.' using errcode = '55000';
  end if;
  insert into public.poi_import_runs (source, region, extract_url, extract_md5, extract_timestamp)
  values ('osm', p_region, left(p_extract_url, 300), lower(p_extract_md5), p_extract_timestamp)
  returning id into r;
  -- Retention sweeps (no scheduler on this project). Auto-approved staging rows are
  -- only needed for a short while (rollback uses poi_changes): 14 days; others 90 days.
  delete from public.poi_staging s where s.id in (
    select x.id from public.poi_staging x join public.poi_import_runs y on y.id = x.run_id
     where x.decision = 'auto_approved' and y.started_at < now() - interval '14 days' limit 20000);
  delete from public.poi_staging s where s.id in (
    select x.id from public.poi_staging x join public.poi_import_runs y on y.id = x.run_id
     where y.started_at < now() - interval '90 days' limit 5000);
  delete from public.poi_changes c where c.id in (select z.id from public.poi_changes z where z.at < now() - interval '2 years' limit 5000);
  return r;
end;
$$;

-- ─── process a run (as in 20261206000000, applied as a set) ─────────────
create or replace function public.poi_process_run(p_run uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.poi_import_runs;
  v_live integer; v_missing integer; v_changing integer;
  v_counts jsonb;
begin
  select * into v_run from public.poi_import_runs where id = p_run for update;
  if v_run.id is null or v_run.status not in ('running', 'held') then raise exception 'Run cannot be processed.' using errcode = '55000'; end if;
  perform public.poi_carry_reviews(p_run);
  select count(*) into v_live from public.pois where region = v_run.region and status = 'active';
  -- would hide: live POIs absent from this run that were already absent from the last one
  select count(*) into v_missing from public.pois p where p.region = v_run.region and p.status = 'active' and p.missing_runs >= 1
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
    'live_before', v_live, 'would_hide', v_missing, 'would_change', v_changing,
    'absent_once', (select count(*) from public.pois p where p.region = v_run.region and p.status = 'active' and p.missing_runs = 0
       and not exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref)));
  if not p_force and v_live >= 20 and (v_missing > v_live * 0.05 or v_changing > v_live * 0.20) then
    update public.poi_import_runs set status = 'held', counts = v_counts, note = 'Ditahan: larian ini akan menyembunyikan lebih 5% atau mengubah lebih 20% POI aktif.' where id = p_run;
    return v_counts || '{"status":"held"}';
  end if;
  -- Auto-approved rows go live in one statement (a whole state is ~13,000 rows; row by
  -- row would outlast the API's time limit). Same rules as poi_apply_row: an admin's
  -- name / category and an admin's hide are kept, community answers outrank the import.
  -- The region follows the run (Kuala Langat POIs become Selangor's when Selangor runs).
  with src as (
    select x.*, (x.osm_last_edit is not null and x.osm_last_edit < now() - interval '5 years' and not (x.tags ? 'check_date')) as stale
      from public.poi_staging x where x.run_id = p_run and x.decision = 'auto_approved'),
  prior as (
    select p.id, public.poi_snapshot(p) as snap from public.pois p join src on src.osm_ref = p.osm_ref),
  up as (
    insert into public.pois as p (region, osm_ref, osm_version, osm_last_edit, category, subcategory, name, name_norm, brand, branch, lat, lng,
      address, phone, website, opening_hours, settlement_class, osm_place_tag, nearest_place, coastal, quality, verification, status, first_run, last_seen_run)
    select v_run.region, s.osm_ref, s.osm_version, s.osm_last_edit, s.category, s.subcategory, s.name, public.normalize_search(s.name), s.brand, s.branch, s.lat, s.lng,
      s.address, s.phone, s.website, s.opening_hours, s.settlement_class, s.osm_place_tag, s.nearest_place, s.coastal,
      greatest(0, s.quality - case when s.stale then 10 else 0 end), case when s.stale then 'perlu_pengesahan' else 'belum' end, 'active', p_run, p_run
      from src s
    on conflict (osm_ref) do update set
      region = excluded.region,
      osm_version = excluded.osm_version, osm_last_edit = excluded.osm_last_edit,
      category = case when p.admin_override then p.category else excluded.category end,
      subcategory = excluded.subcategory,
      name = case when p.admin_override then p.name else excluded.name end,
      name_norm = case when p.admin_override then p.name_norm else excluded.name_norm end,
      brand = excluded.brand, branch = excluded.branch, lat = excluded.lat, lng = excluded.lng,
      address = excluded.address, phone = excluded.phone, website = excluded.website, opening_hours = excluded.opening_hours,
      settlement_class = excluded.settlement_class, osm_place_tag = excluded.osm_place_tag, nearest_place = excluded.nearest_place,
      coastal = excluded.coastal, quality = excluded.quality,
      verification = case when p.verification in ('disahkan_komuniti', 'dilapor_tutup') then p.verification else excluded.verification end,
      status = case when p.hidden_by_admin then 'hidden' else 'active' end,
      last_seen_run = excluded.last_seen_run, updated_at = now()
    returning p.*)
  insert into public.poi_changes (run_id, poi_id, action, before, after)
  select p_run, u.id, case when b.id is null then 'insert' else 'update' end, b.snap, to_jsonb(u) - 'updated_at'
    from up u left join prior b on b.id = u.id
   where b.id is null
      or (b.snap - 'last_seen_run' - 'missing_runs') is distinct from ((to_jsonb(u) - 'updated_at') - 'last_seen_run' - 'missing_runs');
  -- in this run again: the count starts over
  update public.pois p set missing_runs = 0
   where p.region = v_run.region and p.missing_runs > 0
     and exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref);
  -- absent: counted; hidden as 'missing' only when absent from 2 runs in a row
  update public.pois p set missing_runs = least(p.missing_runs + 1, 100)
   where p.region = v_run.region and p.status = 'active'
     and not exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref);
  with gone as (
    update public.pois p set status = 'missing', updated_at = now()
     where p.region = v_run.region and p.status = 'active' and p.missing_runs >= 2
       and not exists (select 1 from public.poi_staging x where x.run_id = p_run and x.osm_ref = p.osm_ref)
    returning p.*)
  insert into public.poi_changes (run_id, poi_id, action, before, after)
  select p_run, g.id, 'missing', (public.poi_snapshot(g) - 'missing_runs') || '{"status":"active"}', public.poi_snapshot(g) - 'missing_runs' from gone g;
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

create or replace function public.search_pois(
  p_q text default null,
  p_category text default null,
  p_word text default null,
  p_place text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit integer default 8
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  q text := public.normalize_search(left(coalesce(p_q, ''), 80));
  w text := public.normalize_search(left(coalesce(p_word, ''), 40));
  pl text := public.normalize_search(left(coalesce(p_place, ''), 60));
  lim integer := greatest(1, least(coalesce(p_limit, 8), 20));
  has_near boolean := p_lat is not null and p_lng is not null and p_lat between 0.5 and 7.6 and p_lng between 99.4 and 119.5;
begin
  if p_category is not null and p_category not in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah') then
    return '[]'::jsonb;
  end if;
  if p_category is null and char_length(q) < 2 then return '[]'::jsonb; end if;
  -- LIKE wildcards in the text are taken literally
  q := replace(replace(q, '%', ''), '_', '');
  w := replace(replace(w, '%', ''), '_', '');
  pl := replace(replace(pl, '%', ''), '_', '');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'category', r.category, 'subcategory', r.subcategory,
        'lat', r.lat, 'lng', r.lng, 'address', r.address, 'nearest_place', r.nearest_place,
        'distance_m', r.dist, 'verification', r.verification) order by r.rank_order)
    from (
      select p.*, d.dist,
             row_number() over (order by
               case when p_category is null then (p.name_norm = q)::int * 2 + (p.name_norm like q || '%')::int else 0 end desc,
               case when p_category is null then extensions.similarity(p.name_norm, q) else 0 end desc,
               d.dist nulls last,
               p.quality desc,
               p.name) as rank_order
        from public.pois p
        cross join lateral (select case when has_near
          then round(111320 * sqrt(power(p.lat - p_lat, 2) + power((p.lng - p_lng) * cos(radians(p_lat)), 2)))::integer end as dist) d
       where p.status = 'active' and p.verification <> 'dilapor_tutup'
         and (
           (p_category is null and (p.name_norm like '%' || q || '%' or extensions.similarity(p.name_norm, q) >= 0.4))
           or
           (p_category is not null and p.category = p_category
             and (w = '' or p.name_norm like '%' || w || '%')
             and (pl = '' or lower(coalesce(p.nearest_place, '')) like '%' || pl || '%' or p.name_norm like '%' || pl || '%'))
         )
       order by rank_order
       limit lim
    ) r), '[]'::jsonb);
end;
$$;

create or replace function public.nearby_unverified_pois(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or p_lat is null or p_lng is null or p_lat not between 0.5 and 7.6 or p_lng not between 99.4 and 119.5 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'category', x.category, 'lat', x.lat, 'lng', x.lng, 'distance_m', x.dist) order by x.dist)
      from (
        select p.id, p.name, p.category, p.lat, p.lng,
               round(111320 * sqrt(power(p.lat - p_lat, 2) + power((p.lng - p_lng) * cos(radians(p_lat)), 2)))::integer as dist
          from public.pois p
         where p.status = 'active' and p.verification in ('belum', 'perlu_pengesahan')
           and p.lat between p_lat - 0.005 and p_lat + 0.005 and p.lng between p_lng - 0.005 and p_lng + 0.005
           and not exists (select 1 from public.poi_feedback f where f.poi_id = p.id and f.user_id = uid)
         order by 6
         limit 3
      ) x
     where x.dist <= 500), '[]'::jsonb);
end;
$$;

revoke execute on function public.poi_start_run(text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.poi_process_run(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.search_pois(text, text, text, text, double precision, double precision, integer) from public, anon, authenticated;
revoke execute on function public.nearby_unverified_pois(double precision, double precision) from public, anon;
grant execute on function public.nearby_unverified_pois(double precision, double precision) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.poi_start_run(text, text, text, timestamptz) to service_role;
    grant execute on function public.poi_process_run(uuid, boolean) to service_role;
    grant execute on function public.search_pois(text, text, text, text, double precision, double precision, integer) to service_role;
  end if;
end $$;
