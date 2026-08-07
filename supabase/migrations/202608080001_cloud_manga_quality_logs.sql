begin;

create table if not exists public.cloud_manga_quality_logs (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid references public.cloud_pages(id) on delete set null,
  panel_id uuid,
  generation_job_id uuid not null references public.cloud_generation_jobs(id) on delete cascade,
  candidate_id text not null check (char_length(candidate_id) between 1 and 200),
  event_type text not null check (event_type in ('displayed','selected','rejected')),
  provider_id text not null,
  model_id text not null,
  generation_mode text not null check (generation_mode in (
    'text_to_image','image_to_image','inpainting','outpainting',
    'background_only','character_only'
  )),
  candidate_displayed boolean not null default false,
  candidate_selected boolean not null default false,
  displayed_at timestamptz,
  selected_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text check (rejected_reason is null or char_length(rejected_reason) between 1 and 500),
  repaired boolean not null default false,
  repair_type text check (repair_type is null or char_length(repair_type) between 1 and 100),
  retry_count integer not null default 0 check (retry_count >= 0),
  quality_score_overall numeric(5,2) check (quality_score_overall between 0 and 100),
  quality_score_character numeric(5,2) check (quality_score_character between 0 and 100),
  quality_score_composition numeric(5,2) check (quality_score_composition between 0 and 100),
  quality_score_expression numeric(5,2) check (quality_score_expression between 0 and 100),
  quality_score_background numeric(5,2) check (quality_score_background between 0 and 100),
  quality_score_continuity numeric(5,2) check (quality_score_continuity between 0 and 100),
  failure_categories text[] not null default '{}',
  evaluation_details jsonb not null default '{}'::jsonb,
  reserved_credits integer check (reserved_credits is null or reserved_credits >= 0),
  finalized_credits integer check (finalized_credits is null or finalized_credits >= 0),
  actual_cost_micros bigint check (actual_cost_micros is null or actual_cost_micros >= 0),
  generation_latency_ms integer check (generation_latency_ms is null or generation_latency_ms >= 0),
  evaluation_latency_ms integer check (evaluation_latency_ms is null or evaluation_latency_ms >= 0),
  created_at timestamptz not null default now(),
  unique (generation_job_id, event_type)
);

create index if not exists cloud_manga_quality_logs_project_idx
  on public.cloud_manga_quality_logs(project_id, created_at desc);
create index if not exists cloud_manga_quality_logs_owner_idx
  on public.cloud_manga_quality_logs(owner_profile_id, created_at desc);

alter table public.cloud_manga_quality_logs enable row level security;
grant select on public.cloud_manga_quality_logs to authenticated;
grant select, insert, update, delete on public.cloud_manga_quality_logs to service_role;

drop policy if exists "cloud_manga_quality_logs_owner" on public.cloud_manga_quality_logs;
create policy "cloud_manga_quality_logs_owner"
  on public.cloud_manga_quality_logs
  for select
  using (
    owner_profile_id = public.current_profile_id()
    and public.cloud_project_can_edit(project_id)
  );

create or replace function public.record_cloud_manga_quality_event(
  p_generation_job_id uuid,
  p_event text,
  p_rejected_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_job public.cloud_generation_jobs%rowtype;
  v_log_id uuid;
  v_mode text;
begin
  if v_profile_id is null or p_event not in ('displayed','selected','rejected') then
    raise exception 'cloud_manga_quality_event_invalid';
  end if;
  if p_event = 'rejected' and nullif(trim(p_rejected_reason), '') is null then
    raise exception 'cloud_manga_quality_rejection_reason_required';
  end if;
  select * into v_job
  from public.cloud_generation_jobs
  where id = p_generation_job_id
    and created_by_profile_id = v_profile_id
    and public.cloud_project_can_edit(project_id);
  if not found then raise exception 'cloud_generation_job_not_found'; end if;

  v_mode := case
    when v_job.input->>'operation' in ('text_to_image','image_to_image','inpainting','outpainting')
      then v_job.input->>'operation'
    when v_job.job_type = 'character_base' then 'character_only'
    else 'background_only'
  end;

  insert into public.cloud_manga_quality_logs (
    owner_profile_id, project_id, page_id, panel_id, generation_job_id,
    candidate_id, event_type, provider_id, model_id, generation_mode,
    candidate_displayed, candidate_selected, displayed_at, selected_at,
    rejected_at, rejected_reason, repaired, repair_type, retry_count,
    reserved_credits, finalized_credits, actual_cost_micros, generation_latency_ms
  ) values (
    v_profile_id, v_job.project_id, v_job.page_id,
    case when (v_job.input->>'targetPanelId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_job.input->>'targetPanelId')::uuid else null end,
    v_job.id, v_job.id::text, p_event, v_job.provider_id, v_job.model_id, v_mode,
    p_event in ('displayed','selected'), p_event = 'selected',
    case when p_event in ('displayed','selected') then now() end,
    case when p_event = 'selected' then now() end,
    case when p_event = 'rejected' then now() end,
    case when p_event = 'rejected' then trim(p_rejected_reason) end,
    v_mode in ('image_to_image','inpainting','outpainting'),
    case when v_mode in ('image_to_image','inpainting','outpainting') then v_mode end,
    greatest(v_job.attempt_count - 1, 0), v_job.reserved_credits,
    case when v_job.status = 'completed' then v_job.reserved_credits end,
    v_job.actual_cost_micros,
    case when v_job.started_at is not null and v_job.finished_at is not null
      then greatest(0, (extract(epoch from (v_job.finished_at-v_job.started_at))*1000)::integer) end
  )
  on conflict (generation_job_id, event_type) do nothing
  returning id into v_log_id;
  if v_log_id is null then
    select id into v_log_id from public.cloud_manga_quality_logs
    where generation_job_id=p_generation_job_id and event_type=p_event;
  end if;
  return v_log_id;
end $$;

revoke execute on function public.record_cloud_manga_quality_event(uuid,text,text)
  from public, anon;
grant execute on function public.record_cloud_manga_quality_event(uuid,text,text)
  to authenticated, service_role;

commit;
