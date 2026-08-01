begin;
drop function if exists public.restore_cloud_project_checkpoint(uuid,uuid);
drop table if exists public.cloud_project_checkpoint_restores;
commit;
