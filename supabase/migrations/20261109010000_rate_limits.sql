-- Distributed rate limiting for the serverless API (shared by every function instance).
-- Keys are HMAC hashes of the client IP + endpoint name, computed on the server: no raw IPs are stored.
-- One row per key: the counter resets itself when a new window starts, so nothing needs deleting.
-- Server-only: RLS on with no policies; only the service role calls hit_rate_limit.
create table public.rate_limits (
  key          text primary key check (char_length(key) <= 128),
  window_start timestamptz not null,
  count        integer not null default 0
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Atomic fixed-window counter: one upsert, so concurrent instances can't lose increments.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer)
returns integer language sql security definer set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1)), 1)
  on conflict (key) do update set
    count = case when r.window_start = excluded.window_start then r.count + 1 else 1 end,
    window_start = excluded.window_start
  returning count
$$;
revoke execute on function public.hit_rate_limit(text, integer) from public, anon, authenticated;
