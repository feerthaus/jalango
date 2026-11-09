-- Konvoi: each member says whether they're in a car or on a motorcycle (icon on everyone's map)
alter table public.convoy_members
  add column vehicle text not null default 'car' check (vehicle in ('car', 'motorcycle'));
