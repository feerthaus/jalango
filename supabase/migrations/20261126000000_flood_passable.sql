-- Flood reports: can a car still get through? (owner's request, flood season, Nov 2026)
--   flood_passable  true  = water on the road but cars still pass (slowly)
--                   false = not passable: navigation routes around it
--                   null  = not said (older reports, or any other report type)
-- Additive only: a nullable column and a check; nothing is dropped.
alter table public.traffic_reports add column if not exists flood_passable boolean;
alter table public.traffic_reports add constraint traffic_reports_flood_passable_check
  check (flood_passable is null or report_type = 'flood');
comment on column public.traffic_reports.flood_passable is 'Flood reports only: true = cars can still pass, false = not passable (routes avoid it).';
