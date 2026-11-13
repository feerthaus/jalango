-- Marketplace phase 0: operator accounts, verification documents and admin review.
-- See docs/MARKETPLACE.md. Kinds: homestay, and car rental with an APAD licence +
-- rental insurance (unlicensed operators are not accepted).

create table public.operators (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.users (id) on delete cascade,
  kind                  text not null check (kind in ('homestay', 'car_rental')),
  business_name         text not null check (char_length(business_name) between 3 and 80),
  state                 text not null check (char_length(state) between 2 and 40),
  town                  text not null check (char_length(town) between 2 and 60),
  phone                 text not null check (phone ~ '^\+?60[0-9]{8,11}$'),
  description           text check (description is null or char_length(description) <= 500),
  ssm_no                text check (ssm_no is null or char_length(ssm_no) between 4 and 30),
  apad_licence_no       text check (apad_licence_no is null or char_length(apad_licence_no) between 3 and 40),
  apad_expires_on       date,
  insurance_expires_on  date,
  status                text not null default 'pending' check (status in ('pending', 'needs_info', 'approved', 'rejected', 'suspended')),
  review_note           text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at           timestamptz,
  approved_at           timestamptz,
  free_until            date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.operators is 'Marketplace operators (homestay, licensed car rental). Reviewed by an admin before anything is listed.';
create index operators_status_idx on public.operators (status, updated_at);

create table public.operator_documents (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references public.operators (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  kind         text not null check (kind in ('ic', 'ownership', 'ssm', 'apad_licence', 'insurance', 'other')),
  path         text not null unique check (char_length(path) <= 200),
  created_at   timestamptz not null default now()
);
create index operator_documents_operator_idx on public.operator_documents (operator_id);

create table public.admin_actions (
  id           bigint generated always as identity primary key,
  admin_id     uuid references public.users (id) on delete set null,
  action       text not null,
  target_type  text not null,
  target_id    uuid,
  note         text,
  created_at   timestamptz not null default now()
);
comment on table public.admin_actions is 'Audit log of admin decisions.';

-- Owners fill in the profile; status and review fields are the admin's.
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
    else
      new.created_at := now();
      new.approved_at := null;
      new.free_until := null;
    end if;
    -- Any change by the owner goes (back) to review
    new.status := 'pending';
    new.reviewed_at := case when tg_op = 'UPDATE' then old.reviewed_at else null end;
    new.review_note := case when tg_op = 'UPDATE' then old.review_note else null end;
  end if;
  new.business_name := trim(regexp_replace(new.business_name, '\s+', ' ', 'g'));
  new.town := trim(new.town);
  new.description := nullif(trim(coalesce(new.description, '')), '');
  if new.kind = 'car_rental' and new.status in ('pending', 'approved') then
    if new.ssm_no is null or new.apad_licence_no is null or new.apad_expires_on is null or new.insurance_expires_on is null then
      raise exception 'Car rental needs SSM, APAD licence and insurance details.' using errcode = 'P0001', hint = 'invalid';
    end if;
    if new.apad_expires_on <= current_date or new.insurance_expires_on <= current_date then
      raise exception 'The APAD licence and insurance must still be valid.' using errcode = 'P0001', hint = 'invalid';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger operators_before_write
  before insert or update on public.operators
  for each row execute function public.before_operator_write();

alter table public.operators enable row level security;
create policy "operators: see own" on public.operators for select to authenticated using ((select auth.uid()) = user_id);
create policy "operators: admins see all" on public.operators for select to authenticated using (public.is_admin());
create policy "operators: register yourself" on public.operators for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "operators: edit own" on public.operators for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "operators: no registering while banned" on public.operators as restrictive for insert to authenticated with check (not public.is_banned());
revoke delete on public.operators from anon, authenticated;

create or replace function public.before_operator_document_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid())
     or not exists (select 1 from public.operators o where o.id = new.operator_id and o.user_id = new.user_id)
     or split_part(new.path, '/', 1) <> new.user_id::text then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if (select count(*) from public.operator_documents where operator_id = new.operator_id) >= 15 then
    raise exception 'Too many documents.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  new.created_at := now();
  return new;
end;
$$;
create trigger operator_documents_before_insert
  before insert on public.operator_documents
  for each row execute function public.before_operator_document_insert();

alter table public.operator_documents enable row level security;
create policy "operator docs: see own" on public.operator_documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "operator docs: admins see all" on public.operator_documents for select to authenticated using (public.is_admin());
create policy "operator docs: add own" on public.operator_documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "operator docs: delete own" on public.operator_documents for delete to authenticated using ((select auth.uid()) = user_id);
revoke update on public.operator_documents from anon, authenticated;

alter table public.admin_actions enable row level security;
create policy "admin actions: admins read" on public.admin_actions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.admin_actions from anon, authenticated;

-- Admin decision on an operator (2FA admins only). Approval starts 6 free months.
create or replace function public.admin_review_operator(p_operator uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'needs_info', 'rejected', 'suspended') then
    raise exception 'Unknown decision.' using errcode = 'P0001';
  end if;
  if p_decision in ('needs_info', 'rejected', 'suspended') and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Please give the operator a reason.' using errcode = 'P0001', hint = 'invalid';
  end if;
  perform set_config('jalango.internal', '1', true);
  update public.operators
  set status = p_decision,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now(),
      approved_at = case when p_decision = 'approved' then coalesce(approved_at, now()) else approved_at end,
      free_until = case when p_decision = 'approved' then coalesce(free_until, (now() at time zone 'Asia/Kuala_Lumpur')::date + interval '6 months') else free_until end
  where id = p_operator;
  perform set_config('jalango.internal', '', true);
  if not found then raise exception 'Operator not found.' using errcode = 'P0001'; end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values ((select auth.uid()), 'operator_' || p_decision, 'operator', p_operator, nullif(trim(coalesce(p_note, '')), ''));
end;
$$;
revoke execute on function public.admin_review_operator(uuid, text, text) from public, anon;
grant execute on function public.admin_review_operator(uuid, text, text) to authenticated;

revoke execute on function public.before_operator_write() from public, anon, authenticated;
revoke execute on function public.before_operator_document_insert() from public, anon, authenticated;

-- ─── Private bucket for verification documents ──────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('operator-docs', 'operator-docs', false, 5242880, array['image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "operator docs: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'operator-docs' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.is_banned());
create policy "operator docs: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'operator-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "operator docs: owners delete" on storage.objects for delete to authenticated
  using (bucket_id = 'operator-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
