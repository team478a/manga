begin;

alter table public.cloud_generation_jobs
  add column if not exists execution_phase text,
  add column if not exists failure_stage text,
  add column if not exists retry_disposition text,
  add column if not exists http_status integer,
  add column if not exists parent_job_id uuid references public.cloud_generation_jobs(id) on delete set null,
  add column if not exists root_job_id uuid references public.cloud_generation_jobs(id) on delete set null,
  add column if not exists workflow_version text,
  add column if not exists seed text,
  add column if not exists last_checkpoint_at timestamptz;

alter table public.cloud_generation_jobs
  drop constraint if exists cloud_generation_jobs_id_project_key,
  add constraint cloud_generation_jobs_id_project_key unique(id,project_id);

alter table public.cloud_generation_jobs
  drop constraint if exists cloud_generation_jobs_execution_phase_check,
  add constraint cloud_generation_jobs_execution_phase_check check (
    execution_phase is null or execution_phase in (
      'queued','preparing','generating','validating',
      'succeeded','failed','canceled','unknown'
    )
  ),
  drop constraint if exists cloud_generation_jobs_failure_stage_check,
  add constraint cloud_generation_jobs_failure_stage_check check (
    failure_stage is null or failure_stage in (
      'request','visual_readiness','moderation','quota','claim','lease',
      'reference_resolution','provider','validation','storage','completion',
      'quality','adoption','dialogue'
    )
  ),
  drop constraint if exists cloud_generation_jobs_retry_disposition_check,
  add constraint cloud_generation_jobs_retry_disposition_check check (
    retry_disposition is null or retry_disposition in ('automatic','manual','none')
  ),
  drop constraint if exists cloud_generation_jobs_http_status_check,
  add constraint cloud_generation_jobs_http_status_check check (
    http_status is null or http_status between 100 and 599
  ),
  drop constraint if exists cloud_generation_jobs_workflow_version_check,
  add constraint cloud_generation_jobs_workflow_version_check check (
    workflow_version is null or char_length(workflow_version) between 1 and 200
  ),
  drop constraint if exists cloud_generation_jobs_seed_check,
  add constraint cloud_generation_jobs_seed_check check (
    seed is null or char_length(seed) between 1 and 200
  ),
  drop constraint if exists cloud_generation_jobs_parent_not_self_check,
  add constraint cloud_generation_jobs_parent_not_self_check check (
    parent_job_id is null or parent_job_id <> id
  ),
  drop constraint if exists cloud_generation_jobs_root_not_self_check,
  add constraint cloud_generation_jobs_root_not_self_check check (
    root_job_id is null or root_job_id <> id
  );

update public.cloud_generation_jobs
set execution_phase = case status
  when 'queued' then 'queued'
  when 'running' then 'unknown'
  when 'completed' then 'succeeded'
  when 'failed' then 'failed'
  when 'canceled' then 'canceled'
end
where execution_phase is null;

create index if not exists cloud_generation_jobs_parent_idx
  on public.cloud_generation_jobs(parent_job_id)
  where parent_job_id is not null;
create index if not exists cloud_generation_jobs_root_idx
  on public.cloud_generation_jobs(root_job_id)
  where root_job_id is not null;

create table if not exists public.cloud_generation_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cloud_generation_jobs(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  execution_phase text not null check (execution_phase in (
    'queued','preparing','generating','validating',
    'succeeded','failed','canceled','unknown'
  )),
  event_type text not null check (event_type in (
    'phase_changed','retry_scheduled','lease_reclaimed',
    'canceled','completed','failed'
  )),
  attempt_number integer not null check (attempt_number between 0 and 100),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata)='object'
    and pg_column_size(metadata)<=16384
    and not metadata ?| array[
      'prompt','apiKey','api_key','authorization','signedUrl','signed_url',
      'responseBody','response_body'
    ]
  ),
  created_at timestamptz not null default now(),
  foreign key(job_id,project_id) references public.cloud_generation_jobs(id,project_id) on delete cascade
);

create index if not exists cloud_generation_job_events_job_idx
  on public.cloud_generation_job_events(job_id,created_at);
create index if not exists cloud_generation_job_events_project_idx
  on public.cloud_generation_job_events(project_id,created_at desc);

alter table public.cloud_generation_job_events enable row level security;
grant select on public.cloud_generation_job_events to authenticated;
grant select,insert on public.cloud_generation_job_events to service_role;
drop policy if exists "cloud_generation_job_events_read" on public.cloud_generation_job_events;
create policy "cloud_generation_job_events_read"
  on public.cloud_generation_job_events for select
  using (
    owner_profile_id=public.current_profile_id()
    and public.cloud_project_can_edit(project_id)
  );

comment on table public.cloud_generation_job_events is
  'Append-only safe generation lifecycle events. Provider payloads, prompts, secrets, and signed URLs are forbidden.';

notify pgrst, 'reload schema';

commit;
