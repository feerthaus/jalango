-- Marketplace phase 1b: the public "Sewa" side.
-- 1) What renters may see about an operator (name, town, WhatsApp, badges), only
--    for approved operators. The operators table itself stays private.
-- 2) Anonymous listing stats (views, WhatsApp/call/directions taps) for owners.
--    Same random device ID as app_activity; one count per device, listing, action and day.

create or replace function public.listing_operators(p_ids uuid[])
returns table (
  id uuid, kind text, business_name text, state text, town text, phone text, description text,
  ssm_verified boolean, apad_licensed boolean, insured boolean, approved_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.kind, o.business_name, o.state, o.town, o.phone, o.description,
         o.ssm_no is not null,
         o.kind = 'car_rental' and o.apad_licence_no is not null and coalesce(o.apad_expires_on > current_date, false),
         coalesce(o.insurance_expires_on > current_date, false),
         o.approved_at
  from public.operators o
  where o.id = any (p_ids[1:200]) and o.status = 'approved'
$$;
revoke execute on function public.listing_operators(uuid[]) from public;
grant execute on function public.listing_operators(uuid[]) to anon, authenticated;

create table if not exists public.listing_events (
  day         date not null,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  action      text not null check (action in ('view', 'whatsapp', 'call', 'directions')),
  device_id   uuid not null,
  primary key (listing_id, day, action, device_id)
);
comment on table public.listing_events is 'Listing views and contact taps. Random device ID only: no account, IP or location.';
alter table public.listing_events enable row level security;
-- No policies: only the functions below read or write it.
revoke all on public.listing_events from anon, authenticated;

create or replace function public.log_listing_event(p_listing uuid, p_action text, p_device uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_action not in ('view', 'whatsapp', 'call', 'directions') or p_device is null then return; end if;
  -- Only live listings from approved operators count
  if not exists (select 1 from public.listings l where l.id = p_listing and l.status = 'live' and public.operator_is_approved(l.operator_id)) then
    return;
  end if;
  insert into public.listing_events (day, listing_id, action, device_id)
  values ((now() at time zone 'Asia/Kuala_Lumpur')::date, p_listing, p_action, p_device)
  on conflict do nothing;
end;
$$;
revoke execute on function public.log_listing_event(uuid, text, uuid) from public;
grant execute on function public.log_listing_event(uuid, text, uuid) to anon, authenticated;

-- Owner's own numbers, last 30 days, per listing.
create or replace function public.my_listing_stats()
returns table (listing_id uuid, views bigint, whatsapp bigint, calls bigint, directions bigint)
language sql stable security definer set search_path = ''
as $$
  select l.id,
         count(*) filter (where e.action = 'view'),
         count(*) filter (where e.action = 'whatsapp'),
         count(*) filter (where e.action = 'call'),
         count(*) filter (where e.action = 'directions')
  from public.listings l
  left join public.listing_events e
    on e.listing_id = l.id and e.day > (now() at time zone 'Asia/Kuala_Lumpur')::date - 30
  where l.user_id = (select auth.uid())
  group by l.id
$$;
revoke execute on function public.my_listing_stats() from public;
grant execute on function public.my_listing_stats() to authenticated;
