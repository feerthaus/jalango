-- Throwaway PostgreSQL in the CI runner: measure the real size of the proposed "pois" table.
create extension if not exists pg_trgm;
create table pois (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'osm',
  source_ref text not null unique,
  source_version integer,
  category text not null, subcategory text,
  name text, name_norm text,
  lat double precision not null, lng double precision not null,
  address text, phone text, website text, opening_hours text, brand text,
  quality smallint not null default 0,
  status text not null default 'active',
  first_run uuid, last_seen_run uuid,
  updated_at timestamptz not null default now()
);
\copy pois (source_ref, source_version, category, subcategory, name, name_norm, lat, lng, address, phone, website, opening_hours, brand, quality, status) from 'pois.csv' with (format csv)
create index pois_latlng_idx on pois (lat, lng);
create index pois_name_trgm_idx on pois using gin (name_norm gin_trgm_ops);
vacuum analyze pois;
select count(*) as rows,
  pg_size_pretty(pg_relation_size('pois')) as heap,
  pg_size_pretty(pg_indexes_size('pois')) as indexes,
  pg_size_pretty(pg_total_relation_size('pois')) as total,
  round(pg_total_relation_size('pois')::numeric / greatest(count(*), 1)) as bytes_per_row
from pois;
select indexrelid::regclass as index, pg_size_pretty(pg_relation_size(indexrelid)) as size from pg_index where indrelid = 'pois'::regclass;
-- sanity: trigram search works on the data
select name, category from pois where name_norm % 'bengkel' or name_norm ilike '%bengkel%' limit 3;
