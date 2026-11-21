-- Replies to in-app feedback (owner's request, Nov 2026): an admin answers a
-- message and the sender sees it in JalanGo.
--   signed in   → matched by user_id
--   guest       → matched by a random code kept on their device; only its
--                 SHA-256 is stored here (device_token_hash), never the code
-- Additive only: new columns and functions; nothing is dropped.

alter table public.feedback add column if not exists reply text check (reply is null or char_length(reply) between 1 and 2000);
alter table public.feedback add column if not exists replied_at timestamptz;
alter table public.feedback add column if not exists replied_by uuid references public.users (id) on delete set null;
alter table public.feedback add column if not exists reply_seen_at timestamptz;
alter table public.feedback add column if not exists device_token_hash text check (device_token_hash is null or device_token_hash ~ '^[0-9a-f]{64}$');
create index if not exists feedback_user_idx on public.feedback (user_id) where reply is not null;
create index if not exists feedback_device_idx on public.feedback (device_token_hash) where reply is not null;

create or replace function public.jg_token_hash(p_token text)
returns text language sql immutable set search_path = ''
as $$ select case when p_token ~ '^[A-Za-z0-9_-]{20,100}$' then encode(sha256(convert_to(p_token, 'UTF8')), 'hex') end $$;
revoke execute on function public.jg_token_hash(text) from public, anon, authenticated;

-- Admin writes (or edits) the reply; the message is marked done
create or replace function public.admin_reply_feedback(p_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r text := trim(coalesce(p_reply, ''));
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if char_length(r) < 1 or char_length(r) > 2000 then raise exception 'Reply must be 1–2000 characters.' using errcode = 'P0001', hint = 'invalid'; end if;
  update public.feedback
     set reply = r, replied_at = now(), replied_by = (select auth.uid()), reply_seen_at = null, status = 'done'
   where id = p_id and (user_id is not null or device_token_hash is not null);
  if not found then raise exception 'This message can’t receive a reply in the app.' using errcode = 'P0001', hint = 'no_recipient'; end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), 'feedback_replied', 'feedback', p_id, left(r, 120));
end;
$$;
revoke execute on function public.admin_reply_feedback(uuid, text) from public, anon;
grant execute on function public.admin_reply_feedback(uuid, text) to authenticated;

-- The caller's answered messages: their own (signed in) or this device's (code)
create or replace function public.my_feedback_replies(p_token text default null)
returns table (id uuid, category text, message text, created_at timestamptz, reply text, replied_at timestamptz, reply_seen_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.category, f.message, f.created_at, f.reply, f.replied_at, f.reply_seen_at
  from public.feedback f
  where f.reply is not null
    and ((f.user_id is not null and f.user_id = (select auth.uid()))
      or (f.device_token_hash is not null and f.device_token_hash = public.jg_token_hash(p_token)))
  order by f.replied_at desc
  limit 20
$$;
revoke execute on function public.my_feedback_replies(text) from public;
grant execute on function public.my_feedback_replies(text) to anon, authenticated;

create or replace function public.mark_feedback_reply_seen(p_id uuid, p_token text default null)
returns void language sql security definer set search_path = ''
as $$
  update public.feedback f set reply_seen_at = coalesce(f.reply_seen_at, now())
  where f.id = p_id and f.reply is not null
    and ((f.user_id is not null and f.user_id = (select auth.uid()))
      or (f.device_token_hash is not null and f.device_token_hash = public.jg_token_hash(p_token)))
$$;
revoke execute on function public.mark_feedback_reply_seen(uuid, text) from public;
grant execute on function public.mark_feedback_reply_seen(uuid, text) to anon, authenticated;
