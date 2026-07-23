begin;

drop function if exists public.queue_orphan_cloud_generation_assets();
drop function if exists public.record_cloud_generation_storage_cleanup(
  uuid,text,text,text,text
);
drop function if exists public.complete_cloud_generation_image_job(
  uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint
);
drop table if exists public.cloud_generation_storage_cleanup;
drop index if exists public.cloud_assets_source_generation_job_idx;
alter table public.cloud_assets
drop column if exists source_generation_job_id;

commit;
