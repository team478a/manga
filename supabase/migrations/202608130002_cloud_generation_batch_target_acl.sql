begin;

-- Supabase projects may carry schema-level default privileges for authenticated.
-- Durable targets contain provider input, so deny direct table access explicitly
-- and expose only the owner-checked RPC surface from the preceding migration.
revoke all on table public.cloud_generation_batch_targets from public, anon, authenticated;
grant select, insert, update, delete on table public.cloud_generation_batch_targets to service_role;

commit;
