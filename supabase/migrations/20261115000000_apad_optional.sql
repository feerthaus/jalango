-- Owner's decision (temporary): the APAD licence is optional for car rental operators.
-- If given, it must still be valid. If not, the operator must accept a disclaimer
-- (they alone are responsible for licensing and insurance); we record when.
-- SSM and insurance stay required. Only licensed operators get the "Berlesen APAD" badge.
alter table public.operators add column if not exists licence_disclaimer_at timestamptz;

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
    -- The disclaimer time is set by the server, never by the client
    if new.licence_disclaimer_at is not null then
      new.licence_disclaimer_at := case when tg_op = 'UPDATE' and old.licence_disclaimer_at is not null then old.licence_disclaimer_at else now() end;
    end if;
  end if;
  new.business_name := trim(regexp_replace(new.business_name, '\s+', ' ', 'g'));
  new.town := trim(new.town);
  new.description := nullif(trim(coalesce(new.description, '')), '');
  new.apad_licence_no := nullif(trim(coalesce(new.apad_licence_no, '')), '');
  if new.kind = 'car_rental' and new.status in ('pending', 'approved') then
    if new.ssm_no is null or new.insurance_expires_on is null then
      raise exception 'Car rental needs SSM and insurance details.' using errcode = 'P0001', hint = 'invalid';
    end if;
    if new.insurance_expires_on <= current_date then
      raise exception 'The insurance must still be valid.' using errcode = 'P0001', hint = 'invalid';
    end if;
    if new.apad_licence_no is not null then
      if new.apad_expires_on is null or new.apad_expires_on <= current_date then
        raise exception 'The APAD licence must still be valid.' using errcode = 'P0001', hint = 'invalid';
      end if;
      new.licence_disclaimer_at := null;
    else
      new.apad_expires_on := null;
      if new.licence_disclaimer_at is null then
        raise exception 'Without an APAD licence, please accept the disclaimer.' using errcode = 'P0001', hint = 'invalid';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.before_operator_write() from public, anon, authenticated;
