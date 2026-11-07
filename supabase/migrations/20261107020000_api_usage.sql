-- Daily counters of paid upstream calls (Mapbox), so the API can stop before a surprise bill.
-- Server-only: RLS on with no policies; only the service role (server) touches it.
create table public.api_usage (
  day   date not null,
  kind  text not null check (kind in ('directions', 'geo')),
  count integer not null default 0,
  primary key (day, kind)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

create or replace function public.bump_api_usage(p_kind text, p_n integer default 1)
returns integer language sql security definer set search_path = ''
as $$
  insert into public.api_usage (day, kind, count)
  values ((now() at time zone 'Asia/Kuala_Lumpur')::date, p_kind, greatest(p_n, 0))
  on conflict (day, kind) do update set count = public.api_usage.count + excluded.count
  returning count
$$;
revoke execute on function public.bump_api_usage(text, integer) from public, anon, authenticated;
