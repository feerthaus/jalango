-- POI-4: weekly imports, safely.
--
-- A live POI absent from one import is no longer hidden at once: OpenStreetMap
-- extracts can miss objects for a day (an edit in progress, a broken polygon).
-- It is counted (pois.missing_runs) and hidden as 'missing' only when absent from
-- 2 imports in a row; it starts over when it comes back. The hold rule (a run
-- that would hide > 5 % or change > 20 % of live POIs waits for an admin) now
-- counts only the POIs this run would really hide. Run counts add 'absent_once'.
--
-- Additive: one new column with a default; poi_process_run replaced with the same
-- signature and grants. Nothing is dropped.

alter table public.pois add column if not exists missing_runs smallint not null default 0;
comment on column public.pois.missing_runs is 'Imports in a row this POI was absent from; hidden as missing at 2.';

-- ─── process a run ──────────────────────────────────────────────────────
-- As in 20261203000000, plus the two-run rule for missing POIs.
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
  for s in select * from public.poi_staging where run_id = p_run and decision = 'auto_approved' order by osm_ref loop
    perform public.poi_apply_row(s, null, 'insert');
  end loop;
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

revoke execute on function public.poi_process_run(uuid, boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.poi_process_run(uuid, boolean) to service_role;
  end if;
end $$;
