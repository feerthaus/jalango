-- ════════════════════════════════════════════════════════════════════════
-- JalanGo — moderation (flags, admins, bans) and in-app feedback
-- ════════════════════════════════════════════════════════════════════════

-- ─── admins & bans ──────────────────────────────────────────────────────
create table public.admins (
  user_id     uuid primary key references public.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "admins: see own row" on public.admins for select to authenticated using ((select auth.uid()) = user_id);

alter table public.users add column banned_at timestamptz;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;

create or replace function public.is_banned()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select banned_at is not null from public.users where id = (select auth.uid())), false) $$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_banned() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_banned() to authenticated;

-- Banned users can't post anything (restrictive = ANDed with existing policies)
create policy "no posting while banned" on public.traffic_reports as restrictive for insert to authenticated with check (not public.is_banned());
create policy "no voting while banned" on public.report_confirmations as restrictive for insert to authenticated with check (not public.is_banned());
create policy "no sharing while banned" on public.shortcuts as restrictive for insert to authenticated with check (not public.is_banned());
create policy "no shortcut votes while banned" on public.shortcut_votes as restrictive for insert to authenticated with check (not public.is_banned());
create policy "no places while banned" on public.community_places as restrictive for insert to authenticated with check (not public.is_banned());
create policy "no recommendations while banned" on public.place_recommendations as restrictive for insert to authenticated with check (not public.is_banned());

-- ─── content flags ("report abuse") ─────────────────────────────────────
create table public.content_flags (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.users (id) on delete cascade,
  content_type  text not null check (content_type in ('report', 'shortcut', 'place')),
  content_id    uuid not null,
  reason        text not null check (reason in ('spam', 'fake', 'offensive', 'personal_info', 'dangerous', 'other')),
  note          text check (note is null or char_length(note) <= 280),
  status        text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at    timestamptz not null default now(),
  constraint content_flags_once unique (reporter_id, content_type, content_id)
);
create index content_flags_open_idx on public.content_flags (status, created_at desc);
create index content_flags_content_idx on public.content_flags (content_type, content_id);

create or replace function public.before_content_flag()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare recent integer;
begin
  if (select auth.uid()) is not null and new.reporter_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  new.status := 'open';
  new.created_at := now();
  select count(*) into recent from public.content_flags where reporter_id = new.reporter_id and created_at > now() - interval '24 hours';
  if recent >= 20 then
    raise exception 'Too many reports today.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger content_flags_before before insert on public.content_flags for each row execute function public.before_content_flag();

-- Auto-hide content flagged by 3+ different people until an admin reviews it
create or replace function public.after_content_flag()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  select count(distinct reporter_id) into n from public.content_flags
  where content_type = new.content_type and content_id = new.content_id and status = 'open';
  if n >= 3 then
    if new.content_type = 'report' then update public.traffic_reports set status = 'removed' where id = new.content_id;
    elsif new.content_type = 'shortcut' then update public.shortcuts set status = 'removed' where id = new.content_id;
    elsif new.content_type = 'place' then update public.community_places set status = 'removed' where id = new.content_id;
    end if;
  end if;
  return null;
end;
$$;
create trigger content_flags_after after insert on public.content_flags for each row execute function public.after_content_flag();

alter table public.content_flags enable row level security;
create policy "flags: report as yourself" on public.content_flags for insert to authenticated with check ((select auth.uid()) = reporter_id);
create policy "flags: see own or admin" on public.content_flags for select to authenticated using ((select auth.uid()) = reporter_id or public.is_admin());
revoke update, delete on public.content_flags from anon, authenticated;

-- ─── admin actions (RPC, admin-only) ────────────────────────────────────
create or replace function public.admin_moderate(p_type text, p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare new_status text;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_action not in ('remove', 'restore', 'dismiss') then raise exception 'Unknown action.'; end if;

  if p_action in ('remove', 'restore') then
    if p_type = 'report' then
      new_status := case when p_action = 'remove' then 'removed' else 'active' end;
      update public.traffic_reports set status = new_status where id = p_id;
    elsif p_type = 'shortcut' then
      update public.shortcuts set status = case when p_action = 'remove' then 'removed' else 'active' end where id = p_id;
    elsif p_type = 'place' then
      update public.community_places set status = case when p_action = 'remove' then 'removed' else 'active' end where id = p_id;
    else
      raise exception 'Unknown content type.';
    end if;
  end if;

  update public.content_flags
  set status = case when p_action = 'dismiss' or p_action = 'restore' then 'dismissed' else 'resolved' end
  where content_type = p_type and content_id = p_id and status = 'open';
end;
$$;

create or replace function public.admin_set_ban(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'You cannot ban yourself.'; end if;
  update public.users set banned_at = case when p_banned then now() else null end where id = p_user;
end;
$$;

-- Content (including hidden items) for the moderation queue
create or replace function public.admin_flag_queue()
returns table (
  content_type text, content_id uuid, flags bigint, reasons text[], notes text[], last_flagged timestamptz,
  owner_id uuid, owner_banned boolean, title text, detail text, content_status text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return query
  with f as (
    select cf.content_type, cf.content_id, count(*) as flags, array_agg(distinct cf.reason) as reasons,
           array_remove(array_agg(cf.note), null) as notes, max(cf.created_at) as last_flagged
    from public.content_flags cf where cf.status = 'open'
    group by cf.content_type, cf.content_id
  )
  select f.content_type, f.content_id, f.flags, f.reasons, f.notes, f.last_flagged,
         coalesce(r.user_id, s.user_id, p.user_id),
         coalesce(u.banned_at is not null, false),
         coalesce(r.report_type, s.title, p.name),
         coalesce(r.description, s.description, p.description),
         coalesce(r.status, s.status, p.status)
  from f
  left join public.traffic_reports r on f.content_type = 'report' and r.id = f.content_id
  left join public.shortcuts s on f.content_type = 'shortcut' and s.id = f.content_id
  left join public.community_places p on f.content_type = 'place' and p.id = f.content_id
  left join public.users u on u.id = coalesce(r.user_id, s.user_id, p.user_id)
  order by f.flags desc, f.last_flagged desc;
end;
$$;

revoke execute on function public.admin_moderate(text, uuid, text) from public, anon;
revoke execute on function public.admin_set_ban(uuid, boolean) from public, anon;
revoke execute on function public.admin_flag_queue() from public, anon;
grant execute on function public.admin_moderate(text, uuid, text) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean) to authenticated;
grant execute on function public.admin_flag_queue() to authenticated;

-- ─── in-app feedback (written by the API server, read by admins) ────────
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  category    text not null check (category in ('bug', 'idea', 'map_data', 'other')),
  message     text not null check (char_length(message) between 3 and 2000),
  contact     text check (contact is null or char_length(contact) <= 120),
  page        text check (page is null or char_length(page) <= 200),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  status      text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at  timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
create policy "feedback: admins read" on public.feedback for select to authenticated using (public.is_admin());
create policy "feedback: admins update" on public.feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.feedback from anon, authenticated;

-- trigger functions are not part of the API
revoke execute on function public.before_content_flag() from public, anon, authenticated;
revoke execute on function public.after_content_flag() from public, anon, authenticated;
