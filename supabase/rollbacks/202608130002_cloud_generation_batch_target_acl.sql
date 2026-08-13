begin;

-- Do not restore broad authenticated access during rollback. The preceding
-- migration also requires this table to remain private until it is dropped.
revoke all on table public.cloud_generation_batch_targets from public, anon, authenticated;
grant select, insert, update, delete on table public.cloud_generation_batch_targets to service_role;

commit;
