begin;

create table public.cloud_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check (kind in ('image', 'text')),
  job_type text not null check (job_type in ('background', 'prop', 'effect', 'character_base', 'story', 'storyboard', 'speech_bubble')),
  provider_id text not null check (char_length(provider_id) between 1 and 100),
  model_id text not null check (char_length(model_id) between 1 and 200),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  prompt_sha256 text not null check (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  input jsonb not null check (jsonb_typeof(input) = 'object' and pg_column_size(input) <= 65536),
  moderation jsonb not null check (
    jsonb_typeof(moderation) = 'object'
    and moderation->>'decision' = 'allow'
    and moderation->>'policyVersion' = '1'
  ),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'canceled')),
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  max_attempts integer not null default 2 check (max_attempts between 1 and 3),
  estimated_cost_micros bigint check (estimated_cost_micros is null or estimated_cost_micros >= 0),
  actual_cost_micros bigint check (actual_cost_micros is null or actual_cost_micros >= 0),
  provider_job_id text check (provider_job_id is null or char_length(provider_job_id) <= 300),
  output jsonb check (output is null or (jsonb_typeof(output) = 'object' and pg_column_size(output) <= 65536)),
  output_asset_id uuid references public.cloud_assets(id) on delete set null,
  error_code text check (error_code is null or char_length(error_code) <= 100),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by_profile_id, idempotency_key),
  foreign key (page_id, project_id) references public.cloud_pages(id, project_id) on delete cascade
);

create index cloud_generation_jobs_queue_idx
  on public.cloud_generation_jobs (status, retry_at, created_at)
  where status = 'queued';
create index cloud_generation_jobs_project_idx
  on public.cloud_generation_jobs (project_id, created_at desc);

alter table public.cloud_generation_jobs enable row level security;
grant select on public.cloud_generation_jobs to authenticated;
grant select, insert, update on public.cloud_generation_jobs to service_role;

create policy "cloud_generation_jobs_read" on public.cloud_generation_jobs
for select using (public.cloud_project_can_edit(project_id));

create or replace function public.enqueue_cloud_generation_job(
  p_project_id uuid,
  p_page_id uuid,
  p_kind text,
  p_job_type text,
  p_provider_id text,
  p_model_id text,
  p_idempotency_key text,
  p_prompt_sha256 text,
  p_input jsonb,
  p_moderation jsonb,
  p_estimated_cost_micros bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_job_id uuid;
begin
  if v_profile_id is null or not public.cloud_project_can_edit(p_project_id) then
    raise exception 'cloud_project_not_editable';
  end if;
  if not exists (
    select 1 from public.cloud_projects
    where id = p_project_id and content_class = 'general' and deleted_at is null
  ) then raise exception 'general_cloud_project_required'; end if;
  if p_page_id is not null and not exists (
    select 1 from public.cloud_pages
    where id = p_page_id and project_id = p_project_id and deleted_at is null
  ) then raise exception 'cloud_page_not_found'; end if;
  if p_kind not in ('image', 'text')
     or p_job_type not in ('background', 'prop', 'effect', 'character_base', 'story', 'storyboard', 'speech_bubble')
     or (p_kind = 'image' and p_job_type not in ('background', 'prop', 'effect', 'character_base'))
     or (p_kind = 'text' and p_job_type not in ('story', 'storyboard', 'speech_bubble'))
     or p_input->>'kind' is distinct from p_kind
     or p_input->>'jobType' is distinct from p_job_type
     or nullif(trim(p_input->>'prompt'), '') is null
     or p_moderation->>'decision' is distinct from 'allow'
     or p_moderation->>'policyVersion' is distinct from '1' then
    raise exception 'cloud_generation_input_rejected';
  end if;
  insert into public.cloud_generation_jobs(
    project_id, page_id, created_by_profile_id, kind, job_type,
    provider_id, model_id, idempotency_key, prompt_sha256, input,
    moderation, estimated_cost_micros
  ) values (
    p_project_id, p_page_id, v_profile_id, p_kind, p_job_type,
    trim(p_provider_id), trim(p_model_id), trim(p_idempotency_key),
    p_prompt_sha256, p_input, p_moderation, p_estimated_cost_micros
  )
  on conflict (created_by_profile_id, idempotency_key)
  do update set updated_at = public.cloud_generation_jobs.updated_at
  returning id into v_job_id;
  return v_job_id;
end;
$$;

create or replace function public.cancel_cloud_generation_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cloud_generation_jobs
  set status = 'canceled', canceled_at = now(), finished_at = now(),
      lease_token = null, lease_expires_at = null, updated_at = now()
  where id = p_job_id and status in ('queued', 'running')
    and public.cloud_project_can_edit(project_id);
  if not found then raise exception 'cloud_generation_job_not_cancelable'; end if;
  return p_job_id;
end;
$$;

create or replace function public.claim_cloud_generation_job(
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns setof public.cloud_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_token uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' or char_length(trim(p_worker_id)) not between 1 and 100
     or p_lease_seconds not between 30 and 900 then
    raise exception 'cloud_worker_not_authorized';
  end if;
  select id into v_job_id from public.cloud_generation_jobs
  where status = 'queued' and (retry_at is null or retry_at <= now())
  order by created_at for update skip locked limit 1;
  if v_job_id is null then return; end if;
  return query update public.cloud_generation_jobs
  set status = 'running', progress = 1, attempt_count = attempt_count + 1,
      lease_token = v_token, lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()), updated_at = now()
  where id = v_job_id returning *;
end;
$$;

create or replace function public.finish_cloud_generation_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_succeeded boolean,
  p_output jsonb default null,
  p_output_asset_id uuid default null,
  p_provider_job_id text default null,
  p_actual_cost_micros bigint default null,
  p_error_code text default null,
  p_error_message text default null,
  p_retryable boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'cloud_worker_not_authorized'; end if;
  select * into v_job from public.cloud_generation_jobs
  where id = p_job_id and status = 'running' and lease_token = p_lease_token for update;
  if not found then raise exception 'cloud_generation_lease_invalid'; end if;
  if p_output_asset_id is not null and not exists (
    select 1 from public.cloud_assets where id = p_output_asset_id and project_id = v_job.project_id
  ) then raise exception 'cloud_generation_output_asset_invalid'; end if;
  if p_succeeded then
    update public.cloud_generation_jobs set
      status = 'completed', progress = 100, output = coalesce(p_output, '{}'::jsonb),
      output_asset_id = p_output_asset_id, provider_job_id = p_provider_job_id,
      actual_cost_micros = p_actual_cost_micros, error_code = null, error_message = null,
      lease_token = null, lease_expires_at = null, finished_at = now(), updated_at = now()
    where id = p_job_id;
  elsif p_retryable and v_job.attempt_count < v_job.max_attempts then
    update public.cloud_generation_jobs set
      status = 'queued', progress = 0, provider_job_id = p_provider_job_id,
      error_code = left(p_error_code, 100), error_message = left(p_error_message, 500),
      lease_token = null, lease_expires_at = null,
      retry_at = now() + make_interval(secs => 5 * power(2, v_job.attempt_count - 1)::integer),
      updated_at = now()
    where id = p_job_id;
  else
    update public.cloud_generation_jobs set
      status = 'failed', provider_job_id = p_provider_job_id,
      actual_cost_micros = p_actual_cost_micros,
      error_code = left(p_error_code, 100), error_message = left(p_error_message, 500),
      lease_token = null, lease_expires_at = null, finished_at = now(), updated_at = now()
    where id = p_job_id;
  end if;
  return p_job_id;
end;
$$;

revoke execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) from public, anon;
revoke execute on function public.cancel_cloud_generation_job(uuid) from public, anon;
revoke execute on function public.claim_cloud_generation_job(text,integer) from public, anon, authenticated;
revoke execute on function public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean) from public, anon, authenticated;
grant execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) to authenticated, service_role;
grant execute on function public.cancel_cloud_generation_job(uuid) to authenticated, service_role;
grant execute on function public.claim_cloud_generation_job(text,integer) to service_role;
grant execute on function public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean) to service_role;

commit;
