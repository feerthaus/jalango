-- "Sekitar sini" (owner, 28 Nov 2026): places to eat and things to see around a point,
-- from JalanGo's own data only (no reviews or ratings exist; none are made up).
--
--   places_around(lat, lng, kind, radius, limit)   API server only (service role)
--     kind 'makan'   community picks (food, cafe) + POIs (restoran)
--     kind 'menarik' community picks (attraction, nature) + POIs (tarikan)
--   Order: places the community recommends (most first), then places people confirmed
--   (most confirmations first), then the nearest. POIs reported closed are left out;
--   a POI that repeats a community pick (same name within 60 m) is left out.
--
-- Additive: one new function. Nothing else changes.

create or replace function public.places_around(p_lat double precision, p_lng double precision, p_kind text,
  p_radius integer default 3000, p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  rad integer := least(greatest(coalesce(p_radius, 3000), 300), 10000);
  lim integer := least(greatest(coalesce(p_limit, 10), 1), 20);
  d double precision := rad / 100000.0 + 0.002;
  comm_cats text[];
  poi_cat text;
begin
  if p_lat is null or p_lng is null or p_lat not between 0.5 and 7.6 or p_lng not between 99.4 and 119.5 then return '[]'::jsonb; end if;
  if p_kind = 'makan' then comm_cats := array['food', 'cafe']; poi_cat := 'restoran';
  elsif p_kind = 'menarik' then comm_cats := array['attraction', 'nature']; poi_cat := 'tarikan';
  else return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'source', x.src, 'name', x.name, 'note', x.note, 'lat', x.lat, 'lng', x.lng,
                                        'distance_m', x.dist, 'recommends', x.recs, 'confirmations', x.conf, 'verification', x.verification)
                     order by x.recs desc, x.conf desc, x.dist)
      from (
        select * from (
          select 'komuniti'::text as src, c.id, c.name, c.description as note, c.latitude as lat, c.longitude as lng,
                 round(public.poi_dist_m(p_lat, p_lng, c.latitude, c.longitude))::integer as dist,
                 c.recommend_count as recs, 0::bigint as conf, null::text as verification
            from public.community_places c
           where c.status = 'active' and c.category = any (comm_cats)
             and c.latitude between p_lat - d and p_lat + d and c.longitude between p_lng - d and p_lng + d
          union all
          select 'poi', p.id, p.name, p.subcategory, p.lat, p.lng,
                 round(public.poi_dist_m(p_lat, p_lng, p.lat, p.lng))::integer,
                 0, (select count(*) from public.poi_feedback f where f.poi_id = p.id and f.kind = 'masih_beroperasi' and (f.near or f.local)),
                 p.verification
            from public.pois p
           where p.status = 'active' and p.verification <> 'dilapor_tutup' and p.category = poi_cat
             and p.lat between p_lat - d and p_lat + d and p.lng between p_lng - d and p_lng + d
             and not exists (select 1 from public.community_places c2
                              where c2.status = 'active' and public.normalize_search(c2.name) = p.name_norm
                                and public.poi_dist_m(c2.latitude, c2.longitude, p.lat, p.lng) <= 60)
        ) u
        where u.dist <= rad
        order by u.recs desc, u.conf desc, u.dist
        limit lim
      ) x), '[]'::jsonb);
end;
$$;
comment on function public.places_around(double precision, double precision, text, integer, integer) is '"Sekitar sini": community picks and JalanGo POIs around a point, for the API server (service role only).';

revoke execute on function public.places_around(double precision, double precision, text, integer, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.places_around(double precision, double precision, text, integer, integer) to service_role;
  end if;
end $$;
