-- New community report types:
--   police        — speed trap / police check (moves often: 2 h, like other short-lived reports)
--   speed_camera  — fixed AES/AWAS camera not yet on the map (90 days, confirmations keep it alive)
alter table public.traffic_reports drop constraint traffic_reports_report_type_check;
alter table public.traffic_reports add constraint traffic_reports_report_type_check check (report_type in (
  'accident', 'congestion', 'road_closure', 'hazard', 'flood', 'breakdown', 'construction', 'police', 'speed_camera'));

create or replace function public.report_default_ttl(p_type text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'speed_camera' then interval '90 days'
    when 'construction' then interval '7 days'
    when 'road_closure' then interval '24 hours'
    when 'flood'        then interval '12 hours'
    when 'congestion'   then interval '1 hour'
    else interval '2 hours'
  end;
$$;
