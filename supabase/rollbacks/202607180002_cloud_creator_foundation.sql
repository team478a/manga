begin;

drop policy if exists "cloud_assets_storage_delete" on storage.objects;
drop policy if exists "cloud_assets_storage_update" on storage.objects;
drop policy if exists "cloud_assets_storage_insert" on storage.objects;
drop policy if exists "cloud_assets_storage_read" on storage.objects;
delete from storage.objects where bucket_id = 'cloud-assets';
delete from storage.buckets where id = 'cloud-assets';

drop function if exists public.import_cloud_project(jsonb);
drop function if exists public.restore_cloud_project(uuid);
drop function if exists public.soft_delete_cloud_project(uuid);
drop function if exists public.save_cloud_page_snapshot(uuid,bigint,jsonb);
drop trigger if exists cloud_assets_storage_total on public.cloud_assets;
drop function if exists public.refresh_cloud_project_storage();
drop trigger if exists cloud_projects_boundary_guard on public.cloud_projects;
drop function if exists public.protect_cloud_project_boundary();

drop table if exists public.cloud_project_versions;
drop table if exists public.cloud_canvas_snapshots;
drop table if exists public.cloud_assets;
drop table if exists public.cloud_pages;
drop table if exists public.cloud_episodes;
drop table if exists public.cloud_project_collaborators;
drop table if exists public.cloud_projects;
drop function if exists public.cloud_project_can_edit(uuid);
drop function if exists public.cloud_project_can_read(uuid);

commit;
