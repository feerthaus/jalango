-- Accident records: a lasting history of crashes at a spot ("Simpang Taman Seri Dagang:
-- 6 kemalangan sejak Jul 2026"), shown on the map and announced to drivers approaching
-- a black spot. Records come from users (incl. past crashes up to 2 years back) or from
-- a live accident report once another driver confirms it.
-- Photos are optional and only shown after an admin approves them (they may show
-- victims, faces or plates). Never seeded with fabricated incidents.

create table public.accident_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  latitude      double precision not null,
  longitude     double precision not null,
  occurred_on   date not null,
  time_of_day   text check (time_of_day is null or time_of_day in ('day', 'night')),
  vehicles      text[] not null default '{}'
                  check (vehicles <@ array['motorcycle', 'car', 'lorry', 'bus', 'van', 'bicycle', 'pedestrian', 'other']::text[]
                         and cardinality(vehicles) <= 4),
  outcome       text not null default 'unknown' check (outcome in ('no_injury', 'injured', 'fatal', 'unknown')),
  note          text check (note is null or char_length(note) <= 280),
  source        text not null default 'user' check (source in ('user', 'live_report')),
  report_id     uuid unique references public.traffic_reports (id) on delete set null,
  photo_path    text check (photo_path is null or char_length(photo_path) <= 200),
  photo_status  text not null default 'none' check (photo_status in ('none', 'pending', 'approved', 'rejected')),
  upvotes       integer not null default 0 check (upvotes >= 0),
  downvotes     integer not null default 0 check (downvotes >= 0),
  status        text not null default 'active' check (status in ('active', 'removed')),
  created_at    timestamptz not null default now(),
  constraint accident_records_in_malaysia check (latitude between 0.5 and 7.6 and longitude between 99.4 and 119.5)
);
comment on table public.accident_records is 'User-recorded crashes (history). Never seeded with fabricated incidents.';
create index accident_records_geo_idx on public.accident_records (latitude, longitude) where status = 'active';
create index accident_records_user_idx on public.accident_records (user_id, created_at desc);
create index accident_records_photo_queue_idx on public.accident_records (created_at) where photo_status = 'pending';

create or replace function public.before_accident_record_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  internal boolean := coalesce(current_setting('jalango.internal', true), '') = '1';
  recent integer;
begin
  if not internal then
    if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    new.source := 'user';
    new.report_id := null;
    select count(*) into recent from public.accident_records
    where user_id = new.user_id and created_at > now() - interval '24 hours';
    if recent >= 10 then
      raise exception 'You can add up to 10 accident records a day.' using errcode = 'P0001', hint = 'rate_limited';
    end if;
  end if;
  if new.occurred_on > (now() at time zone 'Asia/Kuala_Lumpur')::date or new.occurred_on < (now() at time zone 'Asia/Kuala_Lumpur')::date - 730 then
    raise exception 'The date must be within the last 2 years.' using errcode = 'P0001', hint = 'invalid';
  end if;
  -- Photos live in the user's own folder of the private bucket and wait for review
  if new.photo_path is not null then
    if split_part(new.photo_path, '/', 1) <> new.user_id::text then
      raise exception 'Invalid photo.' using errcode = '42501';
    end if;
    new.photo_status := 'pending';
  else
    new.photo_status := 'none';
  end if;
  new.status := 'active';
  new.upvotes := 0;
  new.downvotes := 0;
  new.created_at := now();
  new.note := nullif(trim(regexp_replace(coalesce(new.note, ''), '\s+', ' ', 'g')), '');
  select coalesce(array_agg(distinct v), '{}') into new.vehicles from unnest(new.vehicles) v;
  return new;
end;
$$;
create trigger accident_records_before_insert
  before insert on public.accident_records
  for each row execute function public.before_accident_record_insert();

alter table public.accident_records enable row level security;
create policy "accident records: public read" on public.accident_records for select to anon, authenticated using (status = 'active');
create policy "accident records: admins read all" on public.accident_records for select to authenticated using (public.is_admin());
create policy "accident records: add your own" on public.accident_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accident records: owners delete their own" on public.accident_records for delete to authenticated using ((select auth.uid()) = user_id);
create policy "accident records: no posting while banned" on public.accident_records as restrictive for insert to authenticated with check (not public.is_banned());
revoke update on public.accident_records from anon, authenticated;

-- ─── "Betul" / "Tak betul" votes ─────────────────────────────────────────
create table public.accident_record_votes (
  record_id   uuid not null references public.accident_records (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  vote        smallint not null check (vote in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (record_id, user_id)
);

create or replace function public.before_accident_record_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if exists (select 1 from public.accident_records r where r.id = new.record_id and r.user_id = new.user_id) then
    raise exception 'You cannot vote on your own record.' using errcode = 'P0001', hint = 'own_report';
  end if;
  return new;
end;
$$;
create trigger accident_record_votes_before
  before insert or update on public.accident_record_votes
  for each row execute function public.before_accident_record_vote();

create or replace function public.after_accident_record_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.record_id, old.record_id);
  v_up integer;
  v_down integer;
begin
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1)
  into v_up, v_down
  from public.accident_record_votes where record_id = v_id;
  update public.accident_records
  set upvotes = v_up,
      downvotes = v_down,
      status = case when v_down >= 5 and v_down > v_up * 2 then 'removed' else status end
  where id = v_id;
  return null;
end;
$$;
create trigger accident_record_votes_after
  after insert or update or delete on public.accident_record_votes
  for each row execute function public.after_accident_record_vote();

alter table public.accident_record_votes enable row level security;
create policy "accident votes: read own" on public.accident_record_votes for select to authenticated using ((select auth.uid()) = user_id);
create policy "accident votes: vote as yourself" on public.accident_record_votes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accident votes: change own vote" on public.accident_record_votes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accident votes: remove own vote" on public.accident_record_votes for delete to authenticated using ((select auth.uid()) = user_id);
create policy "accident votes: no voting while banned" on public.accident_record_votes as restrictive for insert to authenticated with check (not public.is_banned());

-- ─── A live accident report becomes a record once someone else confirms it ──
create or replace function public.accident_record_from_report()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.report_type = 'accident' and new.status = 'active' and old.confirm_count = 0 and new.confirm_count >= 1 then
    perform set_config('jalango.internal', '1', true);
    insert into public.accident_records (user_id, latitude, longitude, occurred_on, time_of_day, note, source, report_id)
    values (
      new.user_id, new.latitude, new.longitude,
      (new.created_at at time zone 'Asia/Kuala_Lumpur')::date,
      case when extract(hour from new.created_at at time zone 'Asia/Kuala_Lumpur') between 7 and 18 then 'day' else 'night' end,
      new.description, 'live_report', new.id
    )
    on conflict (report_id) do nothing;
    perform set_config('jalango.internal', '', true);
  end if;
  return null;
end;
$$;
create trigger traffic_reports_accident_record
  after update of confirm_count on public.traffic_reports
  for each row execute function public.accident_record_from_report();

-- ─── Admin photo review ──────────────────────────────────────────────────
create or replace function public.review_accident_photo(p_record uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.accident_records
  set photo_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_record and photo_path is not null;
end;
$$;
revoke execute on function public.review_accident_photo(uuid, boolean) from public, anon;
grant execute on function public.review_accident_photo(uuid, boolean) to authenticated;

revoke execute on function public.before_accident_record_insert() from public, anon, authenticated;
revoke execute on function public.before_accident_record_vote() from public, anon, authenticated;
revoke execute on function public.after_accident_record_vote() from public, anon, authenticated;
revoke execute on function public.accident_record_from_report() from public, anon, authenticated;

-- ─── Photo storage: private bucket, readable only once approved ──────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accident-photos', 'accident-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "accident photos: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'accident-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_banned());
create policy "accident photos: owners delete" on storage.objects for delete to authenticated
  using (bucket_id = 'accident-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "accident photos: approved are public (anon)" on storage.objects for select to anon
  using (bucket_id = 'accident-photos' and exists (
    select 1 from public.accident_records r where r.photo_path = name and r.photo_status = 'approved' and r.status = 'active'));
create policy "accident photos: approved, own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'accident-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
    or exists (select 1 from public.accident_records r where r.photo_path = name and r.photo_status = 'approved' and r.status = 'active')));
