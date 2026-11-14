-- Daily counters for paid upstream calls beyond Mapbox (first: Google Places),
-- so each provider has its own ceiling. Additive: api_usage stays as it is.
create table if not exists public.api_usage_extra (
  day   date not null,
  kind  text not null check (kind ~ '^[a-z_]{2,40}$'),
  count integer not null default 0,
  primary key (day, kind)
);
comment on table public.api_usage_extra is 'Daily paid-call counters for providers other than Mapbox (e.g. google_places). Server only.';
alter table public.api_usage_extra enable row level security;
revoke all on public.api_usage_extra from anon, authenticated;

create or replace function public.bump_api_usage_extra(p_kind text, p_n integer default 1)
returns integer language sql security definer set search_path = ''
as $$
  insert into public.api_usage_extra (day, kind, count)
  values ((now() at time zone 'Asia/Kuala_Lumpur')::date, p_kind, greatest(p_n, 0))
  on conflict (day, kind) do update set count = public.api_usage_extra.count + excluded.count
  returning count
$$;
revoke execute on function public.bump_api_usage_extra(text, integer) from public, anon, authenticated;
