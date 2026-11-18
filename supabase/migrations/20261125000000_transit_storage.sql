-- Storage for the daily public transport snapshot (trains, LRT/MRT and buses as
-- one compact file), written by the scheduled function and read by the API, both
-- with the service role. Private: no policies for anon or authenticated users.
insert into storage.buckets (id, name, public)
values ('transit', 'transit', false)
on conflict (id) do nothing;
