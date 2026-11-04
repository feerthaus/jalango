-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — anonymous traffic probe data (opt-in)
-- Drivers who agree contribute GPS speed samples while navigating.
-- No user id is stored; samples are grouped by a random per-trip id.
-- Written only by the API server (service role); never readable by clients.
-- ════════════════════════════════════════════════════════════════════════

create table public.probe_samples (
  id           bigint generated always as identity primary key,
  session_id   uuid not null,
  recorded_at  timestamptz not null,
  latitude     double precision not null check (latitude between 0.5 and 7.6),
  longitude    double precision not null check (longitude between 99.4 and 119.5),
  speed_mps    real check (speed_mps is null or speed_mps between 0 and 70),
  heading      real check (heading is null or heading between 0 and 360),
  accuracy_m   real not null check (accuracy_m between 0 and 100),
  created_at   timestamptz not null default now()
);

comment on table public.probe_samples is
  'Anonymous opt-in GPS samples for building JalanGo''s own traffic layer. Raw rows are purged after 30 days.';

create index probe_samples_recorded_idx on public.probe_samples (recorded_at);
create index probe_samples_geo_idx on public.probe_samples (latitude, longitude);
create index probe_samples_session_idx on public.probe_samples (session_id, recorded_at);

-- RLS on with no policies: anon/authenticated get nothing; the service role bypasses RLS.
alter table public.probe_samples enable row level security;
revoke all on public.probe_samples from anon, authenticated;

-- Retention: raw samples are deleted after 30 days (aggregates will be kept separately).
create or replace function public.purge_old_probe_samples()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.probe_samples
    where recorded_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.purge_old_probe_samples() from public, anon, authenticated;

-- With pg_cron enabled:
--   select cron.schedule('jalango-purge-probes', '17 3 * * *', 'select public.purge_old_probe_samples()');
