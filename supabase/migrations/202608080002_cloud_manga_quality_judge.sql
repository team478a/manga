begin;

create table public.cloud_manga_panel_specifications (
  generation_job_id uuid primary key references public.cloud_generation_jobs(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  panel_id uuid not null,
  specification jsonb not null,
  created_at timestamptz not null default now(),
  check ((specification->>'version')::integer = 1)
);

create table public.cloud_manga_quality_evaluations (
  generation_job_id uuid primary key references public.cloud_generation_jobs(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  panel_id uuid not null,
  character_match_score numeric(5,2) not null check (character_match_score between 0 and 100),
  expression_score numeric(5,2) not null check (expression_score between 0 and 100),
  composition_score numeric(5,2) not null check (composition_score between 0 and 100),
  background_score numeric(5,2) not null check (background_score between 0 and 100),
  prop_score numeric(5,2) not null check (prop_score between 0 and 100),
  anatomy_score numeric(5,2) not null check (anatomy_score between 0 and 100),
  continuity_hint_score numeric(5,2) not null check (continuity_hint_score between 0 and 100),
  overall_score numeric(5,2) not null check (overall_score between 0 and 100),
  display_band text not null check (display_band in ('display','needs_repair','low_priority')),
  failure_categories text[] not null default '{}',
  evaluation_details jsonb not null default '{}'::jsonb,
  evaluation_latency_ms integer not null check (evaluation_latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index cloud_manga_quality_evaluations_panel_rank_idx
  on public.cloud_manga_quality_evaluations(project_id,panel_id,overall_score desc,created_at);

alter table public.cloud_manga_panel_specifications enable row level security;
alter table public.cloud_manga_quality_evaluations enable row level security;
grant select on public.cloud_manga_panel_specifications, public.cloud_manga_quality_evaluations to authenticated;
grant select,insert,update,delete on public.cloud_manga_panel_specifications, public.cloud_manga_quality_evaluations to service_role;
create policy "cloud_manga_panel_specifications_owner" on public.cloud_manga_panel_specifications
  for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));
create policy "cloud_manga_quality_evaluations_owner" on public.cloud_manga_quality_evaluations
  for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));

create function public.save_cloud_manga_panel_specification(p_generation_job_id uuid,p_specification jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id();v_job public.cloud_generation_jobs%rowtype;v_panel uuid;
begin
  select * into v_job from public.cloud_generation_jobs where id=p_generation_job_id and created_by_profile_id=v_profile and public.cloud_project_can_edit(project_id);
  if not found then raise exception 'cloud_generation_job_not_found';end if;
  if (p_specification->>'version')<>'1' or not (p_specification->>'panelId')~*'^[0-9a-f-]{36}$' then raise exception 'cloud_panel_specification_invalid';end if;
  v_panel:=(p_specification->>'panelId')::uuid;
  insert into public.cloud_manga_panel_specifications(generation_job_id,owner_profile_id,project_id,panel_id,specification)
  values(v_job.id,v_profile,v_job.project_id,v_panel,p_specification) on conflict(generation_job_id)do nothing;
end$$;

create function public.save_cloud_manga_quality_evaluation(p_generation_job_id uuid,p_evaluation jsonb,p_evaluation_latency_ms integer)
returns void language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype;v_spec public.cloud_manga_panel_specifications%rowtype;v_scores jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required';end if;
  select * into v_job from public.cloud_generation_jobs where id=p_generation_job_id and status='completed';
  select * into v_spec from public.cloud_manga_panel_specifications where generation_job_id=p_generation_job_id;
  if v_job.id is null or v_spec.generation_job_id is null then return;end if;
  v_scores:=p_evaluation->'scores';
  insert into public.cloud_manga_quality_evaluations(generation_job_id,owner_profile_id,project_id,panel_id,character_match_score,expression_score,composition_score,background_score,prop_score,anatomy_score,continuity_hint_score,overall_score,display_band,failure_categories,evaluation_details,evaluation_latency_ms)
  values(v_job.id,v_job.created_by_profile_id,v_job.project_id,v_spec.panel_id,(v_scores->>'characterMatchScore')::numeric,(v_scores->>'expressionScore')::numeric,(v_scores->>'compositionScore')::numeric,(v_scores->>'backgroundScore')::numeric,(v_scores->>'propScore')::numeric,(v_scores->>'anatomyScore')::numeric,(v_scores->>'continuityHintScore')::numeric,(v_scores->>'overallScore')::numeric,p_evaluation->>'displayBand',array(select jsonb_array_elements_text(coalesce(p_evaluation->'failureCategories','[]'::jsonb))),coalesce(p_evaluation->'evidence','{}'::jsonb),greatest(coalesce(p_evaluation_latency_ms,0),0))
  on conflict(generation_job_id)do nothing;
end$$;

revoke all on function public.save_cloud_manga_panel_specification(uuid,jsonb),public.save_cloud_manga_quality_evaluation(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_cloud_manga_panel_specification(uuid,jsonb) to authenticated,service_role;
grant execute on function public.save_cloud_manga_quality_evaluation(uuid,jsonb,integer) to service_role;

commit;
