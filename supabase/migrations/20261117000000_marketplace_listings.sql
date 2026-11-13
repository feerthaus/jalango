-- Marketplace phase 1a: listings (cars / homestay units), photos, availability calendar
-- and admin review. See docs/MARKETPLACE.md §10.
--  * Only approved operators can create listings; at most 10 per operator.
--  * Every new listing and every content change goes to admin review. Pausing and
--    re-publishing unchanged content needs no review (content hash at approval).
--  * Every photo is reviewed before anyone else sees it.

create table public.listings (
  id                    uuid primary key default gen_random_uuid(),
  operator_id           uuid not null references public.operators (id) on delete cascade,
  user_id               uuid not null references public.users (id) on delete cascade,
  kind                  text not null check (kind in ('homestay', 'car_rental')),
  title                 text not null check (char_length(title) between 3 and 80),
  description           text check (description is null or char_length(description) <= 1000),
  price                 numeric(10, 2) not null check (price between 1 and 100000),
  weekend_price         numeric(10, 2) check (weekend_price is null or weekend_price between 1 and 100000),
  deposit               numeric(10, 2) check (deposit is null or deposit between 0 and 100000),
  latitude              double precision not null,
  longitude             double precision not null,
  area_label            text not null check (char_length(area_label) between 2 and 80),
  service_radius_km     integer check (service_radius_km is null or service_radius_km between 1 and 300),
  details               jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4000),
  insurance_expires_on  date,
  status                text not null default 'draft' check (status in ('draft', 'pending', 'live', 'rejected', 'paused')),
  review_note           text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at           timestamptz,
  approved_hash         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint listings_in_malaysia check (latitude between 0.5 and 7.6 and longitude between 99.4 and 119.5)
);
comment on table public.listings is 'Marketplace listings: a rental car or a homestay unit. Live only after admin review.';
create index listings_geo_idx on public.listings (latitude, longitude) where status = 'live';
create index listings_operator_idx on public.listings (operator_id, created_at);
create index listings_review_idx on public.listings (status, updated_at) where status = 'pending';

-- What the admin approved: any change to these fields needs a new review.
create or replace function public.listing_content_hash(l public.listings)
returns text language sql immutable set search_path = ''
as $$
  select md5(concat_ws('|', l.kind, l.title, l.description, l.price, l.weekend_price, l.deposit,
    round(l.latitude::numeric, 6), round(l.longitude::numeric, 6), l.area_label, l.service_radius_km, l.details::text, l.insurance_expires_on))
$$;

create or replace function public.before_listing_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  internal boolean := coalesce(current_setting('jalango.internal', true), '') = '1';
  op public.operators;
  wanted text := new.status;
  n integer;
begin
  if internal then
    new.updated_at := now();
    return new;
  end if;
  if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select * into op from public.operators where id = new.operator_id;
  if op.id is null or op.user_id <> new.user_id then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if op.status <> 'approved' then
    raise exception 'Your business must be approved before adding listings.' using errcode = 'P0001', hint = 'invalid';
  end if;
  if tg_op = 'UPDATE' then
    if new.operator_id <> old.operator_id or new.user_id <> old.user_id then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.approved_hash := old.approved_hash;
  else
    select count(*) into n from public.listings where operator_id = new.operator_id;
    if n >= 10 then
      raise exception 'You can have up to 10 listings.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.created_at := now();
    new.approved_hash := null;
  end if;
  new.kind := op.kind;
  new.title := trim(regexp_replace(new.title, '\s+', ' ', 'g'));
  new.description := nullif(trim(coalesce(new.description, '')), '');
  new.area_label := trim(new.area_label);
  if new.kind = 'car_rental' then
    new.service_radius_km := coalesce(new.service_radius_km, 30);
    if new.insurance_expires_on is not null and new.insurance_expires_on <= current_date then
      raise exception 'The insurance must still be valid.' using errcode = 'P0001', hint = 'invalid';
    end if;
  else
    new.service_radius_km := null;
    new.insurance_expires_on := null;
  end if;
  -- The owner may keep a draft, submit for review, pause, or re-publish unchanged approved content
  if wanted = 'draft' then
    new.status := 'draft';
  elsif wanted = 'paused' and tg_op = 'UPDATE' and old.status in ('live', 'paused') then
    new.status := 'paused';
  elsif wanted = 'live' and new.approved_hash is not null and new.approved_hash = public.listing_content_hash(new) then
    new.status := 'live';
  elsif tg_op = 'UPDATE' and old.status in ('live', 'paused') and new.approved_hash = public.listing_content_hash(new) and wanted = old.status then
    new.status := old.status;
  else
    new.status := 'pending';
  end if;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    new.review_note := null;
  elsif tg_op = 'UPDATE' then
    new.review_note := old.review_note;
  end if;
  new.reviewed_at := case when tg_op = 'UPDATE' then old.reviewed_at else null end;
  new.updated_at := now();
  return new;
end;
$$;
create trigger listings_before_write
  before insert or update on public.listings
  for each row execute function public.before_listing_write();

-- Operators are private; this only answers "is this operator approved?" for the public listing policy.
create or replace function public.operator_is_approved(p_operator uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.operators o where o.id = p_operator and o.status = 'approved') $$;
revoke execute on function public.operator_is_approved(uuid) from public;
grant execute on function public.operator_is_approved(uuid) to anon, authenticated;

alter table public.listings enable row level security;
create policy "listings: public sees live from approved operators" on public.listings for select to anon, authenticated
  using (status = 'live' and public.operator_is_approved(operator_id));
create policy "listings: owners see own" on public.listings for select to authenticated using ((select auth.uid()) = user_id);
create policy "listings: admins see all" on public.listings for select to authenticated using (public.is_admin());
create policy "listings: owners add" on public.listings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "listings: owners edit" on public.listings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "listings: owners delete" on public.listings for delete to authenticated using ((select auth.uid()) = user_id);
create policy "listings: no posting while banned" on public.listings as restrictive for insert to authenticated with check (not public.is_banned());

-- ─── Photos (every one reviewed) ─────────────────────────────────────────
create table public.listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  path        text not null unique check (char_length(path) <= 200),
  position    integer not null default 0 check (position between 0 and 100),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);
create index listing_photos_listing_idx on public.listing_photos (listing_id, position);
create index listing_photos_review_idx on public.listing_photos (created_at) where status = 'pending';

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
    if n >= (case when l.kind = 'homestay' then 12 else 8 end) then
      raise exception 'Too many photos for this listing.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
    new.status := 'pending';
    new.created_at := now();
  else
    -- owners may only reorder
    if new.path <> old.path or new.listing_id <> old.listing_id then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    new.status := old.status;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger listing_photos_before_write
  before insert or update on public.listing_photos
  for each row execute function public.before_listing_photo_write();

alter table public.listing_photos enable row level security;
create policy "listing photos: public sees approved of live listings" on public.listing_photos for select to anon, authenticated
  using (status = 'approved' and exists (select 1 from public.listings l where l.id = listing_id));
create policy "listing photos: owners see own" on public.listing_photos for select to authenticated using ((select auth.uid()) = user_id);
create policy "listing photos: admins see all" on public.listing_photos for select to authenticated using (public.is_admin());
create policy "listing photos: owners add" on public.listing_photos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "listing photos: owners reorder" on public.listing_photos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "listing photos: owners delete" on public.listing_photos for delete to authenticated using ((select auth.uid()) = user_id);

-- ─── Availability: days the owner marks as full ──────────────────────────
create table public.listing_blocks (
  listing_id  uuid not null references public.listings (id) on delete cascade,
  day         date not null,
  primary key (listing_id, day)
);
create or replace function public.before_listing_block_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.listings l where l.id = new.listing_id and l.user_id = (select auth.uid())) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if new.day < (now() at time zone 'Asia/Kuala_Lumpur')::date or new.day > (now() at time zone 'Asia/Kuala_Lumpur')::date + 400 then
    raise exception 'Pick a date within the next year.' using errcode = 'P0001', hint = 'invalid';
  end if;
  return new;
end;
$$;
create trigger listing_blocks_before_insert
  before insert on public.listing_blocks
  for each row execute function public.before_listing_block_insert();

alter table public.listing_blocks enable row level security;
create policy "listing blocks: readable with the listing" on public.listing_blocks for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "listing blocks: owners add" on public.listing_blocks for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = (select auth.uid())));
create policy "listing blocks: owners remove" on public.listing_blocks for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = (select auth.uid())));
revoke update on public.listing_blocks from anon, authenticated;

-- ─── Admin review ────────────────────────────────────────────────────────
-- Approve: listing goes live with its pending photos (unless photos are rejected separately first).
create or replace function public.admin_review_listing(p_listing uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare l public.listings;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if not p_approve and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Please give the operator a reason.' using errcode = 'P0001', hint = 'invalid';
  end if;
  select * into l from public.listings where id = p_listing;
  if l.id is null then raise exception 'Listing not found.' using errcode = 'P0001'; end if;
  if p_approve and not exists (select 1 from public.listing_photos where listing_id = p_listing and status in ('pending', 'approved')) then
    raise exception 'A listing needs at least one photo.' using errcode = 'P0001', hint = 'invalid';
  end if;
  perform set_config('jalango.internal', '1', true);
  update public.listings
  set status = case when p_approve then 'live' else 'rejected' end,
      approved_hash = case when p_approve then public.listing_content_hash(l) else approved_hash end,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now()
  where id = p_listing;
  if p_approve then
    update public.listing_photos set status = 'approved' where listing_id = p_listing and status = 'pending';
  end if;
  perform set_config('jalango.internal', '', true);
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), case when p_approve then 'listing_approved' else 'listing_rejected' end, 'listing', p_listing, nullif(trim(coalesce(p_note, '')), ''));
end;
$$;

create or replace function public.admin_review_listing_photo(p_photo uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  perform set_config('jalango.internal', '1', true);
  update public.listing_photos set status = case when p_approve then 'approved' else 'rejected' end where id = p_photo;
  perform set_config('jalango.internal', '', true);
  insert into public.admin_actions (admin_id, action, target_type, target_id)
  values ((select auth.uid()), case when p_approve then 'listing_photo_approved' else 'listing_photo_rejected' end, 'listing_photo', p_photo);
end;
$$;

revoke execute on function public.admin_review_listing(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_listing(uuid, boolean, text) to authenticated;
revoke execute on function public.admin_review_listing_photo(uuid, boolean) from public, anon;
grant execute on function public.admin_review_listing_photo(uuid, boolean) to authenticated;
revoke execute on function public.before_listing_write() from public, anon, authenticated;
revoke execute on function public.before_listing_photo_write() from public, anon, authenticated;
revoke execute on function public.before_listing_block_insert() from public, anon, authenticated;

-- ─── Photo storage: private bucket, readable once approved ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "listing photos: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_banned());
create policy "listing photos: owners delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "listing photos: approved are public (anon)" on storage.objects for select to anon
  using (bucket_id = 'listing-photos' and exists (
    select 1 from public.listing_photos p where p.path = name and p.status = 'approved'));
create policy "listing photos: approved, own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
    or exists (select 1 from public.listing_photos p where p.path = name and p.status = 'approved')));
