begin;

drop function if exists public.extend_cloud_generation_job_lease(
  uuid,uuid,integer
);

commit;
