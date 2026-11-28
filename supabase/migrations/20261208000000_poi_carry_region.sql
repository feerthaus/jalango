-- POI: a POI an admin approved follows the region of the run that sees it again.
--
-- After the Selangor import (28 Nov 2026), 22 POIs approved during the Kuala Langat
-- review kept region 'kuala-langat': carried decisions updated last_seen_run but not
-- the region, so the two-run "missing" rule would never have watched them. Those 22
-- were fixed by hand the same day (logged in poi_changes); this stops it happening
-- again when a new region covers an old one.
--
-- Additive: poi_carry_reviews replaced with the same signature and grants.

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
  -- approved earlier and still in OpenStreetMap: seen in this run, and part of its region
  -- (a POI approved in Kuala Langat becomes Selangor's when Selangor runs)
  update public.pois p set last_seen_run = p_run, region = (select r.region from public.poi_import_runs r where r.id = p_run)
    from public.poi_staging x where x.run_id = p_run and x.decision = 'approved' and x.osm_ref = p.osm_ref;
  return n;
end;
$$;

revoke execute on function public.poi_carry_reviews(uuid) from public, anon, authenticated;
