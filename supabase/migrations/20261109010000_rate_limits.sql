-- Distributed rate limiting for the serverless API (shared by every function instance).
-- Keys are HMAC hashes of the client IP + endpoint name, computed on the server: no raw IPs are stored.
-- Server-only: RLS on with no policies; only the service role calls hit_rate_limit.
create table public.rate_limits (
  key          text not null check (char_length(key) <= 128),
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Atomic fixed-window counter: one upsert, so concurrent instances can't lose increments.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1));
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- Housekeeping: about 1 in 200 calls drops windows older than an hour
  if random() < 0.005 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;
  return v_count;
end;
$$;
revoke execute on function public.hit_rate_limit(text, integer) from public, anon, authenticated;
