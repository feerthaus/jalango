-- POI-3b: community checks on JalanGo POIs (UI on the place card) and the admin list.
--
-- People answer with poi_submit_feedback (POI-2B): still open, closed, wrong place,
-- or a better name. Only the account and the answer are kept, never the location
-- (near = was within 300 m when answering). Two nearby people agreeing on open /
-- closed settles it automatically; everything else waits for an admin here.
--
--   poi_feedback_mine      signed-in: which answers I already gave for a POI
--   admin_poi_feedback     admin (2FA): open answers grouped by POI and kind
--   poi_feedback_resolve   admin (2FA): accept or dismiss them (the fix itself is
--                          made with the POI live tools: rename / hide)
--
-- Additive: three new functions. Nothing else changes.

create or replace function public.poi_feedback_mine(p_poi uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'answered', coalesce((select jsonb_agg(f.kind order by f.kind) from public.poi_feedback f where f.poi_id = p_poi and f.user_id = (select auth.uid())), '[]'::jsonb),
    'verification', (select p.verification from public.pois p where p.id = p_poi and p.status = 'active'));
$$;

create or replace function public.admin_poi_feedback(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(g order by g.near_n desc, g.n desc, g.first_at)
      from (
        select p.id as poi_id, p.name, p.osm_ref, p.category, p.lat, p.lng, p.status, p.verification, f.kind,
               count(*) as n, count(*) filter (where f.near) as near_n, min(f.created_at) as first_at,
               coalesce(jsonb_agg(distinct f.suggested_name) filter (where f.suggested_name is not null), '[]'::jsonb) as names,
               coalesce(jsonb_agg(distinct f.suggested_category) filter (where f.suggested_category is not null), '[]'::jsonb) as categories
          from public.poi_feedback f join public.pois p on p.id = f.poi_id
         where f.status = 'baru'
         group by p.id, f.kind
         order by count(*) filter (where f.near) desc, count(*) desc
         limit greatest(1, least(coalesce(p_limit, 100), 300))
      ) g), '[]'::jsonb);
end;
$$;

create or replace function public.poi_feedback_resolve(p_poi uuid, p_kind text, p_accept boolean)
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.poi_feedback set status = case when p_accept then 'diterima' else 'ditolak' end
   where poi_id = p_poi and kind = p_kind and status = 'baru';
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.admin_actions (admin_id, action, target_type, target_id, note)
    values ((select auth.uid()), case when p_accept then 'poi_feedback_accept' else 'poi_feedback_dismiss' end, 'poi', p_poi, left(p_kind || ' ×' || n, 200));
  end if;
  return n;
end;
$$;

revoke execute on function public.poi_feedback_mine(uuid) from public, anon;
revoke execute on function public.admin_poi_feedback(integer) from public, anon;
revoke execute on function public.poi_feedback_resolve(uuid, text, boolean) from public, anon;
grant execute on function public.poi_feedback_mine(uuid) to authenticated;
grant execute on function public.admin_poi_feedback(integer) to authenticated;
grant execute on function public.poi_feedback_resolve(uuid, text, boolean) to authenticated;
