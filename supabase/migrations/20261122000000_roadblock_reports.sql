-- New community report type:
--   roadblock — police roadblock (sekatan jalan raya, SJR). Short-lived like
--   police reports: the default 2 hours from report_default_ttl applies.
-- Widening the CHECK constraint needs drop + add; nothing else is dropped.
alter table public.traffic_reports drop constraint traffic_reports_report_type_check;
alter table public.traffic_reports add constraint traffic_reports_report_type_check check (report_type in (
  'accident', 'congestion', 'road_closure', 'hazard', 'flood', 'breakdown', 'construction', 'police', 'roadblock', 'speed_camera'));
