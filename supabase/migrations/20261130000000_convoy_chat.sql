-- Konvoi chat (owner's request, Nov 2026): members of a live convoy send each
-- other short messages and quick calls ("Singgah minyak", "Perlahan sikit").
--   members only   read and send only while in the convoy (is_convoy_member)
--   live only      only while the convoy runs; messages are deleted when the
--                  leader ends it, and old convoys' messages are swept on send
--   quick calls    a fixed list; fuel/food/rest/hazard may carry the sender's
--                  position so everyone sees where
--   limits         300 characters; 8 messages a minute, 300 a day per person
-- Additive only: a new table, policy, trigger and functions; nothing is dropped.

create table if not exists public.convoy_messages (
  id          uuid primary key default gen_random_uuid(),
  convoy_id   uuid not null references public.convoys (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  quick       text check (quick is null or quick in ('ok', 'wait', 'fuel', 'food', 'rest', 'slow', 'hazard', 'arrived')),
  body        text not null check (char_length(body) between 1 and 300),
  latitude    double precision check (latitude is null or latitude between -90 and 90),
  longitude   double precision check (longitude is null or longitude between -180 and 180),
  created_at  timestamptz not null default now()
);
create index if not exists convoy_messages_convoy_idx on public.convoy_messages (convoy_id, created_at desc);
create index if not exists convoy_messages_user_idx on public.convoy_messages (user_id, created_at desc);

alter table public.convoy_messages enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'convoy_messages' and policyname = 'convoy messages: members read') then
    create policy "convoy messages: members read" on public.convoy_messages for select to authenticated
      using (public.is_convoy_member(convoy_id)
             and exists (select 1 from public.convoys c where c.id = convoy_id and c.ended_at is null and c.expires_at > now()));
  end if;
end $$;
revoke insert, update, delete on public.convoy_messages from anon, authenticated;
revoke all on public.convoy_messages from anon;

-- Send: members of a running convoy only; trimmed; rate-limited
create or replace function public.send_convoy_message(p_convoy uuid, p_body text, p_quick text default null,
  p_lat double precision default null, p_lng double precision default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  b text := left(regexp_replace(trim(coalesce(p_body, '')), '\s+', ' ', 'g'), 300);
  new_id uuid;
begin
  if uid is null then raise exception 'Please sign in.' using errcode = '42501'; end if;
  if public.is_banned() then raise exception 'This account can’t post.' using errcode = '42501', hint = 'banned'; end if;
  if not public.is_convoy_member(p_convoy) then raise exception 'You are not in this convoy.' using errcode = 'P0001', hint = 'not_member'; end if;
  if not exists (select 1 from public.convoys c where c.id = p_convoy and c.ended_at is null and c.expires_at > now()) then
    raise exception 'This convoy has ended.' using errcode = 'P0001', hint = 'inactive';
  end if;
  if char_length(b) = 0 then raise exception 'Empty message.' using errcode = 'P0001', hint = 'invalid'; end if;
  if p_quick is not null and p_quick not in ('ok', 'wait', 'fuel', 'food', 'rest', 'slow', 'hazard', 'arrived') then
    raise exception 'Unknown quick message.' using errcode = 'P0001', hint = 'invalid';
  end if;
  if (select count(*) from public.convoy_messages m where m.user_id = uid and m.created_at > now() - interval '1 minute') >= 8 then
    raise exception 'Slow down a little.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if (select count(*) from public.convoy_messages m where m.user_id = uid and m.created_at > now() - interval '1 day') >= 300 then
    raise exception 'Too many messages today.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.convoy_messages (convoy_id, user_id, quick, body, latitude, longitude)
  values (p_convoy, uid, p_quick, b,
          case when p_quick in ('fuel', 'food', 'rest', 'hazard') then p_lat end,
          case when p_quick in ('fuel', 'food', 'rest', 'hazard') then p_lng end)
  returning id into new_id;
  -- Sweep messages of convoys that are over (there's no scheduler): a few hundred at a time
  delete from public.convoy_messages m
   where m.id in (select m2.id from public.convoy_messages m2 join public.convoys c on c.id = m2.convoy_id
                  where c.ended_at is not null or c.expires_at < now() limit 500);
  return new_id;
end;
$$;
revoke execute on function public.send_convoy_message(uuid, text, text, double precision, double precision) from public, anon;
grant execute on function public.send_convoy_message(uuid, text, text, double precision, double precision) to authenticated;

-- Ending a convoy deletes its chat
create or replace function public.after_convoy_ended()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.ended_at is not null and old.ended_at is null then
    delete from public.convoy_messages where convoy_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.after_convoy_ended() from public, anon, authenticated;
create or replace trigger convoys_after_end after update of ended_at on public.convoys
  for each row execute function public.after_convoy_ended();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'convoy_messages') then
    alter publication supabase_realtime add table public.convoy_messages;
  end if;
end $$;
