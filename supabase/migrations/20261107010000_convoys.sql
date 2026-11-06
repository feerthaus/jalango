-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — Konvoi (group travel): members see each other live on one map
-- Members-only visibility, latest position only, ends after 12 h.
-- ════════════════════════════════════════════════════════════════════════

create table public.convoys (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  leader_id         uuid not null references public.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 60),
  destination_name  text check (destination_name is null or char_length(destination_name) <= 160),
  dest_latitude     double precision,
  dest_longitude    double precision,
  meet_name         text check (meet_name is null or char_length(meet_name) <= 160),
  meet_latitude     double precision,
  meet_longitude    double precision,
  expires_at        timestamptz not null default now() + interval '12 hours',
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);
create index convoys_leader_idx on public.convoys (leader_id, created_at desc);

create table public.convoy_members (
  convoy_id     uuid not null references public.convoys (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  color         text not null check (color ~ '^#[0-9a-f]{6}$'),
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  latitude      double precision,
  longitude     double precision,
  heading       real check (heading is null or heading between 0 and 360),
  speed_mps     real check (speed_mps is null or speed_mps between 0 and 90),
  accuracy_m    real,
  position_at   timestamptz,
  eta_at        timestamptz,
  arrived_at    timestamptz,
  removed       boolean not null default false,
  primary key (convoy_id, user_id)
);
create index convoy_members_user_idx on public.convoy_members (user_id, joined_at desc);

-- helpers --------------------------------------------------------------
create or replace function public.is_convoy_member(p_convoy uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.convoy_members m join public.convoys c on c.id = m.convoy_id
    where m.convoy_id = p_convoy and m.user_id = (select auth.uid()) and m.left_at is null
  )
$$;
revoke execute on function public.is_convoy_member(uuid) from public, anon;
grant execute on function public.is_convoy_member(uuid) to authenticated;

create or replace function public.convoy_color(p_index integer)
returns text language sql immutable set search_path = ''
as $$
  select (array['#14c493','#3b82f6','#f97316','#a855f7','#ef4444','#eab308','#06b6d4','#ec4899','#84cc16','#64748b'])[1 + (p_index % 10)]
$$;

-- create: leader becomes the first member ------------------------------
create or replace function public.create_convoy(p_code text, p_name text, p_display_name text,
  p_dest_name text default null, p_dest_lat double precision default null, p_dest_lng double precision default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_uid uuid := (select auth.uid()); active integer;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Your account is suspended (banned).' using errcode = '42501'; end if;
  select count(*) into active from public.convoys where leader_id = v_uid and ended_at is null and expires_at > now();
  if active >= 2 then raise exception 'You already lead 2 convoys. End one first.' using errcode = 'P0001', hint = 'rate_limited'; end if;
  insert into public.convoys (code, leader_id, name, destination_name, dest_latitude, dest_longitude)
  values (upper(p_code), v_uid, trim(p_name), p_dest_name, p_dest_lat, p_dest_lng)
  returning id into v_id;
  insert into public.convoy_members (convoy_id, user_id, display_name, color)
  values (v_id, v_uid, trim(p_display_name), public.convoy_color(0));
  return v_id;
end;
$$;

-- join by code (max 10 active members) ---------------------------------
create or replace function public.join_convoy(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare c public.convoys%rowtype; v_uid uuid := (select auth.uid()); n integer;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'Your account is suspended (banned).' using errcode = '42501'; end if;
  select * into c from public.convoys where code = upper(replace(p_code, '-', ''));
  if not found or c.ended_at is not null or c.expires_at <= now() then
    raise exception 'Convoy not found or already ended.' using errcode = 'P0001', hint = 'inactive';
  end if;
  if exists (select 1 from public.convoy_members where convoy_id = c.id and user_id = v_uid and removed) then
    raise exception 'You were removed from this convoy.' using errcode = '42501';
  end if;
  select count(*) into n from public.convoy_members where convoy_id = c.id and left_at is null;
  if n >= 10 and not exists (select 1 from public.convoy_members where convoy_id = c.id and user_id = v_uid and left_at is null) then
    raise exception 'This convoy is full (10 cars).' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.convoy_members (convoy_id, user_id, display_name, color)
  values (c.id, v_uid, trim(p_display_name), public.convoy_color(n))
  on conflict (convoy_id, user_id) do update
    set left_at = null, display_name = excluded.display_name, joined_at = now();
  return c.id;
end;
$$;

-- leader actions ---------------------------------------------------------
create or replace function public.convoy_leader_update(p_convoy uuid, p_field text,
  p_name text default null, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.convoys where id = p_convoy and leader_id = (select auth.uid()) and ended_at is null) then
    raise exception 'Only the convoy leader can do this.' using errcode = '42501';
  end if;
  if p_field = 'destination' then
    update public.convoys set destination_name = left(p_name, 160), dest_latitude = p_lat, dest_longitude = p_lng where id = p_convoy;
    update public.convoy_members set arrived_at = null where convoy_id = p_convoy;
  elsif p_field = 'meet' then
    update public.convoys set meet_name = left(p_name, 160), meet_latitude = p_lat, meet_longitude = p_lng where id = p_convoy;
  elsif p_field = 'end' then
    update public.convoys set ended_at = now() where id = p_convoy;
    update public.convoy_members set latitude = null, longitude = null, heading = null, speed_mps = null where convoy_id = p_convoy;
  else
    raise exception 'Unknown action.';
  end if;
end;
$$;

create or replace function public.convoy_remove_member(p_convoy uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.convoys where id = p_convoy and leader_id = (select auth.uid())) then
    raise exception 'Only the convoy leader can do this.' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then raise exception 'Leaders end the convoy instead.'; end if;
  update public.convoy_members
  set left_at = now(), removed = true
  where convoy_id = p_convoy and user_id = p_user;
end;
$$;

-- members may only update their own position / arrival / leave ------------
-- SECURITY INVOKER on purpose: current_user must be the caller's role.
create or replace function public.before_convoy_member_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- Direct updates by members (role "authenticated") may only touch their own
  -- position / ETA / arrival and leave. Rejoining and removal go through the
  -- SECURITY DEFINER functions above (which run as the function owner).
  if current_user in ('authenticated', 'anon') then
    new.convoy_id := old.convoy_id;
    new.user_id := old.user_id;
    new.color := old.color;
    new.joined_at := old.joined_at;
    new.removed := old.removed;
    new.display_name := old.display_name;
    if old.left_at is not null then
      raise exception 'You are no longer in this convoy.' using errcode = 'P0001', hint = 'inactive';
    end if;
    if exists (select 1 from public.convoys where id = old.convoy_id and (ended_at is not null or expires_at <= now())) then
      raise exception 'This convoy has ended.' using errcode = 'P0001', hint = 'inactive';
    end if;
  end if;
  if new.left_at is not null then
    new.latitude := null; new.longitude := null; new.heading := null; new.speed_mps := null; new.accuracy_m := null;
  end if;
  return new;
end;
$$;
create trigger convoy_members_before_update before update on public.convoy_members
  for each row execute function public.before_convoy_member_update();

alter table public.convoys enable row level security;
alter table public.convoy_members enable row level security;

create policy "convoys: members read" on public.convoys for select to authenticated using (public.is_convoy_member(id) or leader_id = (select auth.uid()));
create policy "convoy members: members read" on public.convoy_members for select to authenticated using (public.is_convoy_member(convoy_id) or user_id = (select auth.uid()));
create policy "convoy members: update own row" on public.convoy_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.convoys from anon, authenticated;
revoke insert, delete on public.convoy_members from anon, authenticated;

revoke execute on function public.create_convoy(text, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.join_convoy(text, text) from public, anon;
revoke execute on function public.convoy_leader_update(uuid, text, text, double precision, double precision) from public, anon;
revoke execute on function public.convoy_remove_member(uuid, uuid) from public, anon;
grant execute on function public.create_convoy(text, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.join_convoy(text, text) to authenticated;
grant execute on function public.convoy_leader_update(uuid, text, text, double precision, double precision) to authenticated;
grant execute on function public.convoy_remove_member(uuid, uuid) to authenticated;
revoke execute on function public.before_convoy_member_update() from public, anon, authenticated;

-- live updates for members
alter table public.convoy_members replica identity full;
alter publication supabase_realtime add table public.convoy_members;
alter publication supabase_realtime add table public.convoys;
