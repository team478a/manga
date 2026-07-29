begin;
drop table if exists public.cloud_scenario_confirmations;
drop function if exists public.create_cloud_scenario_run(uuid,uuid,jsonb,timestamptz);
drop table if exists public.cloud_scenario_runs;
commit;
