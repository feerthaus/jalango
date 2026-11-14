-- Marketplace: restaurants, warung and stalls ("food").
-- Owner's decisions (14 Nov 2026): directory + WhatsApp; IC + premises photo are
-- required (SSM, PBT licence, food handler and JAKIM halal certificate optional);
-- "Halal JAKIM" shows only after an admin checks the certificate, otherwise the
-- owner may say "Pemilik Muslim" or "Tiada daging babi", never the word halal.
-- Widening three CHECK constraints needs drop + add; nothing else is dropped.

alter table public.operators drop constraint if exists operators_kind_check;
alter table public.operators add constraint operators_kind_check check (kind in ('homestay', 'car_rental', 'food'));

alter table public.listings drop constraint if exists listings_kind_check;
alter table public.listings add constraint listings_kind_check check (kind in ('homestay', 'car_rental', 'food'));

alter table public.operator_documents drop constraint if exists operator_documents_kind_check;
alter table public.operator_documents add constraint operator_documents_kind_check
  check (kind in ('ic', 'ownership', 'ssm', 'apad_licence', 'insurance', 'other', 'premises', 'pbt_licence', 'food_handler', 'halal_jakim'));

-- Set only by an admin after checking the JAKIM certificate
alter table public.operators add column if not exists halal_verified_at timestamptz;

-- Owner edits keep halal_verified_at as the admin left it (same rules as before otherwise)
create or replace function public.before_operator_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  internal boolean := coalesce(current_setting('jalango.internal', true), '') = '1';
begin
  if not internal then
    if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if old.status = 'suspended' then
        raise exception 'This business is suspended. Contact JalanGo.' using errcode = 'P0001', hint = 'suspended';
      end if;
      if new.user_id is distinct from old.user_id then
        raise exception 'Not allowed.' using errcode = '42501';
      end if;
      new.created_at := old.created_at;
      new.approved_at := old.approved_at;
      new.free_until := old.free_until;
      new.halal_verified_at := old.halal_verified_at;
    else
      new.created_at := now();
      new.approved_at := null;
      new.free_until := null;
      new.halal_verified_at := null;
    end if;
    new.status := 'pending';
    new.reviewed_at := case when tg_op = 'UPDATE' then old.reviewed_at else null end;
    new.review_note := case when tg_op = 'UPDATE' then old.review_note else null end;
    if new.licence_disclaimer_at is not null then
      new.licence_disclaimer_at := case when tg_op = 'UPDATE' and old.licence_disclaimer_at is not null then old.licence_disclaimer_at else now() end;
    end if;
  end if;
  new.business_name := trim(regexp_replace(new.business_name, '\s+', ' ', 'g'));
  new.town := trim(new.town);
  new.description := nullif(trim(coalesce(new.description, '')), '');
  new.apad_licence_no := nullif(trim(coalesce(new.apad_licence_no, '')), '');
  if new.kind = 'car_rental' and new.status in ('pending', 'approved') then
    if new.ssm_no is null then
      raise exception 'Car rental needs an SSM number.' using errcode = 'P0001', hint = 'invalid';
    end if;
    if new.insurance_expires_on is not null and new.insurance_expires_on <= current_date then
      raise exception 'The insurance must still be valid.' using errcode = 'P0001', hint = 'invalid';
    end if;
    if new.apad_licence_no is not null then
      if new.apad_expires_on is null or new.apad_expires_on <= current_date then
        raise exception 'The APAD licence must still be valid.' using errcode = 'P0001', hint = 'invalid';
      end if;
    else
      new.apad_expires_on := null;
    end if;
    if new.apad_licence_no is not null and new.insurance_expires_on is not null then
      new.licence_disclaimer_at := null;
    elsif new.licence_disclaimer_at is null then
      raise exception 'Without an APAD licence or insurance, please accept the disclaimer.' using errcode = 'P0001', hint = 'invalid';
    end if;
  elsif new.kind <> 'car_rental' then
    new.apad_licence_no := null;
    new.apad_expires_on := null;
    new.licence_disclaimer_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.before_operator_write() from public, anon, authenticated;

-- Admin: mark the JAKIM halal certificate as checked (or withdraw it)
create or replace function public.admin_set_halal(p_operator uuid, p_verified boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_verified and not exists (select 1 from public.operator_documents d where d.operator_id = p_operator and d.kind = 'halal_jakim') then
    raise exception 'No JAKIM halal certificate uploaded.' using errcode = 'P0001', hint = 'invalid';
  end if;
  perform set_config('jalango.internal', '1', true);
  update public.operators set halal_verified_at = case when p_verified then now() else null end where id = p_operator and kind = 'food';
  perform set_config('jalango.internal', '', true);
  if not found then raise exception 'Food business not found.' using errcode = 'P0001'; end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), case when p_verified then 'halal_verified' else 'halal_withdrawn' end, 'operator', p_operator, nullif(trim(coalesce(p_note, '')), ''));
end;
$$;
revoke execute on function public.admin_set_halal(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_halal(uuid, boolean, text) to authenticated;

-- Food listing details: food type, menu (max 25 items), opening hours, halal claim
create or replace function public.check_food_listing()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  d jsonb := new.details;
begin
  if new.kind <> 'food' or coalesce(current_setting('jalango.internal', true), '') = '1' then return new; end if;
  if d ? 'food_type' and d->>'food_type' not in ('restoran', 'warung', 'gerai', 'kafe', 'food_truck') then
    raise exception 'Unknown food business type.' using errcode = 'P0001', hint = 'invalid';
  end if;
  if d ? 'halal' and jsonb_typeof(d->'halal') <> 'null' and d->>'halal' not in ('jakim', 'muslim_owner', 'no_pork') then
    raise exception 'Unknown halal choice.' using errcode = 'P0001', hint = 'invalid';
  end if;
  if d ? 'menu' and (jsonb_typeof(d->'menu') <> 'array' or jsonb_array_length(d->'menu') > 25) then
    raise exception 'The menu can have up to 25 items.' using errcode = 'P0001', hint = 'invalid';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_food_listing() from public, anon, authenticated;
create trigger listings_check_food
  before insert or update on public.listings
  for each row execute function public.check_food_listing();

-- Up to 12 photos for food (menu boards, dishes, premises), like homestays
create or replace function public.before_listing_photo_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  l public.listings;
  n integer;
begin
  if coalesce(current_setting('jalango.internal', true), '') = '1' then return new; end if;
  select * into l from public.listings where id = new.listing_id;
  if (select auth.uid()) is null or l.id is null or l.user_id <> (select auth.uid()) or new.user_id <> l.user_id
     or split_part(new.path, '/', 1) <> new.user_id::text then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.listing_photos where listing_id = new.listing_id;
    if n >= (case when l.kind in ('homestay', 'food') then 12 else 8 end) then
      raise exception 'Too many photos for this listing.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.status := 'pending';
    new.created_at := now();
  else
    if new.path <> old.path or new.listing_id <> old.listing_id then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    new.status := old.status;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke execute on function public.before_listing_photo_write() from public, anon, authenticated;

-- Public operator info, now with halal_verified (v2: the return type changed)
create or replace function public.listing_operators_v2(p_ids uuid[])
returns table (
  id uuid, kind text, business_name text, state text, town text, phone text, description text,
  ssm_verified boolean, apad_licensed boolean, insured boolean, halal_verified boolean, approved_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.kind, o.business_name, o.state, o.town, o.phone, o.description,
         o.ssm_no is not null,
         o.kind = 'car_rental' and o.apad_licence_no is not null and coalesce(o.apad_expires_on > current_date, false),
         coalesce(o.insurance_expires_on > current_date, false),
         o.kind = 'food' and o.halal_verified_at is not null,
         o.approved_at
  from public.operators o
  where o.id = any (p_ids[1:200]) and o.status = 'approved'
$$;
revoke execute on function public.listing_operators_v2(uuid[]) from public;
grant execute on function public.listing_operators_v2(uuid[]) to anon, authenticated;

-- Admin notification counts: a food business waiting for its halal certificate check counts too
create or replace function public.admin_counts()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then return null; end if;
  select jsonb_build_object(
    'operators', (
      select count(*) from public.operators o
      where o.status = 'pending'
         or (o.kind = 'food' and o.halal_verified_at is null and exists (
               select 1 from public.operator_documents d where d.operator_id = o.id and d.kind = 'halal_jakim'))
    ),
    'listings', (
      select count(*) from public.listings l
      where l.status = 'pending'
         or (l.status in ('live', 'paused') and exists (
               select 1 from public.listing_photos p where p.listing_id = l.id and p.status = 'pending'))
    ),
    'flags', (select count(*) from (select distinct content_type, content_id from public.content_flags where status = 'open') f),
    'photos', (select count(*) from public.accident_records where photo_status = 'pending'),
    'feedback', (select count(*) from public.feedback where status = 'new')
  ) into result;
  return result || jsonb_build_object('total',
    (result->>'operators')::int + (result->>'listings')::int + (result->>'flags')::int + (result->>'photos')::int + (result->>'feedback')::int);
end;
$$;
revoke execute on function public.admin_counts() from public, anon;
grant execute on function public.admin_counts() to authenticated;
