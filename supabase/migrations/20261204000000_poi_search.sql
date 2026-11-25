-- POI-3: JalanGo's own POIs (OpenStreetMap, ODbL) in search.
--
-- search_pois is called by the API server only (service role), next to Mapbox, and
-- returns live POIs ("active") only, leaving out places two nearby people reported
-- closed. It is not open to anon / signed-in users, so the table cannot be
-- downloaded in bulk through the REST API, and the server's rate limits apply. Two ways to search:
--   by name:      p_q = "restoran k2"        → name contains the text, or is close to it
--   by category:  p_category = 'bengkel'     → that category, optionally with a word
--                 p_word = 'surau'              in the name and a place
--                 p_place = 'banting'           (nearest settlement or the name)
-- Nearest first when a location is given.
--
-- Additive: one new function. Nothing else changes.

create or replace function public.search_pois(
  p_q text default null,
  p_category text default null,
  p_word text default null,
  p_place text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit integer default 8
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  q text := public.normalize_search(left(coalesce(p_q, ''), 80));
  w text := public.normalize_search(left(coalesce(p_word, ''), 40));
  pl text := public.normalize_search(left(coalesce(p_place, ''), 60));
  lim integer := greatest(1, least(coalesce(p_limit, 8), 20));
  has_near boolean := p_lat is not null and p_lng is not null and p_lat between 0.5 and 7.6 and p_lng between 99.4 and 119.5;
begin
  if p_category is not null and p_category not in ('restoran', 'penginapan', 'minyak', 'bengkel', 'runcit', 'kesihatan', 'tarikan', 'ibadah') then
    return '[]'::jsonb;
  end if;
  if p_category is null and char_length(q) < 2 then return '[]'::jsonb; end if;
  -- LIKE wildcards in the text are taken literally
  q := replace(replace(q, '%', ''), '_', '');
  w := replace(replace(w, '%', ''), '_', '');
  pl := replace(replace(pl, '%', ''), '_', '');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'category', r.category, 'subcategory', r.subcategory,
        'lat', r.lat, 'lng', r.lng, 'address', r.address, 'nearest_place', r.nearest_place,
        'distance_m', r.dist) order by r.rank_order)
    from (
      select p.*, d.dist,
             row_number() over (order by
               case when p_category is null then (p.name_norm = q)::int * 2 + (p.name_norm like q || '%')::int else 0 end desc,
               case when p_category is null then extensions.similarity(p.name_norm, q) else 0 end desc,
               d.dist nulls last,
               p.quality desc,
               p.name) as rank_order
        from public.pois p
        cross join lateral (select case when has_near
          then round(111320 * sqrt(power(p.lat - p_lat, 2) + power((p.lng - p_lng) * cos(radians(p_lat)), 2)))::integer end as dist) d
       where p.status = 'active' and p.verification <> 'dilapor_tutup'
         and (
           (p_category is null and (p.name_norm like '%' || q || '%' or extensions.similarity(p.name_norm, q) >= 0.4))
           or
           (p_category is not null and p.category = p_category
             and (w = '' or p.name_norm like '%' || w || '%')
             and (pl = '' or lower(coalesce(p.nearest_place, '')) like '%' || pl || '%' or p.name_norm like '%' || pl || '%'))
         )
       order by rank_order
       limit lim
    ) r), '[]'::jsonb);
end;
$$;
comment on function public.search_pois(text, text, text, text, double precision, double precision, integer) is 'POI-3: live POIs for the API server''s search (service role only).';

revoke execute on function public.search_pois(text, text, text, text, double precision, double precision, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.search_pois(text, text, text, text, double precision, double precision, integer) to service_role;
  end if;
end $$;
