begin;
drop function if exists public.create_cloud_project_checkpoint(uuid,text,text);
drop table if exists public.cloud_project_checkpoint_pages;
drop table if exists public.cloud_project_checkpoints;
drop table if exists public.cloud_project_backup_blobs;
commit;
