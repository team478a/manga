begin;

do $$
begin
  if exists (select 1 from public.cloud_generation_job_events limit 1)
    or exists (
      select 1 from public.cloud_generation_jobs
      where parent_job_id is not null
        or root_job_id is not null
        or failure_stage is not null
        or retry_disposition is not null
        or http_status is not null
        or workflow_version is not null
        or seed is not null
        or last_checkpoint_at is not null
    ) then
    raise exception 'cloud_generation_resumable_foundation_rollback_blocked';
  end if;
end $$;

drop table if exists public.cloud_generation_job_events;
drop index if exists public.cloud_generation_jobs_parent_idx;
drop index if exists public.cloud_generation_jobs_root_idx;

alter table public.cloud_generation_jobs
  drop constraint if exists cloud_generation_jobs_id_project_key;

alter table public.cloud_generation_jobs
  drop column if exists execution_phase,
  drop column if exists failure_stage,
  drop column if exists retry_disposition,
  drop column if exists http_status,
  drop column if exists parent_job_id,
  drop column if exists root_job_id,
  drop column if exists workflow_version,
  drop column if exists seed,
  drop column if exists last_checkpoint_at;

notify pgrst, 'reload schema';

commit;
