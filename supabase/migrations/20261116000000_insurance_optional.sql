-- Owner's decision (temporary): vehicle insurance is optional for car rental operators too.
-- If an insurance expiry is given it must still be valid. An operator without an APAD
-- licence OR without insurance details must accept the disclaimer (licence_disclaimer_at,
-- time set by the server). SSM stays required.
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.before_operator_write() from public, anon, authenticated;
